# -*- coding: utf-8 -*-
"""Offline verification (no DB) of the real-data import logic.

Builds the exact postings import_next_data.py would create from
backend/data/transactions.csv, then checks:
  1. Trial Balance balances (DR == CR).
  2. Balance Sheet balances (Assets == Liabilities + Equity).
  3. Net profit equals the independently-computed signed sum of the source file.
  4. P&L category totals reconcile to the source per category.
"""
from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

import coa
from statements import balance_sheet, cost_center_pnl, profit_and_loss, trial_balance

CSV = Path(__file__).parent / "data" / "transactions.csv"
TOL = 0.05


def read_rows():
    with open(CSV, newline="", encoding="utf-8-sig") as f:
        return [{k.strip(): (v or "").strip() for k, v in r.items()} for r in csv.DictReader(f)]


def build():
    rows = read_rows()
    triples = [(r["Category"], r["Subcategory"], r["Ledger"]) for r in rows if r.get("Category") and r.get("Ledger")]
    chart = coa.derive_accounts_from_triples(triples)
    code_for_triple = {(a["category"], a["subcategory"], a["name"]): a["code"]
                       for a in chart if a["type"] in ("income", "expense")}
    accounts = [{"account_id": a["code"], "name": a["name"], "code": a["code"], "type": a["type"],
                 "currency": "USD", "category": a.get("category", ""),
                 "subcategory": a.get("subcategory", ""), "cost_center": a.get("cost_center", "")}
                for a in chart]
    clearing = coa.CLEARING_ACCOUNT_CODE
    txns = []
    src_net = 0.0
    src_cat = defaultdict(float)
    for r in rows:
        cat, sub, led = r.get("Category"), r.get("Subcategory"), r.get("Ledger")
        if not cat or not led:
            continue
        amt = coa.parse_amount(r.get("Amount"))
        # Category total in the engine's convention: income signed (contra
        # negative), expense as positive magnitude. Net profit = income - expense.
        if coa._account_type(cat) == "income":
            cat_val = -amt if cat in coa.CONTRA_REVENUE_CATEGORIES else amt
            src_net += cat_val
        else:
            cat_val = amt
            src_net -= cat_val
        src_cat[cat] += cat_val
        primary, clr, mag = coa.posting_sides(cat, amt)
        if mag == 0:
            continue
        code = code_for_triple[(cat, sub, led)]
        date = coa.parse_date(r.get("Date"))
        txns.append({"date": date, "amount": mag, "currency": "USD", "type": primary,
                     "account_id": code, "department": r.get("Department", "")})
        txns.append({"date": date, "amount": mag, "currency": "USD", "type": clr,
                     "account_id": clearing, "department": r.get("Department", "")})
    return accounts, txns, src_net, src_cat


def approx(a, b):
    return abs(a - b) <= TOL


def main():
    accounts, txns, src_net, src_cat = build()
    ok = True
    print("=" * 60)
    print(f"Source rows -> {len(txns)} postings")

    tb = trial_balance(txns, accounts, "2026-12-31")
    bal = approx(tb["total_debit"], tb["total_credit"])
    ok &= bal
    print(f"Trial Balance: DR={tb['total_debit']:,.2f} CR={tb['total_credit']:,.2f} "
          f"{'BALANCED' if bal else 'OUT'}")

    bs = balance_sheet(txns, accounts, "2026-12-31")
    bsok = approx(bs["total_assets"], bs["total_liabilities"] + bs["total_equity"])
    ok &= bsok
    print(f"Balance Sheet: Assets={bs['total_assets']:,.2f} "
          f"L+E={bs['total_liabilities'] + bs['total_equity']:,.2f} {'BALANCED' if bsok else 'OUT'}")

    pl = profit_and_loss(txns, accounts, "2026-01-01", "2026-12-31")
    npok = approx(pl["report"]["net_profit"], src_net)
    ok &= npok
    print(f"Net Profit: engine={pl['report']['net_profit']:,.2f} source={src_net:,.2f} "
          f"{'OK' if npok else 'MISMATCH'}")

    print("\nPer-category reconciliation (engine signed vs source signed):")
    eng_cat = {c["category"]: c["total"] for c in pl["categories"]}
    for cat in sorted(src_cat, key=lambda c: coa._category_order_index(c)):
        e = eng_cat.get(cat, 0.0)
        m = approx(e, src_cat[cat])
        ok &= m
        print(f"   {cat:<34} engine={e:>16,.2f} source={src_cat[cat]:>16,.2f} {'OK' if m else 'MISMATCH'}")

    cc = cost_center_pnl(txns, accounts, "2026-01-01", "2026-12-31")
    print(f"\nCost centres (departments): {len(cc['rows'])}, total contribution={cc['total_contribution']:,.2f}")

    print("\n" + "=" * 60)
    print(f"RESULT: {'ALL CHECKS PASSED' if ok else 'FAILURES DETECTED'}")
    r = pl["report"]
    print("\nIncome statement roll-up (USD):")
    for k in ("net_revenue", "total_cos", "gross_profit", "total_marketing", "total_opex",
              "total_non_cash", "total_other_operating", "operating_income", "total_finance",
              "depreciation", "ebit", "other_income", "net_profit_before_tax", "tax", "net_profit"):
        print(f"   {k:<24} {r[k]:>18,.2f}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
