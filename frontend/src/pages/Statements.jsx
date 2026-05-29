import { useEffect, useState } from "react";
import api, { fmtCurrency } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet as SheetIcon, Download, FileDown, Eye } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { value: "profit-loss", label: "Profit & Loss" },
  { value: "balance-sheet", label: "Balance Sheet" },
  { value: "cash-flow", label: "Cash Flow" },
  { value: "equity", label: "Statement of Equity" },
  { value: "trial-balance", label: "Trial Balance" },
  { value: "general-ledger", label: "General Ledger" },
  { value: "tax-summary", label: "Tax Summary" },
];

// Statements driven by a date range (date_from/date_to); the rest are as-of.
const PERIOD_TABS = ["profit-loss", "cash-flow", "tax-summary", "equity"];

const TAB_LABELS = {
  "profit-loss": "Profit & Loss Statement",
  "balance-sheet": "Balance Sheet",
  "cash-flow": "Cash Flow Statement",
  "equity": "Statement of Changes in Equity",
  "trial-balance": "Trial Balance",
  "general-ledger": "General Ledger",
  "tax-summary": "Tax Summary",
};

const today = () => new Date().toISOString().slice(0, 10);
const startOfYear = () => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

// ──────────────────────────────────────────────
// CSV export helper
// ──────────────────────────────────────────────
function toCSVContent(tab, data) {
  if (!data) return "";
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const row = (arr) => arr.map(escape).join(",");

  const lines = [];
  if (tab === "profit-loss") {
    lines.push(row(["Profit & Loss", data.from, "to", data.to, data.currency]));
    lines.push("");
    if (data.categories && data.categories.length) {
      lines.push(row(["Category", "Subcategory", "Ledger", "Amount"]));
      data.categories.forEach((cat) => {
        (cat.subcategories || []).forEach((sub) => {
          (sub.lines || []).forEach((l) =>
            lines.push(row([cat.category, sub.subcategory, l.account, l.amount])));
        });
        lines.push(row([`Total ${cat.category}`, "", "", cat.total]));
        lines.push("");
      });
      const rpt = data.report || {};
      lines.push(row(["Net Revenue", rpt.net_revenue]));
      lines.push(row(["Gross Profit", rpt.gross_profit]));
      lines.push(row(["Operating Income", rpt.operating_income]));
      lines.push(row(["EBIT", rpt.ebit]));
      lines.push(row(["Net Profit Before Tax", rpt.net_profit_before_tax]));
      lines.push(row(["Net Profit", rpt.net_profit]));
    } else {
      lines.push(row(["Account", "Amount"]));
      lines.push(row(["--- Income ---", ""]));
      (data.income || []).forEach((r) => lines.push(row([r.account, r.amount])));
      lines.push(row(["Total Income", data.total_income]));
      lines.push("");
      lines.push(row(["--- Expenses ---", ""]));
      (data.expenses || []).forEach((r) => lines.push(row([r.account, r.amount])));
      lines.push(row(["Total Expenses", data.total_expenses]));
      lines.push("");
      lines.push(row(["Net Profit", data.net_profit]));
    }
  } else if (tab === "equity") {
    lines.push(row(["Statement of Changes in Equity", data.from, "to", data.to, data.currency]));
    lines.push("");
    lines.push(row(["Item", "Amount"]));
    lines.push(row(["Beginning Equity", data.beginning_equity]));
    lines.push(row(["Beginning Retained Earnings", data.beginning_retained_earnings]));
    lines.push(row(["Capital Contributions", data.contributions]));
    lines.push(row(["Net Income for Period", data.net_income]));
    lines.push(row(["Dividends / Distributions", data.dividends]));
    lines.push(row(["Ending Retained Earnings", data.ending_retained_earnings]));
    lines.push(row(["Ending Equity", data.ending_equity]));
  } else if (tab === "balance-sheet") {
    lines.push(row(["Balance Sheet", "As of", data.as_of, data.currency]));
    lines.push("");
    lines.push(row(["Account", "Balance"]));
    lines.push(row(["--- Assets ---", ""]));
    (data.assets || []).forEach((r) => lines.push(row([r.account, r.balance])));
    lines.push(row(["Total Assets", data.total_assets]));
    lines.push("");
    lines.push(row(["--- Liabilities ---", ""]));
    (data.liabilities || []).forEach((r) => lines.push(row([r.account, r.balance])));
    lines.push(row(["Total Liabilities", data.total_liabilities]));
    lines.push("");
    lines.push(row(["--- Equity ---", ""]));
    (data.equity || []).forEach((r) => lines.push(row([r.account, r.balance])));
    lines.push(row(["Total Equity", data.total_equity]));
  } else if (tab === "cash-flow") {
    lines.push(row(["Cash Flow Statement", data.from, "to", data.to, data.currency]));
    lines.push("");
    lines.push(row(["Activity", "Amount"]));
    lines.push(row(["Operating Activities", data.operating]));
    lines.push(row(["Investing Activities", data.investing]));
    lines.push(row(["Financing Activities", data.financing]));
    lines.push("");
    lines.push(row(["Net Change in Cash", data.net_change]));
  } else if (tab === "trial-balance") {
    lines.push(row(["Trial Balance", "As of", data.as_of, data.currency]));
    lines.push("");
    lines.push(row(["Code", "Account", "Type", "Debit", "Credit"]));
    (data.rows || []).forEach((r) => lines.push(row([r.code, r.account, r.type, r.debit, r.credit])));
    lines.push(row(["", "TOTAL", "", data.total_debit, data.total_credit]));
  } else if (tab === "general-ledger") {
    lines.push(row(["General Ledger", data.account?.name, data.from, "to", data.to, data.currency]));
    lines.push("");
    lines.push(row(["Date", "Description", "Debit", "Credit", "Balance"]));
    (data.rows || []).forEach((r) => lines.push(row([r.date, r.description, r.debit, r.credit, r.balance])));
    lines.push(row(["", "Ending Balance", "", "", data.ending_balance ?? ""]));
  } else if (tab === "tax-summary") {
    lines.push(row(["Tax Summary", data.from, "to", data.to, data.currency]));
    lines.push("");
    lines.push(row(["Metric", "Value"]));
    lines.push(row(["Taxable Sales", data.taxable_sales]));
    lines.push(row(["Tax Collected", data.tax_collected]));
    lines.push(row(["Paid Invoice Total", data.paid_invoice_total]));
    lines.push(row(["Invoice Count", data.invoices_count]));
  }
  return lines.join("\n");
}

function triggerCSVDownload(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────
// Export Preview Dialog
// ──────────────────────────────────────────────
function ExportPreviewDialog({ open, onClose, tab, data, base, from, to, accountId, accounts, onExportSheets }) {
  if (!data) return null;
  const cur = data.currency || base;
  const tabLabel = TAB_LABELS[tab] || tab;
  const nowStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const accountName = tab === "general-ledger"
    ? (accounts.find((a) => a.account_id === accountId)?.name || data.account?.name || "")
    : "";

  let subtitle = "";
  if (tab === "profit-loss" || tab === "cash-flow" || tab === "tax-summary") {
    subtitle = `${data.from || from} to ${data.to || to}`;
  } else if (tab === "balance-sheet" || tab === "trial-balance") {
    subtitle = `As of ${data.as_of || to}`;
  } else if (tab === "general-ledger") {
    subtitle = `${accountName} · ${data.from || from} to ${data.to || to}`;
  }

  const handleDownloadCSV = () => {
    const content = toCSVContent(tab, data);
    const filename = `ledgerly-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    triggerCSVDownload(filename, content);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl w-full flex flex-col gap-0 p-0 overflow-hidden" style={{ maxHeight: "90vh" }}>
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#E8E3DC] flex-shrink-0">
          <DialogTitle style={{ fontFamily: "Outfit" }} className="text-lg font-light tracking-tight text-[#1A1A1A]">
            Export Preview
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6" style={{ maxHeight: "calc(90vh - 140px)" }}>
          {/* Branded header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-moss flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-base" style={{ fontFamily: "Outfit" }}>L</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#1A1A1A]" style={{ fontFamily: "Outfit" }}>
                  FP&amp;A Analytics — NEXT
                </div>
                <div className="text-[10px] text-[#5C5C5C] uppercase tracking-widest">Finance &amp; Accounts</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium text-[#1A1A1A]">zubair.ahmad@nextventures.io</div>
              <div className="text-[10px] text-[#5C5C5C]">{nowStr}</div>
            </div>
          </div>

          {/* Statement title */}
          <div className="mb-1">
            <h2 className="text-2xl font-light text-[#1A1A1A]" style={{ fontFamily: "Outfit" }}>{tabLabel}</h2>
            <div className="text-xs text-[#5C5C5C] mt-0.5">{subtitle} · {cur}</div>
          </div>

          <div className="mt-1 mb-6 border-b border-[#E8E3DC]" />

          {/* Statement content — print-friendly */}
          <ExportPreviewContent tab={tab} data={data} cur={cur} />

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-[#E8E3DC] text-[10px] text-[#9E9E9E] text-center">
            Generated by FP&A-Finance & Audit | NEXT Ventures Ltd.· {nowStr}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-[#E8E3DC] px-6 py-4 flex items-center gap-2 justify-between bg-[#FAFAF8] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs" onClick={handleDownloadCSV}>
              <FileDown className="w-3.5 h-3.5 mr-1.5" />Download CSV
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={onExportSheets}>
              <SheetIcon className="w-3.5 h-3.5 mr-1.5" />Export to Google Sheets
            </Button>
          </div>
          <Button size="sm" variant="outline" className="text-xs" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────
// Categorised P&L (Category → Subcategory → Ledger) + management roll-ups
// ──────────────────────────────────────────────
function CategorizedPnl({ data, cur }) {
  const rpt = data.report || {};
  const fmtN = (v) => fmtCurrency(v, cur);
  const RollUp = ({ label, value, strong }) => (
    <div className={`flex justify-between py-1.5 ${strong ? "border-t border-[#1A1A1A] font-semibold" : "border-t border-[#E8E3DC]"}`}>
      <span>{label}</span><span className="numeric">{fmtN(value)}</span>
    </div>
  );
  return (
    <div className="text-sm">
      {(data.categories || []).map((cat) => (
        <div key={cat.category} className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-moss mb-1">{cat.category}</div>
          {(cat.subcategories || []).map((sub) => (
            <div key={sub.subcategory} className="mb-1">
              {sub.subcategory !== sub.lines?.[0]?.account && (
                <div className="text-[#5C5C5C] text-xs mt-1">{sub.subcategory}</div>
              )}
              <table className="w-full">
                <tbody>
                  {(sub.lines || []).map((l, i) => (
                    <tr key={i} className="border-b border-[#F4F1EC]">
                      <td className="py-1 pl-3 text-[#1A1A1A]">{l.account}</td>
                      <td className="py-1 text-right numeric">{fmtN(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <div className="flex justify-between py-1.5 border-t border-[#E8E3DC] font-medium">
            <span>Total {cat.category}</span><span className="numeric">{fmtN(cat.total)}</span>
          </div>
        </div>
      ))}
      <div className="mt-4 rounded-md bg-[#F7F5F2] border border-[#E8E3DC] px-4 py-2">
        <RollUp label="Net Revenue" value={rpt.net_revenue} />
        <RollUp label="Gross Profit" value={rpt.gross_profit} />
        <RollUp label="Operating Income" value={rpt.operating_income} />
        <RollUp label="Income Before Interest & Tax (EBIT)" value={rpt.ebit} />
        <RollUp label="Net Profit Before Tax" value={rpt.net_profit_before_tax} />
        <RollUp label="Net Profit" value={rpt.net_profit} strong />
      </div>
    </div>
  );
}

function EquityView({ data, cur }) {
  const fmtN = (v) => fmtCurrency(v, cur);
  const Row = ({ label, value, strong }) => (
    <tr className={strong ? "border-t-2 border-[#1A1A1A]" : "border-b border-[#F0EDE8]"}>
      <td className={`py-2 ${strong ? "font-semibold" : ""}`}>{label}</td>
      <td className={`py-2 text-right numeric ${strong ? "font-semibold" : ""}`}>{fmtN(value)}</td>
    </tr>
  );
  return (
    <table className="w-full text-sm">
      <tbody>
        <Row label="Beginning Equity" value={data.beginning_equity} />
        <Row label="  Beginning Retained Earnings" value={data.beginning_retained_earnings} />
        <Row label="Capital Contributions / (Distributions)" value={data.contributions} />
        <Row label="Add: Net Income for Period" value={data.net_income} />
        <Row label="Less: Dividends" value={data.dividends} />
        <Row label="Ending Retained Earnings" value={data.ending_retained_earnings} />
        <Row label="Ending Equity" value={data.ending_equity} strong />
      </tbody>
    </table>
  );
}

function ExportPreviewContent({ tab, data, cur }) {
  if (!data) return null;

  const fmtN = (v) => fmtCurrency(v, cur);

  if (tab === "profit-loss") {
    if (data.categories && data.categories.length) {
      return <CategorizedPnl data={data} cur={cur} />;
    }
    return (
      <div>
        <PreviewSection title="Income" rows={data.income} valueKey="amount" cur={cur} />
        <div className="flex justify-between text-sm font-medium py-2 border-t border-[#E8E3DC] mt-1">
          <span>Total Income</span><span className="numeric">{fmtN(data.total_income)}</span>
        </div>
        <PreviewSection title="Expenses" rows={data.expenses} valueKey="amount" cur={cur} />
        <div className="flex justify-between text-sm font-medium py-2 border-t border-[#E8E3DC] mt-1">
          <span>Total Expenses</span><span className="numeric">{fmtN(data.total_expenses)}</span>
        </div>
        <div className="mt-4 flex justify-between items-center py-3 px-4 rounded-md border border-[#4A6741] bg-[#F0F5EF]">
          <span className="text-sm font-semibold text-[#1A1A1A]" style={{ fontFamily: "Outfit" }}>Net Profit</span>
          <span className="text-xl numeric text-moss font-light" style={{ fontFamily: "Outfit" }}>{fmtN(data.net_profit)}</span>
        </div>
      </div>
    );
  }

  if (tab === "equity") {
    return <EquityView data={data} cur={cur} />;
  }

  if (tab === "balance-sheet") {
    return (
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <PreviewSection title="Assets" rows={data.assets} valueKey="balance" cur={cur} />
          <div className="flex justify-between text-sm font-medium py-2 border-t border-[#E8E3DC] mt-1">
            <span>Total Assets</span><span className="numeric">{fmtN(data.total_assets)}</span>
          </div>
        </div>
        <div>
          <PreviewSection title="Liabilities" rows={data.liabilities} valueKey="balance" cur={cur} />
          <div className="flex justify-between text-sm font-medium py-2 border-t border-[#E8E3DC] mt-1">
            <span>Total Liabilities</span><span className="numeric">{fmtN(data.total_liabilities)}</span>
          </div>
          <PreviewSection title="Equity" rows={data.equity} valueKey="balance" cur={cur} />
          <div className="flex justify-between text-sm font-medium py-2 border-t border-[#E8E3DC] mt-1">
            <span>Total Equity</span><span className="numeric">{fmtN(data.total_equity)}</span>
          </div>
        </div>
      </div>
    );
  }

  if (tab === "cash-flow") {
    return (
      <div>
        <table className="w-full text-sm">
          <tbody>
            {[["Operating Activities", data.operating], ["Investing Activities", data.investing], ["Financing Activities", data.financing]].map(([label, val]) => (
              <tr key={label} className="border-b border-[#F0EDE8]">
                <td className="py-2 text-[#1A1A1A]">{label}</td>
                <td className="py-2 text-right numeric">{fmtN(val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-between items-center py-3 px-4 rounded-md border border-[#4A6741] bg-[#F0F5EF]">
          <span className="text-sm font-semibold text-[#1A1A1A]" style={{ fontFamily: "Outfit" }}>Net Change in Cash</span>
          <span className="text-xl numeric text-moss font-light" style={{ fontFamily: "Outfit" }}>{fmtN(data.net_change)}</span>
        </div>
      </div>
    );
  }

  if (tab === "trial-balance") {
    return (
      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8E3DC] text-[#5C5C5C] text-xs">
              <th className="py-2 text-left font-medium">Code</th>
              <th className="py-2 text-left font-medium">Account</th>
              <th className="py-2 text-left font-medium">Type</th>
              <th className="py-2 text-right font-medium">Debit</th>
              <th className="py-2 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {(data.rows || []).map((r, i) => (
              <tr key={i} className="border-b border-[#F0EDE8]">
                <td className="py-1.5 numeric text-xs">{r.code}</td>
                <td className="py-1.5 text-[#1A1A1A]">{r.account}</td>
                <td className="py-1.5 text-[#5C5C5C] capitalize text-xs">{r.type}</td>
                <td className="py-1.5 text-right numeric">{fmtN(r.debit)}</td>
                <td className="py-1.5 text-right numeric">{fmtN(r.credit)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-[#1A1A1A]">
              <td colSpan="3" className="py-2 font-semibold">Total</td>
              <td className="py-2 text-right numeric font-semibold">{fmtN(data.total_debit)}</td>
              <td className="py-2 text-right numeric font-semibold">{fmtN(data.total_credit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === "general-ledger") {
    return (
      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8E3DC] text-[#5C5C5C] text-xs">
              <th className="py-2 text-left font-medium">Date</th>
              <th className="py-2 text-left font-medium">Description</th>
              <th className="py-2 text-right font-medium">Debit</th>
              <th className="py-2 text-right font-medium">Credit</th>
              <th className="py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.rows && data.rows.length > 0 ? data.rows.map((r, i) => (
              <tr key={i} className="border-b border-[#F0EDE8]">
                <td className="py-1.5 text-xs">{r.date}</td>
                <td className="py-1.5 text-[#1A1A1A]">{r.description}</td>
                <td className="py-1.5 text-right numeric">{fmtN(r.debit)}</td>
                <td className="py-1.5 text-right numeric">{fmtN(r.credit)}</td>
                <td className="py-1.5 text-right numeric">{fmtN(r.balance)}</td>
              </tr>
            )) : (
              <tr><td colSpan="5" className="py-6 text-center text-[#5C5C5C]">No entries.</td></tr>
            )}
          </tbody>
        </table>
        {data.ending_balance !== undefined && (
          <div className="mt-3 flex justify-between items-center py-2 px-3 bg-[#F7F5F2] rounded text-sm font-medium border border-[#E8E3DC]">
            <span>Ending Balance</span>
            <span className="numeric">{fmtN(data.ending_balance)}</span>
          </div>
        )}
      </div>
    );
  }

  if (tab === "tax-summary") {
    return (
      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8E3DC] text-[#5C5C5C] text-xs">
              <th className="py-2 text-left font-medium">Metric</th>
              <th className="py-2 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#F0EDE8]"><td className="py-2">Taxable Sales</td><td className="py-2 text-right numeric">{fmtN(data.taxable_sales)}</td></tr>
            <tr className="border-b border-[#F0EDE8]"><td className="py-2">Tax Collected</td><td className="py-2 text-right numeric">{fmtN(data.tax_collected)}</td></tr>
            <tr className="border-b border-[#F0EDE8]"><td className="py-2">Paid Invoice Total</td><td className="py-2 text-right numeric">{fmtN(data.paid_invoice_total)}</td></tr>
            <tr className="border-b border-[#F0EDE8]"><td className="py-2">Invoice Count</td><td className="py-2 text-right numeric">{data.invoices_count}</td></tr>
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

function PreviewSection({ title, rows, valueKey, cur }) {
  return (
    <div className="mt-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#5C5C5C] mb-1">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {(!rows || rows.length === 0) && (
            <tr><td className="py-1.5 text-[#5C5C5C]">—</td></tr>
          )}
          {(rows || []).map((r, i) => (
            <tr key={i} className="border-b border-[#F0EDE8]">
              <td className="py-1.5 text-[#1A1A1A]">{r.account}</td>
              <td className="py-1.5 text-right numeric">{fmtCurrency(r[valueKey], cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Statements page
// ──────────────────────────────────────────────
export default function Statements() {
  const [tab, setTab] = useState("profit-loss");
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(today());
  const [base, setBase] = useState("USD");
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    api.get("/accounts")
      .then((r) => { setAccounts(r.data); setAccountId(r.data[0]?.account_id || ""); })
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    // Bug fix: skip general-ledger fetch if no account selected
    if (tab === "general-ledger" && !accountId) return;
    setLoading(true);
    try {
      const params = { base };
      if (PERIOD_TABS.includes(tab)) { params.date_from = from; params.date_to = to; }
      if (["balance-sheet", "trial-balance"].includes(tab)) { params.as_of = to; }
      if (tab === "general-ledger") { params.account_id = accountId; params.date_from = from; params.date_to = to; }
      const { data: result } = await api.get(`/statements/${tab}`, { params });
      setData(result);
    } catch {
      toast.error("Failed to load statement data");
      setData(null);
    } finally { setLoading(false); }
  };

  // Bug fix: include from and to in deps so date changes trigger refresh
  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [tab, base, accountId, from, to]);

  const exportToSheets = async () => {
    try {
      const body = { kind: tab };
      if (PERIOD_TABS.includes(tab)) {
        body.date_from = from;
        body.date_to = to;
      }
      if (["balance-sheet", "trial-balance"].includes(tab)) {
        body.date_to = to;
      }
      if (tab === "general-ledger") {
        body.account_id = accountId;
        body.date_from = from;
        body.date_to = to;
      }
      const { data: res } = await api.post("/sheets/export", body);
      toast.success("Exported to Google Sheets");
      window.open(res.url, "_blank");
    } catch (e) { toast.error(e?.response?.data?.detail || "Connect Google Sheets first"); }
  };

  return (
    <div className="p-6 md:p-8" data-testid="statements-page">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="label-eyebrow">Reports</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>Statements</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div><Label className="text-[10px] uppercase tracking-wider">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 mt-1" data-testid="stmt-from" /></div>
          <div><Label className="text-[10px] uppercase tracking-wider">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 mt-1" data-testid="stmt-to" /></div>
          <div><Label className="text-[10px] uppercase tracking-wider">Currency</Label>
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger className="w-24 mt-1 h-9" data-testid="stmt-currency"><SelectValue /></SelectTrigger>
              <SelectContent>{["USD", "EUR", "BDT", "LKR", "MYR"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={fetchData} variant="outline" data-testid="stmt-refresh">Refresh</Button>
          <Button
            onClick={() => setPreviewOpen(true)}
            variant="outline"
            data-testid="stmt-export-preview"
            disabled={!data}
          >
            <Eye className="w-4 h-4 mr-1" />Export Preview
          </Button>
          <Button onClick={exportToSheets} className="bg-moss hover:bg-[#3D5247] text-white" data-testid="stmt-export-sheets"><SheetIcon className="w-4 h-4 mr-1" />Export to Sheets</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[#F2F0ED] p-1 mb-6 flex flex-wrap h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="data-[state=active]:bg-white data-[state=active]:text-moss data-[state=active]:shadow-sm" data-testid={`tab-${t.value}`}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {tab === "general-ledger" && (
          <div className="mb-4">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-80 mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.account_id} value={a.account_id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}

        <Card className="surface-card p-6 md:p-8" data-testid={`stmt-${tab}-card`}>
          {loading ? (
            <div className="flex flex-col gap-3 py-4">
              <div className="h-6 w-48 bg-[#F2F0ED] rounded animate-pulse" />
              <div className="h-4 w-32 bg-[#F2F0ED] rounded animate-pulse" />
              <div className="mt-4 space-y-2">
                {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-[#F2F0ED] rounded animate-pulse" />)}
              </div>
            </div>
          ) : <StatementView tab={tab} data={data} base={base} />}
        </Card>
      </Tabs>

      <ExportPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        tab={tab}
        data={data}
        base={base}
        from={from}
        to={to}
        accountId={accountId}
        accounts={accounts}
        onExportSheets={() => { setPreviewOpen(false); exportToSheets(); }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Statement view components (original, unchanged)
// ──────────────────────────────────────────────
function Section({ title, rows, total, currency }) {
  return (
    <div>
      <div className="label-eyebrow mt-4">{title}</div>
      <table className="w-full text-sm mt-2">
        <tbody>
          {rows && rows.length === 0 && <tr><td className="py-2 text-[#5C5C5C]">—</td></tr>}
          {rows && rows.map((r, i) => (
            <tr key={i} className="border-b border-cream"><td className="py-2 text-[#1A1A1A]">{r.account}</td><td className="py-2 text-right numeric">{fmtCurrency(r.amount ?? r.balance, currency)}</td></tr>
          ))}
          {total !== undefined && (<tr className="border-t border-[#1A1A1A]"><td className="py-2 font-medium">Total</td><td className="py-2 text-right numeric font-medium">{fmtCurrency(total, currency)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function StatementView({ tab, data, base }) {
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
      <div className="w-10 h-10 rounded-full bg-[#F2F0ED] flex items-center justify-center mb-1">
        <span style={{ fontSize: 18 }}>📊</span>
      </div>
      <div className="text-sm font-medium text-[#1A1A1A]">No statement data</div>
      <div className="text-xs text-[#5C5C5C] max-w-xs">Add transactions or accounts, then click Refresh to generate your report.</div>
    </div>
  );
  const cur = data.currency || base;
  if (tab === "profit-loss") {
    return (
      <div>
        <h2 className="text-2xl font-light" style={{ fontFamily: "Outfit" }}>Profit & Loss</h2>
        <div className="text-sm text-[#5C5C5C]">{data.from} → {data.to} · {cur}</div>
        <div className="mt-6">
          {data.categories && data.categories.length ? (
            <CategorizedPnl data={data} cur={cur} />
          ) : (
            <div>
              <Section title="Income" rows={data.income} total={data.total_income} currency={cur} />
              <Section title="Expenses" rows={data.expenses} total={data.total_expenses} currency={cur} />
              <div className="mt-6 p-4 bg-[#F2F0ED] rounded-md flex items-center justify-between">
                <div className="label-eyebrow">Net Profit</div>
                <div className="text-2xl numeric text-moss" style={{ fontFamily: "Outfit" }}>{fmtCurrency(data.net_profit, cur)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (tab === "equity") {
    return (
      <div>
        <h2 className="text-2xl font-light" style={{ fontFamily: "Outfit" }}>Statement of Changes in Equity</h2>
        <div className="text-sm text-[#5C5C5C]">{data.from} → {data.to} · {cur}</div>
        <div className="mt-6 max-w-xl">
          <EquityView data={data} cur={cur} />
        </div>
      </div>
    );
  }
  if (tab === "balance-sheet") {
    return (
      <div>
        <h2 className="text-2xl font-light" style={{ fontFamily: "Outfit" }}>Balance Sheet</h2>
        <div className="text-sm text-[#5C5C5C]">As of {data.as_of} · {cur}</div>
        <div className="grid md:grid-cols-2 gap-8 mt-6">
          <div><Section title="Assets" rows={data.assets} total={data.total_assets} currency={cur} /></div>
          <div>
            <Section title="Liabilities" rows={data.liabilities} total={data.total_liabilities} currency={cur} />
            <Section title="Equity" rows={data.equity} total={data.total_equity} currency={cur} />
          </div>
        </div>
      </div>
    );
  }
  if (tab === "cash-flow") {
    return (
      <div>
        <h2 className="text-2xl font-light" style={{ fontFamily: "Outfit" }}>Cash Flow</h2>
        <div className="text-sm text-[#5C5C5C]">{data.from} → {data.to} · {cur}</div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[["Operating", data.operating], ["Investing", data.investing], ["Financing", data.financing]].map(([n, v]) => (
            <div key={n} className="p-4 surface-card"><div className="label-eyebrow">{n}</div><div className="numeric text-2xl mt-1" style={{ fontFamily: "Outfit", fontWeight: 300 }}>{fmtCurrency(v, cur)}</div></div>
          ))}
        </div>
        <div className="mt-6 p-4 bg-[#F2F0ED] rounded-md flex items-center justify-between"><div className="label-eyebrow">Net change in cash</div><div className="text-2xl numeric text-moss" style={{ fontFamily: "Outfit" }}>{fmtCurrency(data.net_change, cur)}</div></div>
      </div>
    );
  }
  if (tab === "trial-balance") {
    return (
      <div>
        <h2 className="text-2xl font-light" style={{ fontFamily: "Outfit" }}>Trial Balance</h2>
        <div className="text-sm text-[#5C5C5C]">As of {data.as_of} · {cur}</div>
        <table className="w-full text-sm mt-6">
          <thead><tr className="text-left text-[#5C5C5C] border-b border-cream"><th className="py-2">Code</th><th className="py-2">Account</th><th className="py-2">Type</th><th className="py-2 text-right">Debit</th><th className="py-2 text-right">Credit</th></tr></thead>
          <tbody>
            {(data.rows || []).length === 0 ? (
              <tr><td colSpan="5" className="py-6 text-center text-[#5C5C5C]">No accounts with activity.</td></tr>
            ) : (data.rows || []).map((r, i) => (
              <tr key={i} className="border-b border-cream"><td className="py-2 numeric">{r.code}</td><td className="py-2">{r.account}</td><td className="py-2 text-[#5C5C5C] capitalize">{r.type}</td><td className="py-2 text-right numeric">{fmtCurrency(r.debit, cur)}</td><td className="py-2 text-right numeric">{fmtCurrency(r.credit, cur)}</td></tr>
            ))}
            {(data.rows || []).length > 0 && (
              <tr className="border-t border-[#1A1A1A]"><td colSpan="3" className="py-2 font-medium">Total</td><td className="py-2 text-right numeric font-medium">{fmtCurrency(data.total_debit, cur)}</td><td className="py-2 text-right numeric font-medium">{fmtCurrency(data.total_credit, cur)}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }
  if (tab === "general-ledger") {
    return (
      <div>
        <h2 className="text-2xl font-light" style={{ fontFamily: "Outfit" }}>General Ledger</h2>
        <div className="text-sm text-[#5C5C5C]">{data.account?.name} · {data.from} → {data.to} · {cur}</div>
        <table className="w-full text-sm mt-6">
          <thead><tr className="text-left text-[#5C5C5C] border-b border-cream"><th className="py-2">Date</th><th className="py-2">Description</th><th className="py-2 text-right">Debit</th><th className="py-2 text-right">Credit</th><th className="py-2 text-right">Balance</th></tr></thead>
          <tbody>
            {data.rows && data.rows.length > 0 ? data.rows.map((r, i) => (
              <tr key={i} className="border-b border-cream"><td className="py-2">{r.date}</td><td className="py-2">{r.description}</td><td className="py-2 text-right numeric">{fmtCurrency(r.debit, cur)}</td><td className="py-2 text-right numeric">{fmtCurrency(r.credit, cur)}</td><td className="py-2 text-right numeric">{fmtCurrency(r.balance, cur)}</td></tr>
            )) : <tr><td colSpan="5" className="py-6 text-center text-[#5C5C5C]">No entries.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }
  if (tab === "tax-summary") {
    return (
      <div>
        <h2 className="text-2xl font-light" style={{ fontFamily: "Outfit" }}>Tax Summary</h2>
        <div className="text-sm text-[#5C5C5C]">{data.from} → {data.to} · {cur}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 surface-card"><div className="label-eyebrow">Taxable sales</div><div className="numeric text-2xl mt-1" style={{ fontFamily: "Outfit", fontWeight: 300 }}>{fmtCurrency(data.taxable_sales, cur)}</div></div>
          <div className="p-4 surface-card"><div className="label-eyebrow">Tax collected</div><div className="numeric text-2xl mt-1 text-moss" style={{ fontFamily: "Outfit", fontWeight: 300 }}>{fmtCurrency(data.tax_collected, cur)}</div></div>
          <div className="p-4 surface-card"><div className="label-eyebrow">Paid invoice total</div><div className="numeric text-2xl mt-1" style={{ fontFamily: "Outfit", fontWeight: 300 }}>{fmtCurrency(data.paid_invoice_total, cur)}</div></div>
          <div className="p-4 surface-card"><div className="label-eyebrow">Invoices</div><div className="numeric text-2xl mt-1" style={{ fontFamily: "Outfit", fontWeight: 300 }}>{data.invoices_count}</div></div>
        </div>
      </div>
    );
  }
  return null;
}
