---
title: Financial Statements
name: financial-statements
description: Generate financial statements (income statement, balance sheet, cash flow) with period-over-period comparison and variance analysis. Use when preparing a monthly or quarterly P&L, closing the books and need to flag material variances, comparing actuals to budget, building a financial summary for leadership review, or looking up GAAP presentation requirements and period-end adjustments.
argument-hint: <frequency> <period>
---

# /financial-statements

> If you see unfamiliar placeholders or need to check which tools are connected, see [CONNECTORS.md](../../CONNECTORS.md).

**Important**: This command assists with financial statement workflows but does not provide financial advice. All statements should be reviewed by qualified financial professionals before use in reporting or filings.

Generate financial statements with period-over-period comparison and variance analysis. The workflow below walks through income statement generation; balance sheet and cash flow statement reference formats, GAAP presentation requirements (ASC 220/210/230), and common period-end adjustments are included as supporting reference material.

## Usage

```
/financial-statements <period-type> <period>
```

### Arguments

- `period-type` — The reporting period type:
  - `monthly` — Single month P&L with prior month and prior year month comparison
  - `quarterly` — Quarter P&L with prior quarter and prior year quarter comparison
  - `annual` — Full year P&L with prior year comparison
  - `ytd` — Year-to-date P&L with prior year YTD comparison
- `period` — The period to report (e.g., `2024-12`, `2024-Q4`, `2024`)

## Workflow

### 1. Gather Financial Data

If ~~erp or ~~data warehouse is connected:
- Pull trial balance or income statement data for the specified period
- Pull comparison period data (prior period, prior year, budget/forecast)
- Pull account hierarchy and groupings for presentation

If no data source is connected:
> Connect ~~erp or ~~data warehouse to pull financial data automatically. You can also paste trial balance data, upload a spreadsheet, or provide income statement data for analysis.

Prompt the user to provide:
- Current period revenue and expense data (by account or category)
- Comparison period data (prior period, prior year, and/or budget)
- Any known adjustments or reclassifications

### 2. Generate Income Statement

Present in standard multi-column format:

```
                                            NEXT Ventures LTD.
                                        Profit & Loss Statement
                                  For The Month Ended **DD, Mmm, YYYY**
                                   Latest      Last     Variance   Variance   Budget    Budget
                                   Month      Month       ($)        (%)      Amount    Var($)
                                  --------   --------   --------   --------  --------  --------
Revenue
  Revenue FundedNext                $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
     Revenue FN CFDs                $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
     Revenue FN Futures             $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
                                   --------   --------   --------   ------   -------   --------
     Less: Refunds FN              ($XX,XXX)  ($XX,XXX)  ($XX,XXX)   X.X%   ($XX,XXX)  ($X,XXX)

  Revenue FNmarkets                 $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
                                    -------   --------   --------   ------   -------   --------
                    Total Revenue : $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
    Less: Disputes                 ($XX,XXX)  ($XX,XXX)  ($XX,XXX)   X.X%   ($XX,XXX)  ($X,XXX)
                                   --------   --------   --------   ------   -------   --------
                      Net Revenue : $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX

Cost Of Services (COS)
  [COS Category items]              $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
                                   ---------  --------   --------   ------   --------  --------
     Total Cost Of Services (COS) : $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX

                     Gross Profit : $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
                     Gross Margin :  XX.X%      XX.X%      XX.X%     X.X%    $XX,XXX    $X,XXX

Marketing & Promotional Expenses
 Advertising Expenses               $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
    Advertising Expenses            $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
    Telemarketing Expense           $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
    Introducing Brokers             $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
Community & Partner Management Exp  $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
    Partner Management              $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
    Branding & Promotions           $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
    Event Management Expense        $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
    Global CSR                      $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
    Podcast                         $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
Freelancer Expenses                 $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
    Freelancer Expenses             $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
    Translator                      $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
    Content Creator                 $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
SAAS Cost-Marketing                 $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX
                                    --------   --------  --------   ------  --------   --------
Total Marketing & Promotional Expenses : $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX    $X,XXX

Operating Expenses (OPEX)
 Salaries And Allowances            $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Salary Expense                  $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Leave Encashment                $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Car Allowance                   $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Overtime Expense                $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Employee Trust Fund             $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Health Insurance                $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Provident Fund Expense          $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Trainee Allowance               $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Tours And Travels Expense          $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 SAAS Cost-OPEX                     $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Recruitment Expense                $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Rent Expense                       $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Office Rent-Bangladesh          $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Office Rent-Cyprus              $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Office Rent-Malaysia            $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Office Rent-Srilanka            $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Rent-Car Parking                $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Vending Machine                 $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Employee Welfare                   $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Birthday Cake                   $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Employee Engagement Exp         $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Employee Topup-Vending ..       $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Stimulus Bonus                  $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Employee Welfare                $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Cricket Field Expense           $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Football Field Expense          $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Honeymoon Package               $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
    Lunch Expense                   $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Internet Service Expense           $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Consultancy Expenses               $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Office Supplies And Stationaries   $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Event Management Expense           $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Utility Expense                    $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Service Charge                     $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Registration And Renewal Expense   $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Training And Course Materials      $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Legal Expense                      $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Delivery And Courier Expense       $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Repair And Maintenance             $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 ERP Implementation                 $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Printing And Postage Expense       $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Travel Allowance                   $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Mobile Expense                     $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Computer Accessories               $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Transportation Expense             $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Software Maintenance Fee           $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Entertainment Expense              $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Research And Development           $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Vehicle Fuel Expense               $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Medication Expense                 $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Test Transactions                  $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
                                   --------   --------   --------    -----   -------- --------
  Total Operating Expenses (OPEX) : $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
                                   --------   --------   --------    -----   -------- --------
     Total Operating Income(Loss) : $XX,XXX    $XX,XXX    $X,XXX     X.XX%   $XX,XXX   $X,XXX
                 Operating Margin :  X.XX%      X.XX%      X.XX%     X.XX%    X.XX%    X.XX%

Finance Expenses
 Bank Charges                       $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
   Bank Charges                     $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
   Excise Duty                      $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
 Fees And Charges                   $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
   Fees And Charges FundedNext      $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
   Fees And Charges FNmarkets       $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
                                   --------   --------   --------   ------  --------  --------
Total Finance Expenses :            $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX

Depreciation                        $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
                                   --------   --------   --------   ------  --------  --------
     Income Before Interest & Tax : $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX

Other Income (Expense)
   Bank Interest income             $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
     Accrued Interest Income        $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
     Interest Income                $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
   Other Interest Expense          ($XX,XXX)  ($XX,XXX)   $X,XXX     X.X%    $XX,XXX   $X,XXX
                                   --------   --------   --------   ------   -------  --------
      Net Profit(Loss) Before Tax : $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX

Tax expense                         $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
                                   --------   --------   --------   ------   -------  --------
                Net Profit (Loss) : $XX,XXX    $XX,XXX    $X,XXX     X.X%    $XX,XXX   $X,XXX
                                   --------   --------   --------   ------   -------  --------
                                   --------   --------   --------   ------   -------  -------- 
```

### 3. Variance Analysis

For each line item, calculate and flag material variances.

#### Variance Calculation

For each line item, calculate:
- **Dollar variance:** Current period - Prior period (or current period - budget)
- **Percentage variance:** (Current - Prior) / |Prior| x 100
- **Basis point change:** For margins and ratios, express change in basis points (1 bp = 0.01%)

#### Materiality Thresholds

Define what constitutes a "material" variance requiring investigation. Common approaches:

- **Fixed dollar threshold:** Variances exceeding a set dollar amount (e.g., $50K, $100K)
- **Percentage threshold:** Variances exceeding a set percentage (e.g., 10%, 15%)
- **Combined:** Either the dollar OR percentage threshold is exceeded
- **Scaled:** Different thresholds for different line items based on their size and volatility

*Example thresholds (adjust for your organization):*

| Line Item Size | Dollar Threshold | Percentage Threshold |
|---------------|-----------------|---------------------|
| > $10M        | $500K           | 5%                  |
| $1M - $10M    | $100K           | 10%                 |
| < $1M         | $50K            | 15%                 |

#### Variance Decomposition

Break down total variance into component drivers:

- **Volume/quantity effect:** Change in volume at prior period rates
- **Rate/price effect:** Change in rate/price at current period volume
- **Mix effect:** Shift in composition between items with different rates/margins
- **New/discontinued items:** Items present in one period but not the other
- **One-time/non-recurring items:** Items that are not expected to repeat
- **Timing effect:** Items shifting between periods (not a true change in run rate)
- **Currency effect:** Impact of FX rate changes on translated results

#### Investigation and Narrative

For each material variance:
1. Quantify the variance ($ and %)
2. Identify whether favorable or unfavorable
3. Decompose into drivers using the categories above
4. Provide a narrative explanation of the business reason
5. Assess whether the variance is temporary or represents a trend change
6. Note any actions required (further investigation, forecast update, process change)

### 4. Key Metrics Summary

```
KEY METRICS
                              Current    Prior      Change
Revenue growth (%)                                  X.X%
Gross margin (%)              XX.X%      XX.X%      X.X pp
Operating margin (%)          XX.X%      XX.X%      X.X pp
Net margin (%)                XX.X%      XX.X%      X.X pp
OpEx as % of revenue          XX.X%      XX.X%      X.X pp
Effective tax rate (%)        XX.X%      XX.X%      X.X pp
```

### 5. Material Variance Summary

List all material variances requiring investigation:

| Line Item | Variance ($) | Variance (%) | Direction | Preliminary Driver | Action |
|-----------|-------------|-------------|-----------|-------------------|--------|
| [Item]    | $X,XXX      | X.X%        | Unfav.    | [If known]        | Investigate |

### 6. Output

Provide:
1. Formatted income statement with comparisons
2. Key metrics summary
3. Material variance listing with investigation flags
4. Suggested follow-up questions for unexplained variances
5. Offer to drill into any specific variance with `/flux`

## GAAP Presentation Requirements

### Income Statement (ASC 220 / IAS 1)

- Present all items of income and expense recognized in a period
- Classify expenses either by nature (materials, labor, depreciation) or by function (COGS, R&D, S&M, G&A) — function is more common for US companies
- If classified by function, disclose depreciation, amortization, and employee benefit costs by nature in the notes
- Present operating and non-operating items separately
- Show income tax expense as a separate line
- Extraordinary items are prohibited under both US GAAP and IFRS
- Discontinued operations presented separately, net of tax

**Common presentation considerations:**

- **Revenue disaggregation:** ASC 606 requires disaggregation of revenue into categories that depict how the nature, amount, timing, and uncertainty of revenue are affected by economic factors
- **Stock-based compensation:** Classify within the functional expense categories (R&D, S&M, G&A) with total SBC disclosed in notes
- **Restructuring charges:** Present separately if material, or include in operating expenses with note disclosure
- **Non-GAAP adjustments:** If presenting non-GAAP measures (common in earnings releases), clearly label and reconcile to GAAP

### Balance Sheet (ASC 210 / IAS 1)

- Distinguish between current and non-current assets and liabilities
- Current: expected to be realized, consumed, or settled within 12 months (or the operating cycle if longer)
- Present assets in order of liquidity (most liquid first) — standard US practice
- Accounts receivable shown net of allowance for credit losses (ASC 326)
- Property and equipment shown net of accumulated depreciation
- Goodwill is not amortized — tested for impairment annually (ASC 350)
- Leases: recognize right-of-use assets and lease liabilities for operating and finance leases (ASC 842)

### Cash Flow Statement (ASC 230 / IAS 7)

- Indirect method is most common (start with net income, adjust for non-cash items)
- Direct method is permitted but rarely used (requires supplemental indirect reconciliation)
- Interest paid and income taxes paid must be disclosed (either on the face or in notes)
- Non-cash investing and financing activities disclosed separately (e.g., assets acquired under leases, stock issued for acquisitions)
- Cash equivalents: short-term, highly liquid investments with original maturities of 3 months or less

## Balance Sheet Reference Format

```
ASSETS
Current Assets
  Cash and cash equivalents
  Short-term investments
  Accounts receivable, net
  Inventory
  Prepaid expenses and other current assets
Total Current Assets

Non-Current Assets
  Property and equipment, net
  Operating lease right-of-use assets
  Goodwill
  Intangible assets, net
  Long-term investments
  Other non-current assets
Total Non-Current Assets

TOTAL ASSETS

LIABILITIES AND STOCKHOLDERS' EQUITY
Current Liabilities
  Accounts payable
  Accrued liabilities
  Deferred revenue, current portion
  Current portion of long-term debt
  Operating lease liabilities, current portion
  Other current liabilities
Total Current Liabilities

Non-Current Liabilities
  Long-term debt
  Deferred revenue, non-current
  Operating lease liabilities, non-current
  Other non-current liabilities
Total Non-Current Liabilities

Total Liabilities

Stockholders' Equity
  Common stock
  Additional paid-in capital
  Retained earnings (accumulated deficit)
  Accumulated other comprehensive income (loss)
  Treasury stock
Total Stockholders' Equity

TOTAL LIABILITIES AND STOCKHOLDERS' EQUITY

```

## Cash Flow Statement Reference Format (Indirect Method)

```
CASH FLOWS FROM OPERATING ACTIVITIES
Net income (loss)
Adjustments to reconcile net income to net cash from operations:
  Depreciation and amortization
  Stock-based compensation
  Amortization of debt issuance costs
  Deferred income taxes
  Loss (gain) on disposal of assets
  Impairment charges
  Other non-cash items
Changes in operating assets and liabilities:
  Accounts receivable
  Inventory
  Prepaid expenses and other assets
  Accounts payable
  Accrued liabilities
  Deferred revenue
  Other liabilities
Net Cash Provided by (Used in) Operating Activities

CASH FLOWS FROM INVESTING ACTIVITIES
  Purchases of property and equipment
  Purchases of investments
  Proceeds from sale/maturity of investments
  Acquisitions, net of cash acquired
  Other investing activities
Net Cash Provided by (Used in) Investing Activities

CASH FLOWS FROM FINANCING ACTIVITIES
  Proceeds from issuance of debt
  Repayment of debt
  Proceeds from issuance of common stock
  Repurchases of common stock
  Dividends paid
  Payment of debt issuance costs
  Other financing activities
Net Cash Provided by (Used in) Financing Activities

Effect of exchange rate changes on cash

Net Increase (Decrease) in Cash and Cash Equivalents
Cash and cash equivalents, beginning of period
Cash and cash equivalents, end of period
```

## Common Adjustments and Reclassifications

### Period-End Adjustments

1. **Accruals:** Record expenses incurred but not yet paid (AP accruals, payroll accruals, interest accruals)
2. **Deferrals:** Adjust prepaid expenses, deferred revenue, and deferred costs for the period
3. **Depreciation and amortization:** Book periodic depreciation/amortization from fixed asset and intangible schedules
4. **Bad debt provision:** Adjust allowance for credit losses based on aging analysis and historical loss rates
5. **Inventory adjustments:** Record write-downs for obsolete, slow-moving, or impaired inventory
6. **FX revaluation:** Revalue foreign-currency-denominated monetary assets and liabilities at period-end rates
7. **Tax provision:** Record current and deferred income tax expense
8. **Fair value adjustments:** Mark-to-market investments, derivatives, and other fair-value items

### Reclassifications

1. **Current/non-current reclassification:** Reclassify long-term debt maturing within 12 months to current
2. **Contra account netting:** Net allowances against gross receivables, accumulated depreciation against gross assets
3. **Intercompany elimination:** Eliminate intercompany balances and transactions in consolidation
4. **Discontinued operations:** Reclassify results of discontinued operations to a separate line item
5. **Equity method adjustments:** Record share of investee income/loss for equity method investments
6. **Segment reclassifications:** Ensure transactions are properly classified by operating segment



## **NEXT Ventures Ltd.**
**Profit & Loss Statement**
For The Month Ended **30th April, 2026**


