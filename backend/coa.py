# -*- coding: utf-8 -*-
"""
NEXT Ventures Ltd. — Prop / CFD firm Chart of Accounts, Cost Centers, and the
Jan–May 2026 P&L source dataset.

This module is the single source of truth shared by:
  * server.py            -> seeds a new user's Chart of Accounts + Cost Centers
  * seed_next_data.py    -> posts the Jan–May 2026 journal entries
  * statements.py        -> category roll-ups for the categorised P&L

Design notes
------------
The firm's management P&L (see pnlCategory.md) is organised as
    Category  ->  Subcategory  ->  Ledger  ->  monthly amount
We mirror that exactly. Every unique (category, subcategory, ledger) becomes one
account in the Chart of Accounts. Revenue / Other Income categories are
``income`` accounts; everything else is an ``expense`` account. Contra-revenue
lines (refunds, disputes, losses) are stored as income accounts and posted as
debits at seed time, so they correctly *reduce* net revenue.

Balance-sheet accounts (assets / liabilities / equity) follow the prop-firm
chart in PROP_FIRM_GOOGLE_SHEETS_ACCOUNTING_SYSTEM.md.
"""
from __future__ import annotations

from typing import Dict, List

# ──────────────────────────────────────────────────────────────────────────
# Reporting periods (month label -> ISO period-end date used on transactions)
# ──────────────────────────────────────────────────────────────────────────
# Column order in the raw dataset below is: [May, Apr, Mar, Feb, Jan] 2026.
PERIOD_COLUMNS = ["2026-05", "2026-04", "2026-03", "2026-02", "2026-01"]
PERIOD_END_DATE = {
    "2026-05": "2026-05-31",
    "2026-04": "2026-04-30",
    "2026-03": "2026-03-31",
    "2026-02": "2026-02-28",
    "2026-01": "2026-01-31",
}

# ──────────────────────────────────────────────────────────────────────────
# Cost Centers (CC01–CC11 + CORP) — from the prop-firm spec
# ──────────────────────────────────────────────────────────────────────────
COST_CENTERS: List[dict] = [
    {"cc_code": "CC01", "name": "Challenge Operations",   "type": "Revenue", "allocation_method": "Direct"},
    {"cc_code": "CC02", "name": "Funded Account Mgmt",    "type": "Revenue", "allocation_method": "Direct"},
    {"cc_code": "CC03", "name": "Platform Operations",    "type": "Revenue", "allocation_method": "Direct"},
    {"cc_code": "CC04", "name": "Sales & Marketing",      "type": "Revenue", "allocation_method": "Direct"},
    {"cc_code": "CC05", "name": "Community & Education",  "type": "Revenue", "allocation_method": "Direct"},
    {"cc_code": "CC06", "name": "Customer Support",       "type": "Support", "allocation_method": "# traders served"},
    {"cc_code": "CC07", "name": "Technology",             "type": "Support", "allocation_method": "# trades processed"},
    {"cc_code": "CC08", "name": "Compliance & Risk",      "type": "Support", "allocation_method": "Revenue-based"},
    {"cc_code": "CC09", "name": "Finance & Audit",        "type": "Support", "allocation_method": "Revenue-based"},
    {"cc_code": "CC10", "name": "Human Resources",        "type": "Support", "allocation_method": "Headcount-based"},
    {"cc_code": "CC11", "name": "Executive & Admin",      "type": "Support", "allocation_method": "Revenue-based"},
    {"cc_code": "CORP", "name": "Corporate",              "type": "Support", "allocation_method": "Corporate items only"},
]

# Default cost-center per management category (used to tag seeded ledgers).
CATEGORY_COST_CENTER = {
    "Revenue": "CC01",
    "Cost Of Services (COS)": "CC02",
    "Marketing & Promotional Expenses": "CC04",
    "Operating Expenses (OPEX)": "CC11",
    "Finance Expenses": "CC09",
    "Depreciation": "CC07",
    "Non-Cash Expense": "CC01",
    "Other Income": "CORP",
    "Tax": "CORP",
}

# Contra-revenue categories: income-type accounts that REDUCE net revenue.
# In the source data these appear as separate categories with positive amounts;
# at posting time a positive figure is booked as a debit so it nets down revenue.
CONTRA_REVENUE_CATEGORIES = {"Refunds", "Reverse Revenue", "Loss From FNmarkets", "Less: Refunds", "Less: Disputes"}

# Categories whose accounts are income (everything else is expense).
INCOME_CATEGORIES = {"Revenue", "Other Income"} | CONTRA_REVENUE_CATEGORIES

# Below-the-line income categories (not part of the revenue block).
OTHER_INCOME_CATEGORIES = {"Other Income"}

# Ordered category list driving the income-statement presentation.
PNL_CATEGORY_ORDER = [
    "Revenue",
    "Refunds",
    "Less: Refunds",
    "Reverse Revenue",
    "Less: Disputes",
    "Loss From FNmarkets",
    "Cost Of Services (COS)",
    "Marketing & Promotional Expenses",
    "Operating Expenses (OPEX)",
    "Non-Cash Expense",
    "Finance Expenses",
    "Depreciation",
    "Other Income",
    "Tax",
]

# Code prefix per category (income/expense accounts only).
_CATEGORY_CODE_PREFIX = {
    "Revenue": "40",
    "Refunds": "41",
    "Less: Refunds": "41",
    "Reverse Revenue": "42",
    "Less: Disputes": "43",
    "Loss From FNmarkets": "44",
    "Other Income": "48",
    "Cost Of Services (COS)": "50",
    "Marketing & Promotional Expenses": "60",
    "Operating Expenses (OPEX)": "70",
    "Finance Expenses": "80",
    "Depreciation": "85",
    "Non-Cash Expense": "86",
    "Tax": "90",
}
_DEFAULT_EXPENSE_PREFIX = "79"   # catch-all for unmapped expense categories
_DEFAULT_INCOME_PREFIX = "49"    # catch-all for unmapped income categories

# ──────────────────────────────────────────────────────────────────────────
# Static Balance-Sheet accounts (prop-firm chart)
# ──────────────────────────────────────────────────────────────────────────
BALANCE_SHEET_ACCOUNTS: List[dict] = [
    # Assets
    {"code": "1010", "name": "Cash & Bank Accounts",            "type": "asset",     "category": "Current Assets",      "subcategory": "Cash"},
    {"code": "1020", "name": "Challenge Fees Receivable",       "type": "asset",     "category": "Current Assets",      "subcategory": "Receivables"},
    {"code": "1030", "name": "Commission Receivable",           "type": "asset",     "category": "Current Assets",      "subcategory": "Receivables"},
    {"code": "1040", "name": "Platform Subscriptions Receivable","type": "asset",    "category": "Current Assets",      "subcategory": "Receivables"},
    {"code": "1100", "name": "Trading Platforms (Capital)",     "type": "asset",     "category": "Non-Current Assets",  "subcategory": "PP&E"},
    {"code": "1110", "name": "Accumulated Depreciation",        "type": "asset",     "category": "Non-Current Assets",  "subcategory": "PP&E"},
    {"code": "1200", "name": "Goodwill",                        "type": "asset",     "category": "Non-Current Assets",  "subcategory": "Intangibles"},
    {"code": "1300", "name": "Intangible Assets",               "type": "asset",     "category": "Non-Current Assets",  "subcategory": "Intangibles"},
    # Liabilities
    {"code": "2010", "name": "Trader Profit Share Payable",     "type": "liability", "category": "Current Liabilities", "subcategory": "Payables"},
    {"code": "2020", "name": "Deferred Revenue (Challenges)",   "type": "liability", "category": "Current Liabilities", "subcategory": "Deferred"},
    {"code": "2030", "name": "Accrued Expenses",                "type": "liability", "category": "Current Liabilities", "subcategory": "Accruals"},
    {"code": "2040", "name": "Platform Provider Payable",       "type": "liability", "category": "Current Liabilities", "subcategory": "Payables"},
    {"code": "2050", "name": "Broker/Liquidity Payable",        "type": "liability", "category": "Current Liabilities", "subcategory": "Payables"},
    {"code": "2100", "name": "Short-term Debt",                 "type": "liability", "category": "Current Liabilities", "subcategory": "Debt"},
    {"code": "2200", "name": "Long-term Debt",                  "type": "liability", "category": "Non-Current Liab.",   "subcategory": "Debt"},
    # Equity
    {"code": "3010", "name": "Common Stock",                    "type": "equity",    "category": "Equity",              "subcategory": "Contributed"},
    {"code": "3020", "name": "Additional Paid-in Capital",      "type": "equity",    "category": "Equity",              "subcategory": "Contributed"},
    {"code": "3100", "name": "Retained Earnings",               "type": "equity",    "category": "Equity",              "subcategory": "Retained"},
]

# Account code used as the balancing (clearing) leg for seeded P&L entries.
CLEARING_ACCOUNT_CODE = "1010"

# ──────────────────────────────────────────────────────────────────────────
# RAW P&L DATASET  (NEXT Ventures Ltd., source: pnlCategory.md)
# Each row: (Category, Subcategory, Ledger, [May, Apr, Mar, Feb, Jan])
# Blank source cells are recorded as 0.0. Negative = contra (refunds/disputes/loss).
# ──────────────────────────────────────────────────────────────────────────
PNL_ROWS = [
    # ── Cost Of Services (COS) ───────────────────────────────────────────
    ("Cost Of Services (COS)", "Brokerage Trading Platform & Infrastructure", "Bridge Provider",                 [53000.00, 0.0, 0.0, 7061.29, 0.0]),
    ("Cost Of Services (COS)", "Brokerage Trading Platform & Infrastructure", "KYC Service Cost-FNmarkets",      [0.0, 0.0, 0.0, 0.0, 2154.50]),
    ("Cost Of Services (COS)", "Brokerage Trading Platform & Infrastructure", "LP Fees",                         [2308.52, 2728.85, 3205.52, 1925.86, 32960.20]),
    ("Cost Of Services (COS)", "Brokerage Trading Platform & Infrastructure", "Technology Infrastructure Cost",  [215.99, 1000.00, 960.41, 11179.76, 2784.33]),
    ("Cost Of Services (COS)", "Brokerage Trading Platform & Infrastructure", "Trading Platform Cost-FNmarkets", [0.0, 17127.00, 15500.00, 31647.00, 30020.00]),
    ("Cost Of Services (COS)", "Payouts FundedNext", "Payouts FN CFD",                                          [2883067.23, 6403619.52, 8696690.56, 9560387.52, 10909225.91]),
    ("Cost Of Services (COS)", "Payouts FundedNext", "Payouts FN Futures",                                      [2709804.73, 4971689.24, 5954547.39, 5678503.48, 10491282.48]),
    ("Cost Of Services (COS)", "Prop Trading Platform & Infrastructure", "Bridge Provider",                      [0.0, 56269.06, 53000.00, 53000.00, 53000.00]),
    ("Cost Of Services (COS)", "Prop Trading Platform & Infrastructure", "KYC Service Cost-FundedNext",          [367.20, 11308.85, 22088.35, 707.40, 699.30]),
    ("Cost Of Services (COS)", "Prop Trading Platform & Infrastructure", "Trading Platform Cost",                [7449.00, 0.0, 0.0, 0.0, 0.0]),
    ("Cost Of Services (COS)", "Prop Trading Platform & Infrastructure", "Trading Platform Cost-FundedNext",     [0.0, 786769.00, 961830.00, 831103.00, 895473.00]),
    ("Cost Of Services (COS)", "SAAS Cost-COS", "SAAS Cost-COS",                                                [61767.78, 98988.72, 27581.78, 122269.46, 24085.75]),
    ("Cost Of Services (COS)", "Server Cost", "Server Cost",                                                    [22017.45, 115521.49, 102642.03, 105280.03, 117692.05]),
    # ── Depreciation ─────────────────────────────────────────────────────
    ("Depreciation", "Depreciation", "Depreciation",                                                           [0.0, 24536.46, 56801.83, 24203.07, 23529.54]),
    # ── Finance Expenses ─────────────────────────────────────────────────
    ("Finance Expenses", "Bank Charges", "Bank Charges",                                                       [43.43, 15.86, 11.33, 10.45, 46.66]),
    ("Finance Expenses", "Bank Charges", "Excise Duty",                                                        [0.0, 0.0, 0.0, 0.0, 40.82]),
    ("Finance Expenses", "Fees And Charges", "Fees And Charges FNmarkets",                                      [1486.96, 1974.75, 1679.86, 1583.03, 2816.35]),  # merges 'FEES AND CHARGES FNMARKETS' 1321.90 (May) + 165.06
    ("Finance Expenses", "Fees And Charges", "Fees And Charges FundedNext",                                    [269290.87, 632883.34, 738634.09, 765342.67, 908234.49]),
    # ── Marketing & Promotional Expenses ─────────────────────────────────
    ("Marketing & Promotional Expenses", "Advertising Expenses", "Advertising Expenses",                       [14536.32, 961407.29, 1304194.94, 873494.86, 951588.35]),
    ("Marketing & Promotional Expenses", "Advertising Expenses", "Branding & Promotions-PR Publication & Releases", [0.0, 1.42, 0.0, 0.0, 0.0]),
    ("Marketing & Promotional Expenses", "Advertising Expenses", "Introducing Brokers",                        [0.0, 0.0, 11713.36, 6141.74, 752.00]),
    ("Marketing & Promotional Expenses", "Advertising Expenses", "Telemarketing Expense",                      [900.00, 200.00, 1600.00, 1000.00, 1000.00]),
    ("Marketing & Promotional Expenses", "Affiliate Marketing", "Affiliate Marketing",                         [0.0, 0.0, 0.0, 704.00, 0.0]),
    ("Marketing & Promotional Expenses", "Affiliate Payouts", "Affiliate Payouts",                             [0.0, 0.0, 0.0, 34044.14, 0.0]),
    ("Marketing & Promotional Expenses", "Community & Partner Management Expense", "Affiliate Marketing",       [0.0, 0.0, 0.0, 368660.68, 424061.64]),
    ("Marketing & Promotional Expenses", "Community & Partner Management Expense", "Affiliate Payouts",         [0.0, 0.0, 0.0, 394744.94, 323079.16]),
    ("Marketing & Promotional Expenses", "Community & Partner Management Expense", "Branding & Promotions-PR Publication & Releases", [399.00, 26386.47, 38578.69, 14950.35, 0.0]),
    ("Marketing & Promotional Expenses", "Community & Partner Management Expense", "Branding & Promotions-Sponsorship Fee", [0.0, 521.55, 0.0, 1268.37, 0.0]),
    ("Marketing & Promotional Expenses", "Community & Partner Management Expense", "Event Management Expense",  [0.0, 302.02, 0.0, 0.0, 3721.53]),
    ("Marketing & Promotional Expenses", "Community & Partner Management Expense", "Event Management Expense-Gift Expense", [0.0, 16.33, 0.0, 0.0, 314.47]),
    ("Marketing & Promotional Expenses", "Community & Partner Management Expense", "Global CSR",                [0.0, 0.0, 0.0, 215.41, 0.0]),
    ("Marketing & Promotional Expenses", "Community & Partner Management Expense", "Partner Management",        [366559.23, 637020.82, 608632.14, 0.0, 0.0]),
    ("Marketing & Promotional Expenses", "Community & Partner Management Expense", "Podcast",                   [0.0, 0.0, 0.0, 484.62, 502.00]),
    ("Marketing & Promotional Expenses", "Freelancer Expenses", "Content Creator",                             [10392.00, 15148.61, 10274.31, 8747.66, 16474.87]),
    ("Marketing & Promotional Expenses", "Freelancer Expenses", "Freelancer Expenses",                         [2375.00, 2185.47, 2029.34, 3117.61, 2810.35]),
    ("Marketing & Promotional Expenses", "Freelancer Expenses", "Translator",                                  [25.40, 704.97, 483.90, 0.0, 604.83]),
    ("Marketing & Promotional Expenses", "SAAS Cost-Marketing", "SAAS Cost-Marketing",                         [3648.18, 7552.00, 1191.14, 2966.89, 3067.59]),
    # ── Non-Cash Expense ─────────────────────────────────────────────────
    ("Non-Cash Expense", "Competition Reward Accounts Expense", "Competition Reward Accounts Expense",         [0.0, 8000.00, 8000.00, 8000.00, 8000.00]),
    ("Non-Cash Expense", "Giveaway Account Expense", "Giveaway Account Expense",                               [0.0, 4785.00, 19775.00, 14616.00, 31516.00]),
    # ── Operating Expenses (OPEX) ────────────────────────────────────────
    ("Operating Expenses (OPEX)", "Computer Accessories", "Computer Accessories",                              [21.74, 146.88, 149.37, 0.0, 276.39]),
    ("Operating Expenses (OPEX)", "Consultancy Expenses", "Consultancy Fee",                                   [2931.31, 49665.89, 4586.47, 24976.31, 7344.17]),
    ("Operating Expenses (OPEX)", "Delivery And Courier Expense", "Delivery And Courier Expense",              [100.01, 15.17, 21.72, 403.38, 1485.17]),
    ("Operating Expenses (OPEX)", "Employee Welfare", "Birthday Cake",                                         [25.38, 566.06, 203.73, 397.14, 449.37]),
    ("Operating Expenses (OPEX)", "Employee Welfare", "Cricket Field Expense",                                 [34.53, 0.0, 0.0, 79.63, 0.0]),
    ("Operating Expenses (OPEX)", "Employee Welfare", "Employee Engagement Expense",                           [0.0, 0.0, 0.0, 444.02, 174.36]),
    ("Operating Expenses (OPEX)", "Employee Welfare", "Employee Topup-Vending Machine",                        [3741.12, 586.73, 2990.73, 3656.84, 3726.89]),
    ("Operating Expenses (OPEX)", "Employee Welfare", "Employee Trust Fund Expense",                           [0.0, 0.0, 0.0, 228.00, 131.89]),
    ("Operating Expenses (OPEX)", "Employee Welfare", "Employee Welfare",                                      [2492.04, 7659.91, 5770.79, 4927.75, 4464.85]),
    ("Operating Expenses (OPEX)", "Employee Welfare", "Football Field Expense",                                [0.0, 81.64, 73.46, 40.82, 81.64]),
    ("Operating Expenses (OPEX)", "Employee Welfare", "Honeymoon Package",                                     [0.0, 897.96, 538.78, 448.98, 179.59]),
    ("Operating Expenses (OPEX)", "Employee Welfare", "Lunch Expense",                                         [2678.98, 7560.54, 7091.75, 4718.45, 10740.13]),
    ("Operating Expenses (OPEX)", "Employee Welfare", "Stimulus Bonus",                                        [0.0, 2076.51, 187.76, 9442.35, 1534.70]),
    ("Operating Expenses (OPEX)", "Employee Welfare-Gift Expense", "Gift Expense",                             [5710.10, 0.0, 0.0, 0.0, 0.0]),
    ("Operating Expenses (OPEX)", "Entertainment Expense", "Entertainment Expense",                            [0.0, 1329.82, 0.0, 276.46, 126.44]),
    ("Operating Expenses (OPEX)", "Entertainment Expense", "Guest Lunch Expense",                              [0.0, 15.10, 38.12, 0.0, 0.0]),
    ("Operating Expenses (OPEX)", "Entertainment Expense", "Lunch Expense",                                    [0.0, 0.0, 0.0, 17.20, 0.0]),
    ("Operating Expenses (OPEX)", "ERP Implementation", "ERP Implementation",                                 [0.0, 25440.00, 0.0, 0.0, 0.0]),
    ("Operating Expenses (OPEX)", "Internet Service Expense", "Internet Service Expense",                      [-289.66, 4588.02, 4599.39, 4966.36, 7517.93]),
    ("Operating Expenses (OPEX)", "Legal Expense", "Commissions and Fees",                                     [7147.72, 0.0, 0.0, 0.0, 0.0]),
    ("Operating Expenses (OPEX)", "Legal Expense", "Legal Expense",                                            [0.0, 16901.32, 15.15, 0.0, 2339.18]),
    ("Operating Expenses (OPEX)", "Medication Expense", "Medication Expense",                                  [0.0, 8.50, 0.0, 0.0, 2.42]),
    ("Operating Expenses (OPEX)", "Mobile Expense", "Mobile Expense",                                          [0.0, 33.42, 81.69, 20.35, 366.37]),
    ("Operating Expenses (OPEX)", "Office Supplies And Stationaries Expense", "Office Supplies And Stationaries Expense", [2666.38, 3284.42, 14878.61, 5328.81, 6535.15]),
    ("Operating Expenses (OPEX)", "Printing And Postage Expense", "Printing And Postage Expense",              [44.67, 0.0, 190.67, 20.80, 762.47]),
    ("Operating Expenses (OPEX)", "Recruitment Expense", "Recruitment Expense",                               [340.84, 5487.57, 280.50, 25391.64, 78767.41]),
    ("Operating Expenses (OPEX)", "Registration And Renewal Expense", "Registration And Renewal Expense",      [0.0, 13617.58, 1202.00, 1651.02, 4110.94]),
    ("Operating Expenses (OPEX)", "Rent Expense", "Office Rent-Bangladesh",                                    [23630.89, 23167.41, 23167.41, 23167.41, 23167.41]),
    ("Operating Expenses (OPEX)", "Rent Expense", "Office Rent-Cyprus",                                        [0.0, 1697.43, 0.0, 0.0, 1257.13]),
    ("Operating Expenses (OPEX)", "Rent Expense", "Office Rent-Malaysia",                                      [18915.45, 18915.45, 22232.55, 23121.85, 22996.98]),  # merges OFFICE RENT-MALAYSIA / Office Rent-malaysia variants
    ("Operating Expenses (OPEX)", "Rent Expense", "Office Rent-Srilanka",                                      [16849.95, 17474.03, 16798.00, 17114.57, 17098.54]),
    ("Operating Expenses (OPEX)", "Rent Expense", "Office Rent-UAE",                                           [11912.86, 0.0, 0.0, 0.0, 0.0]),
    ("Operating Expenses (OPEX)", "Rent Expense", "Rent-Car Parking",                                          [0.0, 32.41, 32.54, 33.15, 33.12]),
    ("Operating Expenses (OPEX)", "Rent Expense", "Vending Machine",                                           [586.73, 3305.08, 586.73, 586.73, 586.73]),
    ("Operating Expenses (OPEX)", "Repair And Maintenance", "Repair And Maintenance",                          [114.96, 911.67, 911.26, 1003.81, 1080.55]),
    ("Operating Expenses (OPEX)", "Research And Development", "Competitor Analysis",                           [0.0, 98.50, 98.50, 118.70, 49.00]),
    ("Operating Expenses (OPEX)", "SAAS Cost-OPEX", "SAAS Cost-OPEX",                                          [47741.09, 130803.76, 112991.42, 62531.31, 82821.43]),
    ("Operating Expenses (OPEX)", "Salaries And Allowances", "Car Allowance",                                  [0.0, 3673.47, 3673.47, 3673.47, 3673.47]),
    ("Operating Expenses (OPEX)", "Salaries And Allowances", "Health Insurance",                               [5190.57, 1036.33, 0.0, 2898.42, 0.0]),  # merges duplicate Health Insurance rows
    ("Operating Expenses (OPEX)", "Salaries And Allowances", "Leave Encashment",                               [0.0, 58645.98, 0.0, 0.0, 0.0]),
    ("Operating Expenses (OPEX)", "Salaries And Allowances", "Overtime Expense",                               [0.0, 14074.63, 6986.70, 1632.65, 2392.38]),
    ("Operating Expenses (OPEX)", "Salaries And Allowances", "Provident Fund Expense",                         [0.0, 15219.27, 9378.32, 8614.62, 8330.17]),  # merges Providend/Provident, Trust Fund(232.32 Apr) excluded->separate
    ("Operating Expenses (OPEX)", "Salaries And Allowances", "Employee Trust Fund Expense",                    [0.0, 232.32, 0.0, 0.0, 0.0]),
    ("Operating Expenses (OPEX)", "Salaries And Allowances", "Salary Expense",                                 [11705.48, 942689.56, 475296.01, 577785.38, 529058.49]),
    ("Operating Expenses (OPEX)", "Salaries And Allowances", "Trainee Allowance",                              [0.0, 0.0, 195.92, 587.76, 0.0]),
    ("Operating Expenses (OPEX)", "Service Charge", "Security Service Expense",                                [0.0, 934.24, 1305.58, 939.35, 955.47]),
    ("Operating Expenses (OPEX)", "Service Charge", "Service Charge",                                          [3274.25, 3761.16, 3806.32, 3741.15, 3741.29]),
    ("Operating Expenses (OPEX)", "Software Maintenance Fee", "Software Maintenance Fee",                      [0.0, 171.43, 171.43, 23166.43, 171.43]),
    ("Operating Expenses (OPEX)", "Test Transactions", "Test Transactions",                                   [132.64, 6.32, 4.17, 84.17, 0.75]),
    ("Operating Expenses (OPEX)", "Tours And Travels Expense", "Tours And Travels Expense",                    [11682.91, 48621.26, 25756.18, 8075.80, 87140.51]),
    ("Operating Expenses (OPEX)", "Training And Course Materials", "Training And Course Materials",            [479.99, 47.00, 54.60, 2664.22, 2622.81]),
    ("Operating Expenses (OPEX)", "Transportation Expense", "Transportation Expense",                          [94.67, 37.37, 34.93, 194.12, 176.04]),
    ("Operating Expenses (OPEX)", "Travel Allowance", "Travel Allowance",                                      [0.0, 0.0, 0.0, 0.0, 388.18]),
    ("Operating Expenses (OPEX)", "Utility Expense", "Utility Expense",                                        [972.80, 7993.45, 7364.24, 4595.93, 4842.00]),
    ("Operating Expenses (OPEX)", "Vehicle Fuel Expense", "Vehicle Fuel Expense",                             [0.0, 0.0, 0.0, 0.0, 31.84]),
    # ── Other Income ─────────────────────────────────────────────────────
    ("Other Income", "Bank Interest Income", "Accrued Interest Income",                                       [0.0, 0.0, 0.0, 0.0, 8309.62]),
    ("Other Income", "Bank Interest Income", "Interest Income",                                               [0.0, 499.18, 275.16, 280.34, 1891.24]),
    # ── Revenue (incl. contra: refunds / disputes / losses) ──────────────
    ("Revenue", "Revenue FundedNext", "Revenue FN CFDs",                                                     [5830742.56, 11591232.08, 14674189.54, 13432402.26, 16013117.38]),
    ("Revenue", "Revenue FundedNext", "Revenue FN Futures",                                                  [4363282.02, 6803529.97, 7489044.74, 7633143.12, 10062953.93]),
    ("Revenue", "Revenue FNmarkets", "Revenue FNmarkets",                                                    [100817.07, 140168.72, 119660.72, 130813.52, 75622.71]),
    ("Revenue", "Loss From FNmarkets", "Loss From FNmarkets",                                                [-56198.60, -56724.63, -17656.18, -10428.96, 0.0]),
    ("Revenue", "Less: Refunds", "Refunds FN",                                                               [-35117.14, -55399.51, -111314.25, -100087.08, -157861.22]),
    ("Revenue", "Less: Disputes", "Disputes FN",                                                             [-43007.76, -114434.59, -165341.84, -136845.71, -155411.34]),
    ("Revenue", "Less: Disputes", "Disputes FN Futures",                                                     [-13206.43, -20871.64, -41209.82, 0.0, 0.0]),
    ("Revenue", "Less: Disputes", "Disputes FN Win",                                                         [0.0, 18930.19, 17698.04, 13298.34, 12523.47]),  # recoveries (positive)
    # ── Tax ──────────────────────────────────────────────────────────────
    ("Tax", "Tax Expense", "Tax Expense",                                                                    [0.0, 0.0, 0.0, 0.0, 69931.81]),
]


# ──────────────────────────────────────────────────────────────────────────
# Derivation helpers
# ──────────────────────────────────────────────────────────────────────────
def _account_type(category: str) -> str:
    return "income" if category in INCOME_CATEGORIES else "expense"


def build_pnl_accounts() -> List[dict]:
    """Derive one account per unique (category, subcategory, ledger) in PNL_ROWS.

    Codes are deterministic: <category-prefix><running 2-digit index>.
    """
    seen: Dict[str, dict] = {}
    counters: Dict[str, int] = {}
    accounts: List[dict] = []
    for category, subcategory, ledger, _amts in PNL_ROWS:
        key = f"{category}||{subcategory}||{ledger}"
        if key in seen:
            continue
        prefix = _CATEGORY_CODE_PREFIX[category]
        counters[prefix] = counters.get(prefix, 0) + 1
        code = f"{prefix}{counters[prefix]:02d}"
        acc = {
            "code": code,
            "name": ledger,
            "type": _account_type(category),
            "category": category,
            "subcategory": subcategory,
            "cost_center": CATEGORY_COST_CENTER.get(category, "CORP"),
        }
        seen[key] = acc
        accounts.append(acc)
    return accounts


def build_chart_of_accounts() -> List[dict]:
    """Full prop-firm Chart of Accounts: balance-sheet accounts + P&L accounts."""
    bs = [dict(a, cost_center="") for a in BALANCE_SHEET_ACCOUNTS]
    return bs + build_pnl_accounts()


# Materialised once at import time.
CHART_OF_ACCOUNTS: List[dict] = build_chart_of_accounts()

# code -> account metadata, for fast lookup by seed script / server.
ACCOUNT_BY_CODE: Dict[str, dict] = {a["code"]: a for a in CHART_OF_ACCOUNTS}


# ──────────────────────────────────────────────────────────────────────────
# Generic helpers used by the real-data importer (import_next_data.py)
# ──────────────────────────────────────────────────────────────────────────
def _category_prefix(category: str) -> str:
    if category in _CATEGORY_CODE_PREFIX:
        return _CATEGORY_CODE_PREFIX[category]
    return _DEFAULT_INCOME_PREFIX if category in INCOME_CATEGORIES else _DEFAULT_EXPENSE_PREFIX


def _category_order_index(category: str) -> int:
    return PNL_CATEGORY_ORDER.index(category) if category in PNL_CATEGORY_ORDER else 999


def derive_accounts_from_triples(triples) -> List[dict]:
    """Build a deterministic Chart of Accounts from (category, subcategory, ledger)
    tuples taken from real data. Codes: <category-prefix><3-digit running index>,
    assigned in a stable order (category order, then subcategory, then ledger).
    Returns balance-sheet accounts + the derived income/expense accounts.
    """
    uniq = sorted(set(triples), key=lambda t: (_category_order_index(t[0]), t[0], t[1], t[2]))
    counters: Dict[str, int] = {}
    pnl_accounts: List[dict] = []
    for category, subcategory, ledger in uniq:
        prefix = _category_prefix(category)
        counters[prefix] = counters.get(prefix, 0) + 1
        pnl_accounts.append({
            "code": f"{prefix}{counters[prefix]:03d}",
            "name": ledger,
            "type": _account_type(category),
            "category": category,
            "subcategory": subcategory,
            "cost_center": CATEGORY_COST_CENTER.get(category, ""),
        })
    bs = [dict(a, cost_center="") for a in BALANCE_SHEET_ACCOUNTS]
    return bs + pnl_accounts


def parse_amount(raw) -> float:
    """Parse a source amount cell: '$ 1,234.56', '$ (48.55)', '-', '' -> float."""
    s = str(raw).replace("$", "").replace(",", "").strip()
    if not s or s == "-":
        return 0.0
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()").replace(" ", "")
    try:
        v = float(s)
    except ValueError:
        return 0.0
    return -v if neg else v


_MONTH_ABBR = {m: f"{i:02d}" for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], start=1)}


def parse_date(raw: str) -> str:
    """Parse '01-Jan-2026' -> ISO '2026-01-01'. Falls back to the raw string."""
    raw = (raw or "").strip()
    parts = raw.split("-")
    if len(parts) == 3 and parts[1][:3] in _MONTH_ABBR:
        d, mon, y = parts
        return f"{y}-{_MONTH_ABBR[mon[:3]]}-{int(d):02d}"
    return raw


def month_label_to_iso(label: str) -> str:
    """'Jan-2026' -> '2026-01'."""
    parts = (label or "").split("-")
    if len(parts) == 2 and parts[0][:3] in _MONTH_ABBR:
        return f"{parts[1]}-{_MONTH_ABBR[parts[0][:3]]}"
    return label


def posting_sides(category: str, amount: float):
    """Return (primary_side, clearing_side, magnitude) for one source row.

    Income (Revenue/Other Income): positive -> credit revenue.
    Contra revenue (Refunds/Reverse Revenue/Loss): positive -> debit (reduces revenue).
    Expense: positive -> debit expense.
    Negative source amounts flip the side. Magnitude is always non-negative.
    """
    acc_type = _account_type(category)
    if acc_type == "income":
        # desired signed effect on the income account
        desired = -amount if category in CONTRA_REVENUE_CATEGORIES else amount
        primary = "credit" if desired >= 0 else "debit"
        mag = abs(desired)
    else:
        primary = "debit" if amount >= 0 else "credit"
        mag = abs(amount)
    clearing = "debit" if primary == "credit" else "credit"
    return primary, clearing, round(mag, 2)
