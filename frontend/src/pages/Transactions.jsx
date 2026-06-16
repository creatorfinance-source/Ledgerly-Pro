import { useEffect, useState } from "react";
import api, { CURRENCIES, fmtCurrency, fmtDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Pencil, Receipt, Filter, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [filter, setFilter] = useState({ source: "", account_id: "", search: "" });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.source) params.source = filter.source;
      if (filter.account_id) params.account_id = filter.account_id;
      const [t, a] = await Promise.all([api.get("/transactions", { params }), api.get("/accounts")]);
      setItems(t.data);
      setAccounts(a.data);
    } catch {
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter.source, filter.account_id]); // eslint-disable-line

  const filteredItems = items.filter(t => 
    t.description.toLowerCase().includes(filter.search.toLowerCase()) ||
    t.category?.toLowerCase().includes(filter.search.toLowerCase()) ||
    t.vendor?.toLowerCase().includes(filter.search.toLowerCase())
  );

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
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto" data-testid="transactions-page">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-6">
        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="label-eyebrow text-muted-foreground">Ledger</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight text-foreground" style={{ fontFamily: "Outfit" }}>Transactions</h1>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search description, category..." 
              className="pl-9 h-10 border-border bg-card"
              value={filter.search}
              onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))}
            />
          </div>

          <Select value={filter.source || "all"} onValueChange={(v) => setFilter((f) => ({ ...f, source: v === "all" ? "" : v }))}>
            <SelectTrigger className="w-full sm:w-40 h-10 border-border bg-card" data-testid="filter-source">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <SelectValue placeholder="All sources" />
              </div>
            </SelectTrigger>
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
              <Button className="w-full sm:w-auto h-10 bg-primary text-primary-foreground hover:opacity-90" data-testid="add-transaction-btn">
                <Plus className="w-4 h-4 mr-1.5" /> New transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-card border-border">
              <DialogHeader>
                <DialogTitle style={{ fontFamily: "Outfit" }} className="text-2xl font-light">
                  {editing ? "Edit transaction" : "New transaction"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className="bg-background" data-testid="txn-date-input" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Type</Label>
                    <Select value={form.type} onValueChange={(v) => set("type", v)}>
                      <SelectTrigger className="bg-background" data-testid="txn-type-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credit">Credit (income)</SelectItem>
                        <SelectItem value="debit">Debit (expense)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Description</Label>
                  <Input value={form.description} onChange={(e) => set("description", e.target.value)} className="bg-background" data-testid="txn-desc-input" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Amount</Label>
                    <Input type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} className="bg-background" data-testid="txn-amount-input" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Currency</Label>
                    <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                      <SelectTrigger className="bg-background" data-testid="txn-currency-select"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Account</Label>
                  <Select value={form.account_id} onValueChange={(v) => set("account_id", v)}>
                    <SelectTrigger className="bg-background" data-testid="txn-account-select"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>{accounts.map((a) => <SelectItem key={a.account_id} value={a.account_id}>{a.code} · {a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Month</Label>
                    <Input placeholder="e.g. Jan-2026" value={form.month} onChange={(e) => set("month", e.target.value)} className="bg-background" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Department</Label>
                    <Input placeholder="e.g. MARKETING" value={form.department} onChange={(e) => set("department", e.target.value)} className="bg-background" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Category</Label>
                    <Input value={form.category} onChange={(e) => set("category", e.target.value)} className="bg-background" data-testid="txn-category-input" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Subcategory</Label>
                    <Input value={form.subcategory} onChange={(e) => set("subcategory", e.target.value)} className="bg-background" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Ledger</Label>
                    <Input value={form.ledger} onChange={(e) => set("ledger", e.target.value)} className="bg-background" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Vendor</Label>
                    <Input value={form.vendor} onChange={(e) => set("vendor", e.target.value)} className="bg-background" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Transaction ID (txId)</Label>
                  <Input placeholder="e.g. 1012026-001" value={form.tx_id} onChange={(e) => set("tx_id", e.target.value)} className="bg-background" />
                </div>
              </div>
              <DialogFooter className="border-t border-border pt-4">
                <Button variant="outline" onClick={() => setOpen(false)} className="border-border text-muted-foreground">Cancel</Button>
                <Button onClick={submit} disabled={!form.description || !form.amount || !form.account_id} className="bg-primary text-primary-foreground hover:opacity-90" data-testid="txn-submit-btn">
                  {editing ? "Save changes" : "Add transaction"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="surface-card overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-muted/30 border-b border-border">
                <th className="px-4 py-4 label-eyebrow text-[10px] text-muted-foreground whitespace-nowrap">Month</th>
                <th className="px-4 py-4 label-eyebrow text-[10px] text-muted-foreground whitespace-nowrap">Date</th>
                <th className="px-4 py-4 label-eyebrow text-[10px] text-muted-foreground">Description</th>
                <th className="px-4 py-4 label-eyebrow text-[10px] text-muted-foreground whitespace-nowrap hidden md:table-cell">Department</th>
                <th className="px-4 py-4 label-eyebrow text-[10px] text-muted-foreground whitespace-nowrap hidden lg:table-cell">Category</th>
                <th className="px-4 py-4 label-eyebrow text-[10px] text-muted-foreground whitespace-nowrap text-right">Amount</th>
                <th className="px-4 py-4 label-eyebrow text-[10px] text-muted-foreground whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan="7" className="px-4 py-4"><div className="h-6 bg-muted rounded animate-pulse w-full" /></td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                      <Receipt className="w-6 h-6 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="text-base font-medium text-foreground">No transactions found</div>
                      <div className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                        {filter.search ? "Try a different search term or clear the filters." : "Add your first transaction manually or connect an integration to sync data."}
                      </div>
                    </div>
                    {filter.search && (
                      <Button variant="ghost" size="sm" onClick={() => setFilter(f => ({ ...f, search: "" }))} className="text-primary mt-2">
                        Clear search
                      </Button>
                    )}
                  </div>
                </td></tr>
              ) : filteredItems.map((t, idx) => (
                <tr key={t.txn_id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-4 text-muted-foreground whitespace-nowrap text-xs">{t.month || "—"}</td>
                  <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{fmtDate(t.date)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground font-medium truncate max-w-[180px] sm:max-w-[300px]" title={t.description}>{t.description}</span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider lg:hidden">{t.category || "Uncategorized"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground whitespace-nowrap hidden md:table-cell">{t.department || "—"}</td>
                  <td className="px-4 py-4 text-xs text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                    <span className="px-2 py-0.5 rounded-full border border-border bg-secondary/50 truncate max-w-[120px] block" title={t.category}>
                      {t.category || "—"}
                    </span>
                  </td>
                  <td className={cn(
                    "px-4 py-4 text-right numeric whitespace-nowrap font-medium",
                    t.type === "credit" ? "text-primary" : "text-destructive"
                  )}>
                    {t.type === "credit" ? "+" : "-"}{fmtCurrency(t.amount, t.currency)}
                  </td>
                  <td className="px-4 py-4 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => startEdit(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(t.txn_id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
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
