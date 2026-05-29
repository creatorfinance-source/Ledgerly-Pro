# Statements computation: P&L, Balance Sheet, Cash Flow, Trial Balance, Ledger, Tax.
from __future__ import annotations

from collections import defaultdict
from typing import List, Optional

# Simple FX rates to USD base (illustrative). In production, fetch live rates.
FX_TO_USD = {
    "USD": 1.0,
    "EUR": 1.08,
    "BDT": 0.0091,
    "LKR": 0.0033,
    "MYR": 0.21,
}


def to_base(amount: float, currency: str, base: str = "USD") -> float:
    usd = amount * FX_TO_USD.get(currency, 1.0)
    return usd / FX_TO_USD.get(base, 1.0)


def filter_by_date(txns: List[dict], date_from: Optional[str], date_to: Optional[str]) -> List[dict]:
    out = []
    for t in txns:
        d = t.get("date", "")
        if date_from and d < date_from:
            continue
        if date_to and d > date_to:
            continue
        out.append(t)
    return out


def signed_amount(t: dict, account: dict, base: str = "USD") -> float:
    """Return signed amount in base currency relative to the account.
    Convention:
      - For income/credit accounts: credit increases (positive), debit decreases (negative)
      - For expense/asset/debit accounts: debit increases (positive), credit decreases (negative)
    """
    amt = to_base(float(t.get("amount", 0) or 0), t.get("currency", "USD"), base)
    a_type = account.get("type", "asset")
    is_debit_natural = a_type in ("asset", "expense")
    if t.get("type") == "debit":
        return amt if is_debit_natural else -amt
    return -amt if is_debit_natural else amt


# Category roll-up labels used by the categorised income statement.
_COS = "Cost Of Services (COS)"
_MKT = "Marketing & Promotional Expenses"
_OPEX = "Operating Expenses (OPEX)"
_NONCASH = "Non-Cash Expense"
_FIN = "Finance Expenses"
_DEP = "Depreciation"
_OTHER_INCOME = "Other Income"
_TAX = "Tax"
_REVENUE = "Revenue"

_PNL_CATEGORY_ORDER = [
    _REVENUE, _COS, _MKT, _OPEX, _NONCASH, _FIN, _DEP, _OTHER_INCOME, _TAX,
]


def profit_and_loss(txns: List[dict], accounts: List[dict], date_from: str, date_to: str, base: str = "USD") -> dict:
    """Income statement.

    Returns both a flat view (``income`` / ``expenses`` lines — kept for backward
    compatibility) and a ``categories`` view grouped Category → Subcategory →
    Ledger, plus a ``report`` block with the management roll-ups used by
    financial-statements.md (Gross Profit, Operating Income, EBIT, Net Profit).
    """
    by_id = {a["account_id"]: a for a in accounts}
    txns = filter_by_date(txns, date_from, date_to)
    income_total = 0.0
    expense_total = 0.0
    income_lines = defaultdict(float)
    expense_lines = defaultdict(float)

    # Nested grouping: category -> subcategory -> account name -> {amount, code}
    grouped: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"amount": 0.0, "code": ""})))
    cat_totals: dict = defaultdict(float)
    cat_acc_type: dict = {}  # category -> account type (income/expense) from the actual accounts

    for t in txns:
        acc = by_id.get(t.get("account_id"))
        if not acc or acc["type"] not in ("income", "expense"):
            continue
        v = signed_amount(t, acc, base)
        if acc["type"] == "income":
            income_total += v
            income_lines[acc["name"]] += v
        else:
            expense_total += v
            expense_lines[acc["name"]] += v
        category = acc.get("category") or ("Revenue" if acc["type"] == "income" else "Operating Expenses (OPEX)")
        subcategory = acc.get("subcategory") or acc["name"]
        cell = grouped[category][subcategory][acc["name"]]
        cell["amount"] += v
        cell["code"] = acc.get("code", "")
        cat_totals[category] += v
        cat_acc_type[category] = acc["type"]

    # Build ordered categories structure
    def _order_key(c):
        return _PNL_CATEGORY_ORDER.index(c) if c in _PNL_CATEGORY_ORDER else 99
    categories = []
    for category in sorted(grouped.keys(), key=_order_key):
        subs = []
        for subcategory, ledgers in grouped[category].items():
            lines = [
                {"account": name, "code": d["code"], "amount": round(d["amount"], 2)}
                for name, d in ledgers.items()
            ]
            lines.sort(key=lambda x: x["account"])
            subs.append({
                "subcategory": subcategory,
                "lines": lines,
                "subtotal": round(sum(l["amount"] for l in lines), 2),
            })
        subs.sort(key=lambda x: x["subcategory"])
        categories.append({
            # type reflects the real account type, so contra-revenue categories
            # (income-type, e.g. Refunds) correctly sit in the revenue block.
            "category": category,
            "type": cat_acc_type.get(category, "expense"),
            "subcategories": subs,
            "total": round(cat_totals[category], 2),
        })

    # Management roll-ups (signed: income positive, expense totals positive).
    # Determine income vs expense from the accounts' types so the roll-up is
    # robust to contra-revenue categories (Refunds, Reverse Revenue, Loss …)
    # which are income-type but net *down* revenue.
    cat_type = {c["category"]: c["type"] for c in categories}
    named_expense = {_COS, _MKT, _OPEX, _NONCASH, _FIN, _DEP, _TAX}
    # Revenue block = all income categories except below-the-line Other Income
    net_revenue = round(sum(
        cat_totals[c] for c in cat_totals
        if cat_type.get(c) == "income" and c != _OTHER_INCOME
    ), 2)
    total_cos = round(cat_totals.get(_COS, 0.0), 2)
    gross_profit = round(net_revenue - total_cos, 2)
    total_mkt = round(cat_totals.get(_MKT, 0.0), 2)
    total_opex = round(cat_totals.get(_OPEX, 0.0), 2)
    total_noncash = round(cat_totals.get(_NONCASH, 0.0), 2)
    # Any expense category not explicitly bucketed rolls into "other operating".
    other_operating = round(sum(
        cat_totals[c] for c in cat_totals
        if cat_type.get(c) == "expense" and c not in named_expense
    ), 2)
    operating_income = round(gross_profit - total_mkt - total_opex - total_noncash - other_operating, 2)
    total_fin = round(cat_totals.get(_FIN, 0.0), 2)
    total_dep = round(cat_totals.get(_DEP, 0.0), 2)
    ebit = round(operating_income - total_fin - total_dep, 2)
    other_income = round(cat_totals.get(_OTHER_INCOME, 0.0), 2)
    npbt = round(ebit + other_income, 2)
    total_tax = round(cat_totals.get(_TAX, 0.0), 2)
    net_profit = round(npbt - total_tax, 2)

    def _pct(num, den):
        return round((num / den) * 100, 2) if den else 0.0

    report = {
        "net_revenue": net_revenue,
        "total_cos": total_cos,
        "gross_profit": gross_profit,
        "gross_margin_pct": _pct(gross_profit, net_revenue),
        "total_marketing": total_mkt,
        "total_opex": total_opex,
        "total_non_cash": total_noncash,
        "total_other_operating": other_operating,
        "operating_income": operating_income,
        "operating_margin_pct": _pct(operating_income, net_revenue),
        "total_finance": total_fin,
        "depreciation": total_dep,
        "ebit": ebit,
        "other_income": other_income,
        "net_profit_before_tax": npbt,
        "tax": total_tax,
        "net_profit": net_profit,
        "net_margin_pct": _pct(net_profit, net_revenue),
    }

    return {
        "from": date_from,
        "to": date_to,
        "currency": base,
        "income": [{"account": k, "amount": round(v, 2)} for k, v in income_lines.items()],
        "expenses": [{"account": k, "amount": round(v, 2)} for k, v in expense_lines.items()],
        "total_income": round(income_total, 2),
        "total_expenses": round(expense_total, 2),
        "net_profit": round(income_total - expense_total, 2),
        "categories": categories,
        "report": report,
    }


def cost_center_pnl(txns: List[dict], accounts: List[dict], date_from: str, date_to: str,
                    base: str = "USD", cc_names: Optional[dict] = None) -> dict:
    """P&L contribution by cost center.

    The cost centre is read from each transaction's ``department`` field (the
    seed and the journal-entry form both write CCxx there). For every CC we sum
    revenue (income accounts) and expenses (expense accounts) and report the
    contribution (revenue − expenses) and margin.
    """
    cc_names = cc_names or {}
    by_id = {a["account_id"]: a for a in accounts}
    txns = filter_by_date(txns, date_from, date_to)
    rev = defaultdict(float)
    exp = defaultdict(float)
    seen = set()
    for t in txns:
        acc = by_id.get(t.get("account_id"))
        if not acc or acc["type"] not in ("income", "expense"):
            continue
        cc = (t.get("department") or "Unassigned").strip() or "Unassigned"
        seen.add(cc)
        v = signed_amount(t, acc, base)
        if acc["type"] == "income":
            rev[cc] += v
        else:
            exp[cc] += v

    rows = []
    for cc in sorted(seen):
        revenue = round(rev.get(cc, 0.0), 2)
        expenses = round(exp.get(cc, 0.0), 2)
        contribution = round(revenue - expenses, 2)
        margin = round((contribution / revenue) * 100, 2) if revenue else 0.0
        rows.append({
            "cost_center": cc,
            "name": cc_names.get(cc, ""),
            "revenue": revenue,
            "expenses": expenses,
            "contribution": contribution,
            "margin_pct": margin,
        })
    total_rev = round(sum(r["revenue"] for r in rows), 2)
    total_exp = round(sum(r["expenses"] for r in rows), 2)
    return {
        "from": date_from,
        "to": date_to,
        "currency": base,
        "rows": rows,
        "total_revenue": total_rev,
        "total_expenses": total_exp,
        "total_contribution": round(total_rev - total_exp, 2),
    }


def statement_of_equity(txns: List[dict], accounts: List[dict], date_from: str, date_to: str, base: str = "USD") -> dict:
    """Statement of Changes in Equity for the period.

    Beginning equity (contributed capital balances + retained earnings to the day
    before ``date_from``), plus contributions/distributions and net income during
    the period, reconciling to ending equity.
    """
    by_id = {a["account_id"]: a for a in accounts}
    equity_accounts = [a for a in accounts if a.get("type") == "equity"]

    def _balance_before(account_id: str) -> float:
        tot = 0.0
        for t in txns:
            if t.get("account_id") != account_id:
                continue
            if date_from and t.get("date", "") >= date_from:
                continue
            acc = by_id.get(account_id)
            if acc:
                tot += signed_amount(t, acc, base)
        return tot

    def _movement(account_id: str) -> float:
        tot = 0.0
        for t in txns:
            if t.get("account_id") != account_id:
                continue
            d = t.get("date", "")
            if date_from and d < date_from:
                continue
            if date_to and d > date_to:
                continue
            acc = by_id.get(account_id)
            if acc:
                tot += signed_amount(t, acc, base)
        return tot

    components = []
    begin_contrib = 0.0
    contrib_moves = 0.0
    is_retained = lambda a: "retained" in (a.get("name", "").lower())
    for a in equity_accounts:
        if is_retained(a):
            continue  # retained earnings handled via P&L below
        b = round(_balance_before(a["account_id"]), 2)
        m = round(_movement(a["account_id"]), 2)
        begin_contrib += b
        contrib_moves += m
        components.append({
            "account": a["name"],
            "code": a.get("code", ""),
            "beginning": b,
            "movement": m,
            "ending": round(b + m, 2),
        })

    # Retained earnings: prior accumulated P&L + current-period net income
    prior_pl = profit_and_loss(txns, accounts, "0000-01-01", _prev_day(date_from), base) if date_from else None
    beginning_retained = round(prior_pl["net_profit"], 2) if prior_pl else 0.0
    period_pl = profit_and_loss(txns, accounts, date_from, date_to, base)
    net_income = round(period_pl["net_profit"], 2)
    ending_retained = round(beginning_retained + net_income, 2)

    beginning_equity = round(begin_contrib + beginning_retained, 2)
    ending_equity = round(begin_contrib + contrib_moves + ending_retained, 2)

    return {
        "from": date_from,
        "to": date_to,
        "currency": base,
        "beginning_equity": beginning_equity,
        "contributed_components": components,
        "contributions": round(contrib_moves, 2),
        "beginning_retained_earnings": beginning_retained,
        "net_income": net_income,
        "dividends": 0.0,
        "ending_retained_earnings": ending_retained,
        "ending_equity": ending_equity,
    }


def _prev_day(iso_date: Optional[str]) -> str:
    """Return the day before an ISO date string (string compare safe)."""
    if not iso_date:
        return "9999-12-31"
    try:
        from datetime import date, timedelta
        y, m, d = (int(x) for x in iso_date.split("-")[:3])
        return (date(y, m, d) - timedelta(days=1)).isoformat()
    except Exception:
        return iso_date


def balance_sheet(txns: List[dict], accounts: List[dict], as_of: str, base: str = "USD") -> dict:
    by_id = {a["account_id"]: a for a in accounts}
    txns = filter_by_date(txns, None, as_of)
    sums = defaultdict(float)
    by_type = defaultdict(list)
    for t in txns:
        acc = by_id.get(t.get("account_id"))
        if not acc:
            continue
        v = signed_amount(t, acc, base)
        sums[acc["account_id"]] += v
    for acc in accounts:
        bal = round(sums.get(acc["account_id"], 0.0), 2)
        if acc["type"] in ("asset", "liability", "equity"):
            by_type[acc["type"]].append({"account": acc["name"], "balance": bal})
    # Retained earnings = income - expenses up to as_of
    pl = profit_and_loss(txns, accounts, "0000-01-01", as_of, base)
    retained = pl["net_profit"]
    by_type["equity"].append({"account": "Retained Earnings", "balance": round(retained, 2)})
    total_assets = round(sum(x["balance"] for x in by_type["asset"]), 2)
    total_liab = round(sum(x["balance"] for x in by_type["liability"]), 2)
    total_equity = round(sum(x["balance"] for x in by_type["equity"]), 2)
    return {
        "as_of": as_of,
        "currency": base,
        "assets": by_type["asset"],
        "liabilities": by_type["liability"],
        "equity": by_type["equity"],
        "total_assets": total_assets,
        "total_liabilities": total_liab,
        "total_equity": total_equity,
    }


def cash_flow(txns: List[dict], accounts: List[dict], date_from: str, date_to: str, base: str = "USD") -> dict:
    by_id = {a["account_id"]: a for a in accounts}
    txns = filter_by_date(txns, date_from, date_to)
    operating = 0.0
    investing = 0.0
    financing = 0.0
    lines = []
    for t in txns:
        acc = by_id.get(t.get("account_id"))
        if not acc:
            continue
        v = signed_amount(t, acc, base)
        # Heuristic mapping
        a_type = acc["type"]
        if a_type in ("income", "expense"):
            operating += v if a_type == "income" else -v
            section = "operating"
        elif a_type == "asset":
            # capital purchases -> investing
            investing -= v
            section = "investing"
        else:
            financing += v
            section = "financing"
        lines.append({"date": t["date"], "description": t.get("description", ""), "amount": round(v, 2), "section": section})
    net = round(operating + investing + financing, 2)
    return {
        "from": date_from,
        "to": date_to,
        "currency": base,
        "operating": round(operating, 2),
        "investing": round(investing, 2),
        "financing": round(financing, 2),
        "net_change": net,
        "lines": lines,
    }


def trial_balance(txns: List[dict], accounts: List[dict], as_of: str, base: str = "USD") -> dict:
    txns = filter_by_date(txns, None, as_of)
    debits = defaultdict(float)
    credits = defaultdict(float)
    for t in txns:
        amt = to_base(float(t.get("amount", 0) or 0), t.get("currency", "USD"), base)
        if t.get("type") == "debit":
            debits[t["account_id"]] += amt
        else:
            credits[t["account_id"]] += amt
    rows = []
    total_d = 0.0
    total_c = 0.0
    for acc in accounts:
        d = round(debits.get(acc["account_id"], 0.0), 2)
        c = round(credits.get(acc["account_id"], 0.0), 2)
        if d == 0 and c == 0:
            continue
        rows.append({"code": acc.get("code", ""), "account": acc["name"], "type": acc["type"], "debit": d, "credit": c})
        total_d += d
        total_c += c
    return {
        "as_of": as_of,
        "currency": base,
        "rows": rows,
        "total_debit": round(total_d, 2),
        "total_credit": round(total_c, 2),
    }


def general_ledger(txns: List[dict], accounts: List[dict], account_id: str, date_from: str, date_to: str, base: str = "USD") -> dict:
    by_id = {a["account_id"]: a for a in accounts}
    acc = by_id.get(account_id)
    if not acc:
        return {"error": "account not found"}
    txns = [t for t in txns if t.get("account_id") == account_id]
    txns = filter_by_date(txns, date_from, date_to)
    txns.sort(key=lambda x: x.get("date", ""))
    rows = []
    running = 0.0
    for t in txns:
        v = signed_amount(t, acc, base)
        running += v
        rows.append({
            "date": t["date"],
            "description": t.get("description", ""),
            "debit": round(to_base(t["amount"], t.get("currency", "USD"), base), 2) if t["type"] == "debit" else 0,
            "credit": round(to_base(t["amount"], t.get("currency", "USD"), base), 2) if t["type"] == "credit" else 0,
            "balance": round(running, 2),
        })
    return {"account": acc, "from": date_from, "to": date_to, "currency": base, "rows": rows, "ending_balance": round(running, 2)}


def tax_summary(txns: List[dict], accounts: List[dict], invoices: List[dict], date_from: str, date_to: str, base: str = "USD") -> dict:
    invs = [i for i in invoices if i.get("issue_date", "") >= (date_from or "") and i.get("issue_date", "") <= (date_to or "9999")]
    total_taxable = sum(to_base(i.get("subtotal", 0), i.get("currency", "USD"), base) for i in invs)
    total_tax = sum(to_base(i.get("tax_amount", 0), i.get("currency", "USD"), base) for i in invs)
    total_collected = sum(to_base(i.get("total", 0), i.get("currency", "USD"), base) for i in invs if i.get("status") == "paid")
    return {
        "from": date_from,
        "to": date_to,
        "currency": base,
        "taxable_sales": round(total_taxable, 2),
        "tax_collected": round(total_tax, 2),
        "paid_invoice_total": round(total_collected, 2),
        "invoices_count": len(invs),
    }