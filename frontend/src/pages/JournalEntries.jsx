import { useEffect, useMemo, useState } from "react";
import api, { CURRENCIES, fmtCurrency, fmtDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, BookText, CheckCircle2, AlertCircle, X, FileDown, Sheet as SheetIcon } from "lucide-react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
const startOfMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

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

const emptyLine = () => ({ account_id: "", type: "debit", amount: "", description: "" });
const DEFAULT_FORM = () => ({
  date: today(),
  description: "",
  reference: "",
  cost_center: "",
  currency: "USD",
  month: "",
  lines: [emptyLine(), emptyLine()],
});

export default function JournalEntries() {
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [costCenters, setCostCenters] = useState([]); // distinct department/CC strings
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [ccFilter, setCcFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM());
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = { date_from: from, date_to: to };
      if (ccFilter) params.cost_center = ccFilter;
      const [e, a, c] = await Promise.all([
        api.get("/journal-entries", { params }),
        api.get("/accounts"),
        api.get("/cost-centers/used").catch(() => ({ data: [] })),
      ]);
      setEntries(e.data);
      setAccounts(a.data);
      setCostCenters(c.data || []);
    } catch {
      toast.error("Failed to load journal entries");
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const rows = [["Date", "Journal ID", "Cost Center", "Account Code", "Account", "Debit", "Credit", "Description"]];
    entries.forEach((e) => e.lines.forEach((l) =>
      rows.push([e.date, e.journal_id, e.cost_center, l.account_code, l.account_name, l.debit || "", l.credit || "", l.description])));
    downloadCSV(`journal-entries-${from}_${to}.csv`, rows);
  };

  const exportSheets = async () => {
    try {
      const { data } = await api.post("/sheets/export", { kind: "journal", date_from: from, date_to: to });
      toast.success("Exported to Google Sheets");
      window.open(data.url, "_blank");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Connect Google Sheets first");
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [from, to, ccFilter]);

  // ── New-entry form helpers ──
  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (i, k, v) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)) }));
  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  const removeLine = (i) =>
    setForm((f) => ({ ...f, lines: f.lines.length > 2 ? f.lines.filter((_, idx) => idx !== i) : f.lines }));

  const totals = useMemo(() => {
    let d = 0, c = 0;
    form.lines.forEach((l) => {
      const amt = parseFloat(l.amount) || 0;
      if (l.type === "debit") d += amt; else c += amt;
    });
    return { debit: d, credit: c, balanced: Math.abs(d - c) < 0.005 && d > 0 };
  }, [form.lines]);

  const canSubmit =
    totals.balanced &&
    form.lines.every((l) => l.account_id && (parseFloat(l.amount) || 0) > 0);

  const submit = async () => {
    try {
      const payload = {
        date: form.date,
        description: form.description,
        reference: form.reference,
        cost_center: form.cost_center,
        currency: form.currency,
        month: form.month,
        lines: form.lines.map((l) => ({
          account_id: l.account_id,
          type: l.type,
          amount: parseFloat(l.amount),
          description: l.description,
        })),
      };
      await api.post("/journal-entries", payload);
      toast.success("Journal entry posted");
      setOpen(false);
      setForm(DEFAULT_FORM());
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to post entry");
    }
  };

  const remove = async (journal_id) => {
    try {
      await api.delete(`/journal-entries/${journal_id}`);
      toast.success("Entry deleted");
      load();
    } catch {
      toast.error("Could not delete entry");
    }
  };

  const ccLabel = (code) => code;

  return (
    <div className="p-6 md:p-8" data-testid="journal-entries-page">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow">Ledger</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>Journal Entries</h1>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div><Label className="text-[10px] uppercase tracking-wider">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 mt-1" /></div>
          <div><Label className="text-[10px] uppercase tracking-wider">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 mt-1" /></div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider">Cost Center</Label>
            <Select value={ccFilter || "all"} onValueChange={(v) => setCcFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-52 mt-1 h-9"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cost centers</SelectItem>
                {costCenters.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="h-9" onClick={exportCSV} disabled={!entries.length}><FileDown className="w-4 h-4 mr-1" />CSV</Button>
          <Button variant="outline" className="h-9" onClick={exportSheets} disabled={!entries.length}><SheetIcon className="w-4 h-4 mr-1" />Sheets</Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(DEFAULT_FORM()); }}>
            <DialogTrigger asChild>
              <Button className="bg-moss hover:bg-[#3D5247] text-white" data-testid="new-journal-btn"><Plus className="w-4 h-4 mr-1" /> New entry</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle style={{ fontFamily: "Outfit" }}>New journal entry</DialogTitle></DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} className="mt-1.5" /></div>
                  <div><Label>Reference</Label><Input placeholder="JE-001" value={form.reference} onChange={(e) => setField("reference", e.target.value)} className="mt-1.5" /></div>
                  <div>
                    <Label>Cost Center</Label>
                    <Select value={form.cost_center || "none"} onValueChange={(v) => setField("cost_center", v === "none" ? "" : v)}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {costCenters.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Select value={form.currency} onValueChange={(v) => setField("currency", v)}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Description</Label><Input value={form.description} onChange={(e) => setField("description", e.target.value)} className="mt-1.5" /></div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label>Lines</Label>
                    <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={addLine}><Plus className="w-3 h-3 mr-1" /> Add line</Button>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[#5C5C5C] text-[10px] uppercase tracking-wider">
                        <th className="py-1 font-medium">Account</th>
                        <th className="py-1 font-medium w-24">Type</th>
                        <th className="py-1 font-medium w-28 text-right">Amount</th>
                        <th className="py-1 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.lines.map((l, i) => (
                        <tr key={i} className="border-t border-cream">
                          <td className="py-1.5 pr-2">
                            <Select value={l.account_id} onValueChange={(v) => setLine(i, "account_id", v)}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Select account" /></SelectTrigger>
                              <SelectContent>{accounts.map((a) => <SelectItem key={a.account_id} value={a.account_id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="py-1.5 pr-2">
                            <Select value={l.type} onValueChange={(v) => setLine(i, "type", v)}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="debit">Debit</SelectItem>
                                <SelectItem value="credit">Credit</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-1.5">
                            <Input type="number" step="0.01" value={l.amount} onChange={(e) => setLine(i, "amount", e.target.value)} className="h-9 text-right" />
                          </td>
                          <td className="py-1.5 text-center">
                            <button type="button" onClick={() => removeLine(i)} className="p-1 text-[#5C5C5C] hover:text-terracotta disabled:opacity-30" disabled={form.lines.length <= 2}><X className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={`mt-3 flex items-center justify-between px-3 py-2 rounded-md text-sm ${totals.balanced ? "bg-[#F0F5EF] border border-[#4A6741]" : "bg-[#FBF1EE] border border-terracotta"}`}>
                    <span className="flex items-center gap-1.5 font-medium">
                      {totals.balanced ? <CheckCircle2 className="w-4 h-4 text-moss" /> : <AlertCircle className="w-4 h-4 text-terracotta" />}
                      {totals.balanced ? "Balanced" : "Debits must equal credits"}
                    </span>
                    <span className="numeric text-xs text-[#5C5C5C]">
                      DR {fmtCurrency(totals.debit, form.currency)} · CR {fmtCurrency(totals.credit, form.currency)}
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={!canSubmit} className="bg-moss hover:bg-[#3D5247] text-white" data-testid="post-journal-btn">Post entry</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-[#F2F0ED] rounded animate-pulse" />)}</div>
      ) : entries.length === 0 ? (
        <Card className="surface-card p-16 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#F2F0ED] flex items-center justify-center"><BookText className="w-5 h-5 text-[#5C5C5C]" strokeWidth={1.5} /></div>
            <div className="text-sm font-medium text-[#1A1A1A]">No journal entries in this period</div>
            <div className="text-xs text-[#5C5C5C]">Post a new entry, or run the seed script to load Jan–May 2026 data.</div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((e) => (
            <Card key={e.journal_id} className="surface-card overflow-hidden">
              <div className="flex items-start justify-between gap-3 px-4 py-3 bg-[#F9F8F6] border-b border-cream">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#1A1A1A]" style={{ fontFamily: "Outfit" }}>{fmtDate(e.date)}</span>
                    {e.reference && <span className="text-xs text-[#5C5C5C] font-mono">{e.reference}</span>}
                    {e.cost_center && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F2F0ED] text-moss border border-cream">{ccLabel(e.cost_center)}</span>}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${e.balanced ? "bg-[#F0F5EF] text-moss border-[#cfe0cb]" : "bg-[#FBF1EE] text-terracotta border-[#e9cfc8]"}`}>
                      {e.balanced ? "Balanced" : "Unbalanced"}
                    </span>
                  </div>
                  <div className="text-xs text-[#5C5C5C] mt-0.5 truncate">{e.description || "—"}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-[#5C5C5C]">{e.source}</span>
                  {(e.source === "journal" || e.source === "seed-next") && (
                    <button onClick={() => remove(e.journal_id)} className="p-1.5 text-[#5C5C5C] hover:text-terracotta" title="Delete entry"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[#5C5C5C] text-[10px] uppercase tracking-wider border-b border-cream">
                    <th className="px-4 py-2 font-medium">Account</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium text-right">Debit</th>
                    <th className="px-4 py-2 font-medium text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {e.lines.map((l, i) => (
                    <tr key={i} className="border-b border-cream last:border-0">
                      <td className="px-4 py-2 text-[#1A1A1A]"><span className="numeric text-xs text-[#5C5C5C] mr-1.5">{l.account_code}</span>{l.account_name}</td>
                      <td className="px-4 py-2 text-xs text-[#5C5C5C] max-w-[260px]"><span className="block truncate" title={l.description}>{l.description || "—"}</span></td>
                      <td className="px-4 py-2 text-right numeric">{l.debit ? fmtCurrency(l.debit, e.currency) : "—"}</td>
                      <td className="px-4 py-2 text-right numeric">{l.credit ? fmtCurrency(l.credit, e.currency) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#1A1A1A] bg-[#F9F8F6]">
                    <td className="px-4 py-2 font-medium" colSpan="2">Totals</td>
                    <td className="px-4 py-2 text-right numeric font-medium">{fmtCurrency(e.total_debit, e.currency)}</td>
                    <td className="px-4 py-2 text-right numeric font-medium">{fmtCurrency(e.total_credit, e.currency)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
