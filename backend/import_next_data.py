# -*- coding: utf-8 -*-
"""
Import the REAL NEXT Ventures transaction-level data (backend/data/transactions.csv)
into the accounting system as balanced double-entry journal postings.

Source columns: Month, Date, description, Department, Category, Subcategory, Ledger, Vendor, Amount

Key rules
---------
* Amounts are imported EXACTLY as in the file (no rounding/altering of figures).
* Department  -> cost centre (stored on each posting's ``department`` field).
* Account     -> one income/expense ledger account per unique
                 (Category, Subcategory, Ledger), auto-created with a stable code.
* Income categories (Revenue, Other Income)  -> credit on positive amounts.
  Contra-revenue (Refunds, Reverse Revenue, Loss From FNmarkets) -> debit on
  positive amounts, so they correctly reduce net revenue.
  Expense categories -> debit on positive amounts.
* Each source row becomes a 2-line journal entry: the ledger posting + an equal,
  opposite posting to Cash & Bank (1010), so the trial balance always balances.

Idempotent: clears prior ``import-next`` AND ``seed-next`` postings first, so the
real granular data fully replaces any summary seed (avoids double counting).

Usage
-----
    cd backend
    python import_next_data.py
    SEED_USER_EMAIL=zubair.ahmad@nextventures.io python import_next_data.py
    python import_next_data.py --file /path/to/other.csv
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from db import db, shutdown_db, startup_db  # noqa: E402
import coa  # noqa: E402

IMPORT_SOURCE = "import-next"
DEFAULT_CSV = Path(__file__).parent / "data" / "transactions.csv"
CURRENCY = "USD"


def _now():
    return datetime.now(timezone.utc).isoformat()


def read_rows(csv_path: Path):
    rows = []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            rows.append({k.strip(): (v or "").strip() for k, v in r.items()})
    return rows


async def _resolve_user_id():
    email = os.getenv("SEED_USER_EMAIL", "").strip().lower()
    if email:
        u = await db.users.find_one({"email": email}, {"_id": 0})
        if u:
            return u["user_id"]
        print(f"!! No user with email {email}; falling back to first user.")
    users = await db.users.find({}, {"_id": 0}).to_list(5)
    return users[0]["user_id"] if users else None


async def _ensure_cost_centers(user_id: str):
    if await db.cost_centers.count_documents({"user_id": user_id}) == 0:
        await db.cost_centers.insert_many([{
            "cc_code": cc["cc_code"], "user_id": user_id, "name": cc["name"],
            "type": cc["type"], "allocation_method": cc["allocation_method"],
            "created_at": _now(),
        } for cc in coa.COST_CENTERS])


async def _ensure_accounts(user_id: str, triples) -> dict:
    """Ensure an account exists for every needed code; return {code: account_id}."""
    wanted = coa.derive_accounts_from_triples(triples)
    existing = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(10000)
    by_code = {a.get("code"): a for a in existing}
    new_docs = []
    for a in wanted:
        if a["code"] in by_code:
            continue
        doc = {
            "account_id": f"acc_{uuid.uuid4().hex[:12]}", "user_id": user_id,
            "name": a["name"], "code": a["code"], "type": a["type"],
            "currency": CURRENCY, "description": "",
            "category": a.get("category", ""), "subcategory": a.get("subcategory", ""),
            "cost_center": a.get("cost_center", ""), "is_default": True, "created_at": _now(),
        }
        new_docs.append(doc)
        by_code[a["code"]] = doc
    if new_docs:
        await db.accounts.insert_many(new_docs)
        print(f"   created {len(new_docs)} accounts")
    # map (category, subcategory, ledger) -> code via the derived chart
    code_for_triple = {}
    for a in wanted:
        if a["type"] in ("income", "expense"):
            code_for_triple[(a["category"], a["subcategory"], a["name"])] = a["code"]
    return {c: by_code[c]["account_id"] for c in by_code}, code_for_triple


async def run(csv_path: Path):
    await startup_db()
    try:
        user_id = await _resolve_user_id()
        if not user_id:
            print("!! No users found. Register/login in the app first, then re-run.")
            return
        rows = read_rows(csv_path)
        print(f">> Importing {len(rows)} rows from {csv_path.name} for user_id={user_id}")

        await _ensure_cost_centers(user_id)
        triples = [(r["Category"], r["Subcategory"], r["Ledger"]) for r in rows
                   if r.get("Category") and r.get("Ledger")]
        code_to_id, code_for_triple = await _ensure_accounts(user_id, triples)
        clearing_id = code_to_id[coa.CLEARING_ACCOUNT_CODE]

        # Replace any prior seed/import so figures are not double-counted.
        await db.transactions.delete_many({"user_id": user_id, "source": IMPORT_SOURCE})
        await db.transactions.delete_many({"user_id": user_id, "source": "seed-next"})

        txns = []
        skipped = 0
        for i, r in enumerate(rows):
            category, subcategory, ledger = r.get("Category"), r.get("Subcategory"), r.get("Ledger")
            if not category or not ledger:
                skipped += 1
                continue
            amount = coa.parse_amount(r.get("Amount"))
            primary, clearing, mag = coa.posting_sides(category, amount)
            if mag == 0:
                skipped += 1
                continue
            code = code_for_triple.get((category, subcategory, ledger))
            if not code or code not in code_to_id:
                skipped += 1
                continue
            acc_id = code_to_id[code]
            date = coa.parse_date(r.get("Date"))
            month = coa.month_label_to_iso(r.get("Month"))
            dept = r.get("Department", "")
            journal_id = f"je_{IMPORT_SOURCE}_{i:06d}"
            common = {
                "user_id": user_id, "date": date, "amount": mag, "currency": CURRENCY,
                "category": category, "subcategory": subcategory, "ledger": ledger,
                "vendor": r.get("Vendor", ""), "month": month, "department": dept,
                "journal_id": journal_id, "source": IMPORT_SOURCE,
                "reconciled": True, "created_at": _now(),
            }
            desc = r.get("description", "") or f"{ledger} ({month})"
            txns.append({**common, "txn_id": f"{journal_id}_a", "type": primary,
                         "account_id": acc_id, "contra_account_id": clearing_id,
                         "description": desc})
            txns.append({**common, "txn_id": f"{journal_id}_b", "type": clearing,
                         "account_id": clearing_id, "contra_account_id": acc_id,
                         "description": f"Cash — {desc}"[:240]})

        BATCH = 500
        for i in range(0, len(txns), BATCH):
            await db.transactions.insert_many(txns[i:i + BATCH])
        print(f">> Posted {len(txns)} journal postings ({len(txns)//2} entries); skipped {skipped} blank/zero rows.")
        print(">> Done. Open the app → Statements / Journal Entries / Cost-Center P&L.")
    finally:
        await shutdown_db()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default=str(DEFAULT_CSV), help="CSV path to import")
    args = ap.parse_args()
    asyncio.run(run(Path(args.file)))
