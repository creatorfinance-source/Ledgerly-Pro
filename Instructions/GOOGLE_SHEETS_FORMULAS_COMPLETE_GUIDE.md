# GOOGLE SHEETS ACCOUNTING SYSTEM
## Step-by-Step Formula Implementation Guide

### For Prop Trading Firms (BROCTAGON Model)

---

## 🔧 GOOGLE SHEETS SPECIFIC FORMULAS

### **SECTION 1: GENERAL LEDGER (GL Sheet)**

**Setup:**
- Column A: Account Code (from CoA)
- Column B: Account Name (from CoA)
- Column C: Cost Center
- Column D: Debit Total (this period)
- Column E: Credit Total (this period)
- Column F: Balance (Debit - Credit)

**Formula 1: Auto-Fetch Debit Amounts**
```
In Cell D2 (for account code in A2, cost center in C2):

=SUMIFS('Journal Entries'!$F:$F,
        'Journal Entries'!$D:$D, A2,
        'Journal Entries'!$C:$C, C2)

Explanation:
- Sums all F column (Debit amounts)
- Where D column (Account Code) = A2
- AND C column (Cost Center) = C2
```

**Formula 2: Auto-Fetch Credit Amounts**
```
In Cell E2:

=SUMIFS('Journal Entries'!$G:$G,
        'Journal Entries'!$D:$D, A2,
        'Journal Entries'!$C:$C, C2)

Explanation:
- Same as above but Column G (Credit amounts)
```

**Formula 3: Calculate Balance**
```
In Cell F2:

=D2-E2

Explanation:
- Debit balance = Total Debits - Total Credits
- For typical accounts (assets, expenses)
```

---

### **SECTION 2: TRIAL BALANCE (TB Sheet)**

**Setup:**
- Column A: Account Code
- Column B: Account Name
- Column C: Debit Total (all cost centers combined)
- Column D: Credit Total (all cost centers combined)
- Column E: Balance

**Formula 1: Consolidated Debit Amount**
```
In Cell C2:

=SUMIF('General Ledger'!$A:$A, A2, 'General Ledger'!$D:$D)

Explanation:
- Sums all debits from GL where account code matches
- Combines all cost centers for this account
```

**Formula 2: Consolidated Credit Amount**
```
In Cell D2:

=SUMIF('General Ledger'!$A:$A, A2, 'General Ledger'!$E:$E)

Explanation:
- Same as debit but for credits
```

**Formula 3: Account Balance**
```
In Cell E2:

=C2-D2

Explanation:
- Net balance: Debits minus Credits
```

**Formula 4: Verify Balance (Put in Last Row)**
```
In Cell C999:
=SUM(C2:C998)

In Cell D999:
=SUM(D2:D998)

Then check: C999 should = D999 (balanced)
```

---

### **SECTION 3: INCOME STATEMENT (IS Sheet)**

**Setup:**
- Column A: Account/Line Item
- Column B: Amount
- Column C: % of Revenue (optional)

**Formula 1: Total Revenues (Sum all 40xx accounts)**
```
In Cell B10 (after listing revenue items):

=SUMIF('Trial Balance'!$A:$A,"40*",'Trial Balance'!$D:$D)

Explanation:
- Sums credits from TB (column D)
- Where account code starts with "40" (4010, 4020, etc.)
- Credits represent revenue increases
```

**Formula 2: Total Expenses (Sum all 50xx accounts)**
```
In Cell B20 (after listing expense items):

=SUMIF('Trial Balance'!$A:$A,"50*",'Trial Balance'!$C:$C)

Explanation:
- Sums debits from TB (column C)
- Where account code starts with "50" (5010, 5020, etc.)
- Debits represent expense increases
```

**Formula 3: Operating Income**
```
In Cell B25:

=B10-B20

Explanation:
- Gross Profit = Total Revenue - Total Expenses
```

**Formula 4: Interest Expense**
```
In Cell B26:

=SUMIF('Trial Balance'!$A:$A,"60*",'Trial Balance'!$C:$C)

Explanation:
- 6000 series are financing costs
```

**Formula 5: Net Income Before Tax**
```
In Cell B27:

=B25-B26

Explanation:
- Operating Income - Interest Expense
```

**Formula 6: Tax Expense (assume 21%)**
```
In Cell B28:

=IF(B27>0, B27*0.21, 0)

Explanation:
- If income is positive, calculate 21% tax
- If loss, no tax expense
```

**Formula 7: Net Income**
```
In Cell B29:

=B27-B28

Explanation:
- Net Income = Income Before Tax - Tax Expense
```

**Formula 8: Profit Margin %**
```
In Cell C29:

=IF(B10=0, 0, B29/B10)

Explanation:
- Profit Margin = Net Income / Total Revenue
- Protect against zero revenue division
- Format as percentage
```

---

### **SECTION 4: BALANCE SHEET (BS Sheet)**

**Setup:**
- Column A: Item
- Column B: Amount

**Formula 1: Total Current Assets**
```
In Cell B5:

=SUMIF('Trial Balance'!$A:$A,"101*",'Trial Balance'!$E:$E)+
 SUMIF('Trial Balance'!$A:$A,"102*",'Trial Balance'!$E:$E)+
 SUMIF('Trial Balance'!$A:$A,"103*",'Trial Balance'!$E:$E)+
 SUMIF('Trial Balance'!$A:$A,"104*",'Trial Balance'!$E:$E)

Explanation:
- Sums balances (column E) from TB
- For accounts 1010-1049 (current assets)
- Uses account code patterns
```

**Formula 2: Total Non-Current Assets (Simplified)**
```
In Cell B10:

=SUMIF('Trial Balance'!$A:$A,"11*",'Trial Balance'!$E:$E)+
 SUMIF('Trial Balance'!$A:$A,"12*",'Trial Balance'!$E:$E)+
 SUMIF('Trial Balance'!$A:$A,"13*",'Trial Balance'!$E:$E)

Explanation:
- Sums accounts 1100-1399 (non-current assets)
```

**Formula 3: Total Assets**
```
In Cell B12:

=B5+B10

Explanation:
- Current Assets + Non-Current Assets
```

**Formula 4: Total Current Liabilities**
```
In Cell B18:

=SUMIF('Trial Balance'!$A:$A,"201*",'Trial Balance'!$E:$E)+
 SUMIF('Trial Balance'!$A:$A,"202*",'Trial Balance'!$E:$E)+
 SUMIF('Trial Balance'!$A:$A,"203*",'Trial Balance'!$E:$E)+
 SUMIF('Trial Balance'!$A:$A,"204*",'Trial Balance'!$E:$E)+
 SUMIF('Trial Balance'!$A:$A,"205*",'Trial Balance'!$E:$E)

Explanation:
- Sums accounts 2010-2050 (current liabilities)
```

**Formula 5: Total Non-Current Liabilities**
```
In Cell B22:

=SUMIF('Trial Balance'!$A:$A,"210*",'Trial Balance'!$E:$E)+
 SUMIF('Trial Balance'!$A:$A,"220*",'Trial Balance'!$E:$E)

Explanation:
- Sums accounts 2100-2200 (non-current liabilities)
```

**Formula 6: Total Liabilities**
```
In Cell B24:

=B18+B22

Explanation:
- Current + Non-Current Liabilities
```

**Formula 7: Total Equity**
```
In Cell B30:

=SUMIF('Trial Balance'!$A:$A,"301*",'Trial Balance'!$E:$E)+
 SUMIF('Trial Balance'!$A:$A,"302*",'Trial Balance'!$E:$E)+
 SUMIF('Trial Balance'!$A:$A,"310*",'Trial Balance'!$E:$E)+
 'Income Statement'!B29

Explanation:
- Sum equity accounts (3010, 3020, 3100)
- Add Net Income from IS
- This creates closing equity
```

**Formula 8: Total Liabilities & Equity (Balance Check)**
```
In Cell B32:

=B24+B30

Explanation:
- Should equal Total Assets (B12)
- If not: you have an error
```

**Formula 9: Balance Check Indicator**
```
In Cell B33:

=IF(B12=B32, "✓ BALANCED", "✗ NOT BALANCED")

Explanation:
- Shows ✓ if assets = liabilities + equity
- Shows ✗ if not balanced
- Format with conditional color (green/red)
```

---

### **SECTION 5: CASH FLOW STATEMENT (CF Sheet)**

**Formula 1: Operating Cash Flow (Simplified)**
```
In Cell B5:

='Income Statement'!B29 + [Adjustments]

Where [Adjustments] includes:
  + Depreciation (5910 from TB)
  - Change in Receivables
  + Change in Payables

Full Formula:
=IF('Income Statement'!B29=0,0,'Income Statement'!B29)+
 SUMIF('Trial Balance'!$A:$A,"591*",'Trial Balance'!$C:$C)-
 ('1020_Current'!B2-'1020_Prior'!B2)+
 ('2010_Current'!B2-'2010_Prior'!B2)

Explanation:
- Start with Net Income
- Add back depreciation (non-cash expense)
- Subtract increase in receivables
- Add increase in payables
```

**Formula 2: Investing Cash Flow**
```
In Cell B15:

=-SUMIF('Journal Entries'!$D:$D,"1100",'Journal Entries'!$F:$F)+
 SUMIF('Journal Entries'!$D:$D,"1100",'Journal Entries'!$G:$G)

Explanation:
- Net of platform investment (account 1100)
- Debits = cash out, Credits = cash in
- Negative = cash spent
```

**Formula 3: Financing Cash Flow**
```
In Cell B25:

=SUMIF('Journal Entries'!$D:$D,"210*",'Journal Entries'!$G:$G)-
 SUMIF('Journal Entries'!$D:$D,"210*",'Journal Entries'!$F:$F)+
 SUMIF('Journal Entries'!$D:$D,"220*",'Journal Entries'!$G:$G)-
 SUMIF('Journal Entries'!$D:$D,"220*",'Journal Entries'!$F:$F)

Explanation:
- Debt proceeds (credits to 2100/2200)
- Minus debt repayment (debits to 2100/2200)
- Plus equity issuance
```

**Formula 4: Net Change in Cash**
```
In Cell B30:

=B5+B15+B25

Explanation:
- Operating + Investing + Financing
- This is the period's cash change
```

**Formula 5: Ending Cash Position**
```
In Cell B32:

=SUMIF('Trial Balance'!$A:$A,"1010",'Trial Balance'!$E:$E)

Explanation:
- Ending cash from TB balance sheet (account 1010)
- Should equal: Beginning Cash + Net Change
```

---

### **SECTION 6: COST CENTER ANALYSIS (CC Analysis Sheet)**

**Setup:**
- Column A: Cost Center Code (CC01-CC11, CORP)
- Column B: Cost Center Name
- Column C: Revenue This Period
- Column D: Expenses This Period
- Column E: Contribution
- Column F: Allocated Overhead
- Column G: Net Contribution

**Formula 1: Revenue by Cost Center**
```
In Cell C2 (for CC01):

=SUMIFS('Journal Entries'!$G:$G,
        'Journal Entries'!$C:$C, A2,
        'Journal Entries'!$D:$D, "40*")

Explanation:
- Sums credits (column G) from Journal Entries
- Where Cost Center (column C) = A2 (CC01, CC02, etc.)
- AND Account Code starts with "40" (revenue accounts)
```

**Formula 2: Expenses by Cost Center**
```
In Cell D2 (for CC01):

=SUMIFS('Journal Entries'!$F:$F,
        'Journal Entries'!$C:$C, A2,
        'Journal Entries'!$D:$D, "50*")

Explanation:
- Sums debits (column F) from Journal Entries
- Where Cost Center = A2
- AND Account Code starts with "50" (expense accounts)
```

**Formula 3: Contribution (Revenue - Expenses)**
```
In Cell E2:

=C2-D2

Explanation:
- Positive = profit-generating
- Negative = support/cost center
```

**Formula 4: Contribution Margin %**
```
In Cell E3 (put this to the right):

=IF(C2=0,0,E2/C2)

Format as percentage (0.0%)
```

**Formula 5: Allocated Overhead**
```
In Cell F2 (for support centers only):

=SUMIFS('Cost Allocation'!$C:$C,
        'Cost Allocation'!$A:$A, A2)

Explanation:
- Pulls allocated amounts from allocation sheet
- For profit centers, = sum of their allocation shares
```

**Formula 6: Net Contribution After Allocation**
```
In Cell G2:

=E2-F2

Explanation:
- Contribution minus their share of support costs
- True departmental profitability
```

---

### **SECTION 7: DASHBOARD / KEY METRICS (Dashboard Sheet)**

**Create High-Level Summary:**

**Formula 1: Key Financial Metrics**
```
In Cell B2 (Total Revenue):
=SUM('Income Statement'!B10)

In Cell B3 (Total Expenses):
=SUM('Income Statement'!B20)

In Cell B4 (Net Income):
='Income Statement'!B29

In Cell B5 (Profit Margin %):
=IF(B2=0,0,B4/B2)
Format as percentage

In Cell B6 (Operating Cash Flow):
='Cash Flow Statement'!B5

In Cell B7 (Cash Position):
=SUMIF('Trial Balance'!$A:$A,"1010",'Trial Balance'!$E:$E)
```

**Formula 2: Revenue Mix by Type**
```
In Cell C2 (Challenge Fees):
=SUMIF('Trial Balance'!$A:$A,"401*",'Trial Balance'!$D:$D)

In Cell C3 (Commission/Spreads):
=SUMIF('Trial Balance'!$A:$A,"405*",'Trial Balance'!$D:$D)+
 SUMIF('Trial Balance'!$A:$A,"406*",'Trial Balance'!$D:$D)

In Cell C4 (Platform Fees):
=SUMIF('Trial Balance'!$A:$A,"407*",'Trial Balance'!$D:$D)

In Cell C5 (Other):
=SUMIF('Trial Balance'!$A:$A,"40*",'Trial Balance'!$D:$D)-
 SUM(C2:C4)

In Cell C6 (Total):
=SUM(C2:C5)
```

**Formula 3: Cost Center Rankings**
```
Create a simple table:
  =SORT('CC Analysis'!A2:G100,
        COLUMN('CC Analysis'!G2),
        FALSE)

Explanation:
- Sorts cost centers by Net Contribution (col G)
- FALSE = descending (highest first)
- Shows which CCs are most profitable
```

---

## 📊 EXAMPLE: COMPLETE JOURNAL ENTRY SET

**Create sample entries in Journal Entries sheet:**

```
Row 2: JE001 | 2024-01-01 | CC01 | 1010 | D | Cash | 15000 | | Challenge fees
Row 3: JE001 | 2024-01-01 | CC01 | 4010 | C | Rev | | 15000 | Challenge fees

Row 4: JE002 | 2024-01-05 | CC02 | 1030 | D | Comm Rec | 5500 | | Spread markup
Row 5: JE002 | 2024-01-05 | CC02 | 4050 | C | Markup Rev | | 5500 | Spread markup

Row 6: JE003 | 2024-01-10 | CC06 | 5100 | D | Salaries | 8000 | | Support payroll
Row 7: JE003 | 2024-01-10 | CORP | 1010 | C | Cash | | 8000 | Support payroll

Row 8: JE004 | 2024-01-15 | CC07 | 5020 | D | Platform Fees | 3500 | | MT4/5 licensing
Row 9: JE004 | 2024-01-15 | CORP | 2040 | C | Platform Pay | | 3500 | MT4/5 licensing
```

---

## ✅ VERIFICATION CHECKLIST

After creating formulas:

- [ ] GL totals match Journal Entry totals (Debits = Credits)
- [ ] TB Debits column total = TB Credits column total
- [ ] IS Net Income flows to BS Retained Earnings
- [ ] BS Assets = Liabilities + Equity
- [ ] CF Ending Cash = Current Cash on BS
- [ ] CC Analysis totals = IS totals
- [ ] All formulas are using correct sheet references
- [ ] No #REF! errors anywhere
- [ ] No #DIV/0! errors (division by zero)
- [ ] All percentages format correctly

---

## 🎯 BEST PRACTICES FOR GOOGLE SHEETS

1. **Use Named Ranges** for frequently referenced cells
   ```
   Data → Named ranges
   Create: "JournalData" = 'Journal Entries'!A:I
   Then use: =SUMIFS(JournalData, ...)
   ```

2. **Protect Sheets** to prevent accidental formula deletion
   ```
   Tools → Protect sheets
   Protect GL, TB, IS, BS, CF sheets
   Allow editing only to Journal Entries
   ```

3. **Use Data Validation** for Cost Center column
   ```
   Select column C in Journal Entries
   Data → Data validation
   List from range: 'Cost Centers'!A:A
   ```

4. **Conditional Formatting** for Balance Check
   ```
   Select balance check cell
   Format → Conditional formatting
   Formula: =B12=B32
   Green if true, Red if false
   ```

5. **Add Comments** to formulas
   ```
   Right-click cell → Add a comment
   Explain what the formula does
   Help others understand your logic
   ```

---

## 🚀 GOOGLE SHEETS ADVANTAGES

✅ Real-time collaboration
✅ Automatic cloud backup
✅ Share with team instantly
✅ Mobile app available
✅ No software installation
✅ Free for small teams
✅ Version history included
✅ Formula suggestions auto-complete

---

**This formula set creates a complete, automated accounting system suitable for prop trading firms with $1M-$20M revenue.**

