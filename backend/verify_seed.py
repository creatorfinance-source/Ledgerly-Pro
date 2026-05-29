# -*- coding: utf-8 -*-
"""
Offline verification (no database) for the NEXT Ventures accounting build.

Checks:
  1. coa.PNL_ROWS monthly totals reconcile to the *source* pnlCategory.md.
  2. Building the seeded journal in-memory, the Trial Balance balances (DR==CR).
  3. The Balance Sheet balances (Assets == Liabilities + Equity).
  4. The categorised P&L net profit (per month + full period) matches the
     independently-parsed source net profit.
  5. Statement of Equity ending equity reconciles to the Balance Sheet equity.

Run:  cd backend && python verify_seed.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import coa
from statements import balance_sheet, profit_and_loss, statement_of_equity, trial_balance

TOL = 0.05  # rounding tolerance in USD
INCOME_CATS = {"Revenue", "Other Income"}
MONTHS = coa.PERIOD_COLUMNS  # [May, Apr, Mar, Feb, Jan]


# ── 1. Parse the SOURCE markdown independently ─────────────────────────────
def parse_source_md() -> dict:
    """Return {month: net_profit} parsed straight from pnlCategory.md."""
    md = (Path(__file__).parent.parent / "pnlCategory.md").read_text()
    block = md.split("```")[1] if "```" in md else md
    totals = {m: 0.0 for m in MONTHS}

    def num(cell: str) -> float:
        c = cell.strip().replace("$", "").replace(",", "").strip()
        if not c or c == "-":
            return 0.0
        neg = c.startswith("(") and c.endswith(")")
        c = c.strip("()")
        try:
            v = float(c)
        except ValueError:
            return 0.0
        return -v if neg else v

    for line in block.splitlines():
        if "\t" not in line:
            continue
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        category = parts[0].strip()
        if category in ("Category", ""):
            continue
        # last 5 columns are May..Jan
        vals = parts[3:8]
        vals = (vals + ["", "", "", "", ""])[:5]
        sign = 1.0 if category in INCOME_CATS else -1.0
        for i, cell in enumerate(vals):
            totals[MONTHS[i]] += sign * num(cell)
    return totals


# ── 2. coa.PNL_ROWS monthly net profit (our transcription) ────────────────
def coa_month_totals() -> dict:
    totals = {m: 0.0 for m in MONTHS}
    for category, _sub, _ledger, amounts in coa.PNL_ROWS:
        sign = 1.0 if category in INCOME_CATS else -1.0
        for i, a in enumerate(amounts):
            totals[MONTHS[i]] += sign * a
    return totals


# ── 3. Build the in-memory seeded journal (mirrors seed_next_data.py) ──────
def build_dataset():
    accounts = [
        {"account_id": a["code"], "name": a["name"], "code": a["code"],
         "type": a["type"], "currency": "USD",
         "category": a.get("category", ""), "subcategory": a.get("subcategory", ""),
         "cost_center": a.get("cost_center", "")}
        for a in coa.CHART_OF_ACCOUNTS
    ]
    clearing = coa.CLEARING_ACCOUNT_CODE
    pnl_meta = {(a["category"], a["subcategory"], a["name"]): a for a in coa.build_pnl_accounts()}
    txns = []
    for category, subcategory, ledger, amounts in coa.PNL_ROWS:
        meta = pnl_meta[(category, subcategory, ledger)]
        acc_type = meta["type"]
        for col, amount in zip(MONTHS, amounts):
            if not amount:
                continue
            date = coa.PERIOD_END_DATE[col]
            positive = amount >= 0
            if acc_type == "income":
                primary = "credit" if positive else "debit"
            else:
                primary = "debit" if positive else "credit"
            clearing_side = "debit" if primary == "credit" else "credit"
            mag = round(abs(amount), 2)
            txns.append({"txn_id": f"{meta['code']}_{col}", "date": date, "amount": mag,
                         "currency": "USD", "type": primary, "account_id": meta["code"],
                         "description": ledger})
            txns.append({"txn_id": f"{meta['code']}_{col}_c", "date": date, "amount": mag,
                         "currency": "USD", "type": clearing_side, "account_id": clearing,
                         "description": "cash"})
    return accounts, txns


def approx(a, b):
    return abs(a - b) <= TOL


def main():
    ok = True
    src = parse_source_md()
    mine = coa_month_totals()
    accounts, txns = build_dataset()

    print("=" * 64)
    print("1) SOURCE (pnlCategory.md)  vs  coa.PNL_ROWS  — monthly net profit")
    print("=" * 64)
    for m in MONTHS:
        match = approx(src[m], mine[m])
        ok &= match
        print(f"   {m}:  source={src[m]:>16,.2f}   coa={mine[m]:>16,.2f}   {'OK' if match else 'MISMATCH'}")

    print("\n" + "=" * 64)
    print("2) ENGINE checks (Trial Balance / Balance Sheet / P&L / Equity)")
    print("=" * 64)

    # Trial balance balances
    tb = trial_balance(txns, accounts, "2026-05-31")
    bal = approx(tb["total_debit"], tb["total_credit"])
    ok &= bal
    print(f"   Trial Balance: DR={tb['total_debit']:,.2f}  CR={tb['total_credit']:,.2f}  "
          f"{'BALANCED' if bal else 'OUT OF BALANCE'}")

    # Balance sheet balances
    bs = balance_sheet(txns, accounts, "2026-05-31")
    lhs = bs["total_assets"]
    rhs = round(bs["total_liabilities"] + bs["total_equity"], 2)
    bsok = approx(lhs, rhs)
    ok &= bsok
    print(f"   Balance Sheet: Assets={lhs:,.2f}  L+E={rhs:,.2f}  "
          f"{'BALANCED' if bsok else 'OUT OF BALANCE'}")

    # P&L per month vs source
    print("   Categorised P&L net profit per month (engine vs source):")
    for m in MONTHS:
        d = coa.PERIOD_END_DATE[m]
        pl = profit_and_loss(txns, accounts, d, d)
        np_ = pl["report"]["net_profit"]
        match = approx(np_, src[m])
        ok &= match
        print(f"     {m}: engine={np_:>16,.2f}  source={src[m]:>16,.2f}  {'OK' if match else 'MISMATCH'}")

    # Full-period P&L
    pl_all = profit_and_loss(txns, accounts, "2026-01-01", "2026-05-31")
    src_all = sum(src.values())
    fullok = approx(pl_all["report"]["net_profit"], src_all)
    ok &= fullok
    print(f"   Full-period Net Profit: engine={pl_all['report']['net_profit']:,.2f}  "
          f"source={src_all:,.2f}  {'OK' if fullok else 'MISMATCH'}")

    # Statement of equity reconciles to balance-sheet equity
    eq = statement_of_equity(txns, accounts, "2026-01-01", "2026-05-31")
    eqok = approx(eq["ending_equity"], bs["total_equity"])
    ok &= eqok
    print(f"   Statement of Equity: ending_equity={eq['ending_equity']:,.2f}  "
          f"BS equity={bs['total_equity']:,.2f}  {'OK' if eqok else 'MISMATCH'}")

    print("\n" + "=" * 64)
    print(f"RESULT: {'ALL CHECKS PASSED ✅' if ok else 'FAILURES DETECTED ❌'}")
    print("=" * 64)
    # Quick management snapshot
    r = pl_all["report"]
    print("\nFull-period (Jan–May 2026) management roll-up, USD:")
    for k in ("net_revenue", "total_cos", "gross_profit", "total_marketing",
              "total_opex", "operating_income", "total_finance", "depreciation",
              "ebit", "other_income", "net_profit_before_tax", "tax", "net_profit"):
        print(f"   {k:<24} {r[k]:>18,.2f}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
