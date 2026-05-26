import { useEffect, useState } from "react";
import api, { CURRENCIES, fmtCurrency, fmtDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Receipt } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_FORM = () => ({
  date: new Date().toISOString().slice(0, 10),
  description: "",
  amount: "",
  currency: "USD",
  type: "credit",
  account_id: "",
  category: "",
  month: "",
  department: "",
  subcategory: "",
  ledger: "",
  vendor: "",
  tx_id: "",
});

export default function Transactions() {
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM());
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState({ source: "", account_id: "" });

  const load = async () => {
    try {
      const params = {};
      if (filter.source) params.source = filter.source;
      if (filter.account_id) params.account_id = filter.account_id;
      const [t, a] = await Promise.all([api.get("/transactions", { params }), api.get("/accounts")]);
      setItems(t.data);
      setAccounts(a.data);
    } catch {
      toast.error("Failed to load transactions");
    }
  };

  useEffect(() => { load(); }, [filter.source, filter.account_id]); // eslint-disable-line

  const submit = async () => {
    try {
      const payload = { ...form, amount: parseFloat(form.amount) };
      if (editing) {
        await api.patch(`/transactions/${editing}`, payload);
        toast.success("Transaction updated");
      } else {
        await api.post("/transactions", payload);
        toast.success("Transaction added");
      }
      setOpen(false);
      setEditing(null);
      setForm(DEFAULT_FORM());
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const startEdit = (t) => {
    setEditing(t.txn_id);
    setForm({
      date: t.date,
      description: t.description,
      amount: String(t.amount),
      currency: t.currency,
      type: t.type,
      account_id: t.account_id,
      category: t.category || "",
      month: t.month || "",
      department: t.department || "",
      subcategory: t.subcategory || "",
      ledger: t.ledger || "",
      vendor: t.vendor || "",
      tx_id: t.tx_id || "",
    });
    setOpen(true);
  };

  const remove = async (id) => {
    await api.delete(`/transactions/${id}`);
    toast.success("Deleted");
    load();
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="p-6 md:p-8" data-testid="transactions-page">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="label-eyebrow">Ledger</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>Transactions</h1>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={filter.source || "all"} onValueChange={(v) => setFilter((f) => ({ ...f, source: v === "all" ? "" : v }))}>
            <SelectTrigger className="w-40 h-10" data-testid="filter-source"><SelectValue placeholder="All sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="skrill">Skrill</SelectItem>
              <SelectItem value="paysafe">Paysafe</SelectItem>
              <SelectItem value="google-sheets">Google Sheets</SelectItem>
              <SelectItem value="import">Import</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(DEFAULT_FORM()); } }}>
            <DialogTrigger asChild>
              <Button className="bg-moss hover:bg-[#3D5247] text-white" data-testid="add-transaction-btn"><Plus className="w-4 h-4 mr-1" /> New transaction</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle style={{ fontFamily: "Outfit" }}>{editing ? "Edit transaction" : "New transaction"}</DialogTitle></DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {/* Row 1: Date + Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="mt-1.5" data-testid="txn-date-input" /></div>
                  <div><Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => set("type", v)}>
                      <SelectTrigger className="mt-1.5" data-testid="txn-type-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit">Credit (income)</SelectItem>
                        <SelectItem value="debit">Debit (expense)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Row 2: Description */}
                <div><Label>Description</Label><Input value={form.description} onChange={(e) => set("description", e.target.value)} className="mt-1.5" data-testid="txn-desc-input" /></div>
                {/* Row 3: Amount + Currency */}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} className="mt-1.5" data-testid="txn-amount-input" /></div>
                  <div><Label>Currency</Label>
                    <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                      <SelectTrigger className="mt-1.5" data-testid="txn-currency-select"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Row 4: Account */}
                <div><Label>Account</Label>
                  <Select value={form.account_id} onValueChange={(v) => set("account_id", v)}>
                    <SelectTrigger className="mt-1.5" data-testid="txn-account-select"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>{accounts.map((a) => <SelectItem key={a.account_id} value={a.account_id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {/* Row 5: Month + Department */}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Month</Label><Input placeholder="e.g. Jan-2026" value={form.month} onChange={(e) => set("month", e.target.value)} className="mt-1.5" /></div>
                  <div><Label>Department</Label><Input placeholder="e.g. MARKETING" value={form.department} onChange={(e) => set("department", e.target.value)} className="mt-1.5" /></div>
                </div>
                {/* Row 6: Category + Subcategory */}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Category</Label><Input value={form.category} onChange={(e) => set("category", e.target.value)} className="mt-1.5" data-testid="txn-category-input" /></div>
                  <div><Label>Subcategory</Label><Input value={form.subcategory} onChange={(e) => set("subcategory", e.target.value)} className="mt-1.5" /></div>
                </div>
                {/* Row 7: Ledger + Vendor */}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Ledger</Label><Input value={form.ledger} onChange={(e) => set("ledger", e.target.value)} className="mt-1.5" /></div>
                  <div><Label>Vendor</Label><Input value={form.vendor} onChange={(e) => set("vendor", e.target.value)} className="mt-1.5" /></div>
                </div>
                {/* Row 8: txId */}
                <div><Label>Transaction ID (txId)</Label><Input placeholder="e.g. 1012026-001" value={form.tx_id} onChange={(e) => set("tx_id", e.target.value)} className="mt-1.5" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={!form.description || !form.amount || !form.account_id} className="bg-moss hover:bg-[#3D5247] text-white" data-testid="txn-submit-btn">
                  {editing ? "Save" : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "1100px" }}>
            <thead>
              <tr className="text-left bg-[#F9F8F6]">
                <th className="px-4 py-3 label-eyebrow text-[10px] whitespace-nowrap">Month</th>
                <th className="px-4 py-3 label-eyebrow text-[10px] whitespace-nowrap">Date</th>
                <th className="px-4 py-3 label-eyebrow text-[10px]">Description</th>
                <th className="px-4 py-3 label-eyebrow text-[10px] whitespace-nowrap">Department</th>
                <th className="px-4 py-3 label-eyebrow text-[10px] whitespace-nowrap">Category</th>
                <th className="px-4 py-3 label-eyebrow text-[10px] whitespace-nowrap">Subcategory</th>
                <th className="px-4 py-3 label-eyebrow text-[10px] whitespace-nowrap">Ledger</th>
                <th className="px-4 py-3 label-eyebrow text-[10px]">Vendor</th>
                <th className="px-4 py-3 label-eyebrow text-[10px] text-right whitespace-nowrap">Amount</th>
                <th className="px-4 py-3 label-eyebrow text-[10px] whitespace-nowrap">txId</th>
                <th className="px-4 py-3 label-eyebrow text-[10px] text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="11" className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-[#F2F0ED] flex items-center justify-center"><Receipt className="w-5 h-5 text-[#5C5C5C]" strokeWidth={1.5} /></div>
                    <div className="text-sm font-medium text-[#1A1A1A]">No transactions yet</div>
                    <div className="text-xs text-[#5C5C5C]">Add a transaction manually or import from Integrations.</div>
                  </div>
                </td></tr>
              ) : items.map((t) => (
                <tr key={t.txn_id} className="border-t border-cream hover:bg-[#F9F8F6]">
                  <td className="px-4 py-3 text-[#5C5C5C] whitespace-nowrap text-xs">{t.month || "—"}</td>
                  <td className="px-4 py-3 text-[#5C5C5C] whitespace-nowrap">{fmtDate(t.date)}</td>
                  <td className="px-4 py-3 text-[#1A1A1A] max-w-[200px]">
                    <span className="block truncate" title={t.description}>{t.description}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5C5C5C] whitespace-nowrap">{t.department || "—"}</td>
                  <td className="px-4 py-3 text-xs text-[#5C5C5C] max-w-[140px]">
                    <span className="block truncate" title={t.category}>{t.category || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5C5C5C] max-w-[140px]">
                    <span className="block truncate" title={t.subcategory}>{t.subcategory || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5C5C5C] max-w-[140px]">
                    <span className="block truncate" title={t.ledger}>{t.ledger || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5C5C5C] max-w-[160px]">
                    <span className="block truncate" title={t.vendor}>{t.vendor || "—"}</span>
                  </td>
                  <td className={`px-4 py-3 text-right numeric whitespace-nowrap ${t.type === "credit" ? "text-moss" : "text-terracotta"}`}>
                    {t.type === "credit" ? "+" : "-"}{fmtCurrency(t.amount, t.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#5C5C5C] font-mono whitespace-nowrap">{t.tx_id || "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(t)} className="p-1.5 text-[#5C5C5C] hover:text-moss" data-testid={`edit-txn-${t.txn_id}`}><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remove(t.txn_id)} className="p-1.5 text-[#5C5C5C] hover:text-terracotta" data-testid={`delete-txn-${t.txn_id}`}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
