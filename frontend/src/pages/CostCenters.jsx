import { useEffect, useState } from "react";
import api, { fmtCurrency } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, TrendingUp, TrendingDown, FileDown, Sheet as SheetIcon } from "lucide-react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
const startOfYear = () => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

function downloadCSV(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const content = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function CostCenters() {
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(today());
  const [base, setBase] = useState("USD");
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [d, m] = await Promise.all([
        api.get("/statements/cost-center-pnl", { params: { date_from: from, date_to: to, base } }),
        api.get("/cost-centers").catch(() => ({ data: [] })),
      ]);
      setData(d.data);
      setMeta(m.data || []);
    } catch {
      toast.error("Failed to load cost-center P&L");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [from, to, base]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [["Cost Center", "Name", "Revenue", "Expenses", "Contribution", "Margin %"]];
    data.rows.forEach((r) => rows.push([r.cost_center, r.name, r.revenue, r.expenses, r.contribution, r.margin_pct]));
    rows.push(["TOTAL", "", data.total_revenue, data.total_expenses, data.total_contribution, ""]);
    downloadCSV(`cost-center-pnl-${from}_${to}.csv`, rows);
  };

  const exportSheets = async () => {
    try {
      const { data: res } = await api.post("/sheets/export", { kind: "cost-center-pnl", date_from: from, date_to: to });
      toast.success("Exported to Google Sheets");
      window.open(res.url, "_blank");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Connect Google Sheets first");
    }
  };

  const cur = data?.currency || base;
  const typeOf = (code) => meta.find((m) => m.cc_code === code)?.type || "";
  const maxAbs = data ? Math.max(1, ...data.rows.map((r) => Math.abs(r.contribution))) : 1;

  return (
    <div className="p-6 md:p-8" data-testid="cost-centers-page">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow">Reports</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>Cost-Center P&amp;L</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div><Label className="text-[10px] uppercase tracking-wider">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 mt-1" /></div>
          <div><Label className="text-[10px] uppercase tracking-wider">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 mt-1" /></div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider">Currency</Label>
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger className="w-24 mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{["USD", "EUR", "BDT", "LKR", "MYR"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={load} variant="outline">Refresh</Button>
          <Button variant="outline" onClick={exportCSV} disabled={!data || !data.rows.length}><FileDown className="w-4 h-4 mr-1" />CSV</Button>
          <Button variant="outline" onClick={exportSheets} disabled={!data || !data.rows.length}><SheetIcon className="w-4 h-4 mr-1" />Sheets</Button>
        </div>
      </div>

      {/* KPI cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="surface-card p-5">
            <div className="label-eyebrow">Total Revenue</div>
            <div className="numeric text-2xl mt-1 text-moss" style={{ fontFamily: "Outfit", fontWeight: 300 }}>{fmtCurrency(data.total_revenue, cur)}</div>
          </Card>
          <Card className="surface-card p-5">
            <div className="label-eyebrow">Total Expenses</div>
            <div className="numeric text-2xl mt-1 text-terracotta" style={{ fontFamily: "Outfit", fontWeight: 300 }}>{fmtCurrency(data.total_expenses, cur)}</div>
          </Card>
          <Card className="surface-card p-5">
            <div className="label-eyebrow">Net Contribution</div>
            <div className="numeric text-2xl mt-1" style={{ fontFamily: "Outfit", fontWeight: 300 }}>{fmtCurrency(data.total_contribution, cur)}</div>
          </Card>
        </div>
      )}

      <Card className="surface-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 bg-[#F2F0ED] rounded animate-pulse" />)}</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="p-16 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#F2F0ED] flex items-center justify-center"><Layers className="w-5 h-5 text-[#5C5C5C]" strokeWidth={1.5} /></div>
              <div className="text-sm font-medium text-[#1A1A1A]">No cost-center activity</div>
              <div className="text-xs text-[#5C5C5C]">Post transactions with a cost center, or run the seed script.</div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: "820px" }}>
              <thead>
                <tr className="text-left bg-[#F9F8F6]">
                  <th className="px-4 py-3 label-eyebrow text-[10px]">Cost Center</th>
                  <th className="px-4 py-3 label-eyebrow text-[10px]">Type</th>
                  <th className="px-4 py-3 label-eyebrow text-[10px] text-right">Revenue</th>
                  <th className="px-4 py-3 label-eyebrow text-[10px] text-right">Expenses</th>
                  <th className="px-4 py-3 label-eyebrow text-[10px] text-right">Contribution</th>
                  <th className="px-4 py-3 label-eyebrow text-[10px] text-right">Margin</th>
                  <th className="px-4 py-3 label-eyebrow text-[10px] w-40">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const pos = r.contribution >= 0;
                  const w = Math.round((Math.abs(r.contribution) / maxAbs) * 100);
                  return (
                    <tr key={r.cost_center} className="border-t border-cream hover:bg-[#F9F8F6]">
                      <td className="px-4 py-3">
                        <span className="numeric text-xs text-[#5C5C5C] mr-1.5">{r.cost_center}</span>
                        <span className="text-[#1A1A1A]">{r.name || ""}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#5C5C5C]">{typeOf(r.cost_center) || "—"}</td>
                      <td className="px-4 py-3 text-right numeric text-moss">{fmtCurrency(r.revenue, cur)}</td>
                      <td className="px-4 py-3 text-right numeric text-terracotta">{fmtCurrency(r.expenses, cur)}</td>
                      <td className={`px-4 py-3 text-right numeric font-medium ${pos ? "text-moss" : "text-terracotta"}`}>{fmtCurrency(r.contribution, cur)}</td>
                      <td className="px-4 py-3 text-right numeric text-xs text-[#5C5C5C]">{r.revenue ? `${r.margin_pct.toFixed(1)}%` : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {pos ? <TrendingUp className="w-3.5 h-3.5 text-moss shrink-0" /> : <TrendingDown className="w-3.5 h-3.5 text-terracotta shrink-0" />}
                          <div className="flex-1 h-2 rounded-full bg-[#F2F0ED] overflow-hidden">
                            <div className={`h-full ${pos ? "bg-moss" : "bg-terracotta"}`} style={{ width: `${w}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-[#1A1A1A] bg-[#F9F8F6]">
                  <td className="px-4 py-3 font-medium" colSpan="2">Total</td>
                  <td className="px-4 py-3 text-right numeric font-medium">{fmtCurrency(data.total_revenue, cur)}</td>
                  <td className="px-4 py-3 text-right numeric font-medium">{fmtCurrency(data.total_expenses, cur)}</td>
                  <td className="px-4 py-3 text-right numeric font-medium">{fmtCurrency(data.total_contribution, cur)}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
