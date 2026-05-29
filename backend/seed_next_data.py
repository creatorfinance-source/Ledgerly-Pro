# -*- coding: utf-8 -*-
"""
Seed NEXT Ventures Ltd. Jan–May 2026 management P&L into the accounting system.

What it does
------------
1. Resolves the target user (env SEED_USER_EMAIL, else first user in the DB).
2. Ensures the prop-firm Chart of Accounts + Cost Centers exist for that user.
3. Posts balanced double-entry journal transactions for every (category,
   subcategory, ledger, month) figure in coa.PNL_ROWS. Each P&L line gets:
       • a posting to its income/expense ledger account, and
       • an equal, opposite posting to Cash & Bank (1010) — the clearing leg —
   so the trial balance always balances and the statements reconcile.

Idempotent: every seeded transaction is tagged source="seed-next" and is fully
deleted + re-created on each run, so you can run it as often as you like.

Usage
-----
    cd backend
    python seed_next_data.py                 # seed first user (or SEED_USER_EMAIL)
    SEED_USER_EMAIL=zubair.ahmad@nextventures.io python seed_next_data.py
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

from db import db, shutdown_db, startup_db  # noqa: E402
import coa  # noqa: E402

SEED_SOURCE = "seed-next"
CURRENCY = "USD"


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _resolve_user_id() -> str | None:
    email = os.getenv("SEED_USER_EMAIL", "").strip().lower()
    if email:
        u = await db.users.find_one({"email": email}, {"_id": 0})
        if u:
            return u["user_id"]
        print(f"!! No user with email {email}; falling back to first user.")
    users = await db.users.find({}, {"_id": 0}).to_list(5)
    if not users:
        return None
    return users[0]["user_id"]


async def _ensure_cost_centers(user_id: str):
    existing = await db.cost_centers.count_documents({"user_id": user_id})
    if existing > 0:
        return
    docs = [{
        "cc_code": cc["cc_code"], "user_id": user_id, "name": cc["name"],
        "type": cc["type"], "allocation_method": cc["allocation_method"],
        "created_at": _now(),
    } for cc in coa.COST_CENTERS]
    await db.cost_centers.insert_many(docs)
    print(f"   seeded {len(docs)} cost centers")


async def _ensure_accounts(user_id: str) -> dict:
    """Make sure every CoA code exists for the user; return {code: account_id}."""
    existing = await db.accounts.find({"user_id": user_id}, {"_id": 0}).to_list(2000)
    by_code = {a.get("code"): a for a in existing}
    new_docs = []
    for a in coa.CHART_OF_ACCOUNTS:
        if a["code"] in by_code:
            continue
        doc = {
            "account_id": f"acc_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "name": a["name"], "code": a["code"], "type": a["type"],
            "currency": CURRENCY, "description": "",
            "category": a.get("category", ""), "subcategory": a.get("subcategory", ""),
            "cost_center": a.get("cost_center", ""),
            "is_default": True, "created_at": _now(),
        }
        new_docs.append(doc)
        by_code[a["code"]] = doc
    if new_docs:
        await db.accounts.insert_many(new_docs)
        print(f"   created {len(new_docs)} missing accounts")
    return {code: a["account_id"] for code, a in by_code.items()}


def _legs(acc_type: str, amount: float):
    """Return (primary_side, clearing_side) for a signed P&L amount.

    Income: +amount is a credit (revenue), -amount (contra) is a debit.
    Expense: +amount is a debit, -amount (credit memo) is a credit.
    The clearing (Cash) leg is always the opposite side.
    """
    positive = amount >= 0
    if acc_type == "income":
        primary = "credit" if positive else "debit"
    else:  # expense
        primary = "debit" if positive else "credit"
    clearing = "debit" if primary == "credit" else "credit"
    return primary, clearing


async def seed():
    await startup_db()
    try:
        user_id = await _resolve_user_id()
        if not user_id:
            print("!! No users found. Register/login in the app first, then re-run.")
            return
        print(f">> Seeding NEXT Ventures data for user_id={user_id}")

        await _ensure_cost_centers(user_id)
        code_to_id = await _ensure_accounts(user_id)
        clearing_id = code_to_id[coa.CLEARING_ACCOUNT_CODE]

        # Clean any previous seed so re-runs don't double-count.
        await db.transactions.delete_many({"user_id": user_id, "source": SEED_SOURCE})

        # Map (category, subcategory, ledger) -> account meta for code lookup.
        acc_lookup = {
            (a["category"], a["subcategory"], a["name"]): a
            for a in coa.build_pnl_accounts()
        }

        txns = []
        n_lines = 0
        for category, subcategory, ledger, amounts in coa.PNL_ROWS:
            meta = acc_lookup[(category, subcategory, ledger)]
            acc_id = code_to_id[meta["code"]]
            acc_type = meta["type"]
            cc = meta["cost_center"]
            for col, amount in zip(coa.PERIOD_COLUMNS, amounts):
                if not amount:
                    continue
                n_lines += 1
                date = coa.PERIOD_END_DATE[col]
                primary_side, clearing_side = _legs(acc_type, amount)
                mag = round(abs(amount), 2)
                base = f"txn_{SEED_SOURCE}_{meta['code']}_{col}"
                journal_id = f"je_{SEED_SOURCE}_{meta['code']}_{col}"
                common = {
                    "user_id": user_id, "date": date, "amount": mag,
                    "currency": CURRENCY, "category": category,
                    "subcategory": subcategory, "ledger": ledger,
                    "month": col, "department": cc, "journal_id": journal_id,
                    "source": SEED_SOURCE, "reconciled": True, "created_at": _now(),
                }
                # Primary ledger posting
                txns.append({
                    **common, "txn_id": base, "type": primary_side,
                    "account_id": acc_id, "contra_account_id": clearing_id,
                    "description": f"{ledger} ({col})",
                })
                # Clearing (Cash & Bank) posting
                txns.append({
                    **common, "txn_id": f"{base}_clr", "type": clearing_side,
                    "account_id": clearing_id, "contra_account_id": acc_id,
                    "description": f"Cash settlement — {ledger} ({col})",
                })

        # Insert in batches (executemany-friendly).
        BATCH = 500
        for i in range(0, len(txns), BATCH):
            await db.transactions.insert_many(txns[i:i + BATCH])
        print(f">> Posted {len(txns)} journal postings from {n_lines} P&L lines "
              f"(Jan–May 2026).")
        print(">> Done. Open the app → Statements to view P&L / Balance Sheet / "
              "Equity / Trial Balance.")
    finally:
        await shutdown_db()


if __name__ == "__main__":
    asyncio.run(seed())
