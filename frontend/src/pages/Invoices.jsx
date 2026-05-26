import { useEffect, useState } from "react";
import api, { CURRENCIES, fmtCurrency, fmtDate } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, X } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["draft", "sent", "paid", "overdue"];
const STATUS_STYLE = {
  draft: "bg-[#F2F0ED] text-[#5C5C5C]",
  sent: "bg-[#EFF1ED] text-[#3D5247]",
  paid: "bg-[#EAF1EC] text-[#4A6B53]",
  overdue: "bg-[#FBEDE9] text-terracotta",
};

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

const DEFAULT = () => ({
  customer_name: "",
  customer_email: "",
  issue_date: today(),
  due_date: inDays(14),
  line_items: [{ description: "", quantity: 1, unit_price: 0 }],
  tax_rate: 0,
  currency: "USD",
  notes: "",
});

export default function Invoices() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT());
  const [view, setView] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/invoices");
      setItems(data);
    } catch {
      toast.error("Failed to load invoices");
    }
  };

  useEffect(() => { load(); }, []);

  const subtotal = form.line_items.reduce((s, li) => s + (Number(li.quantity || 0) * Number(li.unit_price || 0)), 0);
  const taxAmt = (subtotal * Number(form.tax_rate || 0)) / 100;
  const total = subtotal + taxAmt;

  const updateLine = (idx, key, val) => {
    const li = [...form.line_items];
    li[idx] = { ...li[idx], [key]: val };
    setForm({ ...form, line_items: li });
  };

  const addLine = () => setForm({ ...form, line_items: [...form.line_items, { description: "", quantity: 1, unit_price: 0 }] });
  const removeLine = (i) => setForm({ ...form, line_items: form.line_items.filter((_, x) => x !== i) });

  const submit = async () => {
    try {
      const payload = { ...form, line_items: form.line_items.map((li) => ({ ...li, quantity: Number(li.quantity), unit_price: Number(li.unit_price) })) };
      await api.post("/invoices", payload);
      toast.success("Invoice created");
      setOpen(false);
      setForm(DEFAULT());
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const setStatus = async (id, status) => {
    await api.patch(`/invoices/${id}`, { status });
    toast.success(`Marked ${status}`);
    load();
  };

  const remove = async (id) => {
    await api.delete(`/invoices/${id}`);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="p-6 md:p-8" data-testid="invoices-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="label-eyebrow">Sales</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>Invoices</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-moss hover:bg-[#3D5247] text-white" data-testid="add-invoice-btn"><Plus className="w-4 h-4 mr-1" /> New invoice</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle style={{ fontFamily: "Outfit" }}>New invoice</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Customer name</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="mt-1.5" data-testid="inv-customer-name" /></div>
                <div><Label>Customer email</Label><Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} className="mt-1.5" data-testid="inv-customer-email" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Issue date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} className="mt-1.5" /></div>
                <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="mt-1.5" /></div>
                <div><Label>Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Line items</Label>
                <div className="mt-2 space-y-2">
                  {form.line_items.map((li, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <Input placeholder="Description" value={li.description} onChange={(e) => updateLine(i, "description", e.target.value)} className="col-span-6" data-testid={`inv-line-desc-${i}`} />
                      <Input type="number" placeholder="Qty" value={li.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} className="col-span-2" />
                      <Input type="number" step="0.01" placeholder="Unit price" value={li.unit_price} onChange={(e) => updateLine(i, "unit_price", e.target.value)} className="col-span-3" />
                      <button onClick={() => removeLine(i)} className="col-span-1 p-2 text-[#5C5C5C] hover:text-terracotta"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addLine} className="mt-3" data-testid="inv-add-line"><Plus className="w-3 h-3 mr-1" /> Add line</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tax rate (%)</Label><Input type="number" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} className="mt-1.5" /></div>
                <div className="flex flex-col items-end justify-end">
                  <div className="text-xs text-[#5C5C5C]">Subtotal: <span className="numeric text-[#1A1A1A]">{fmtCurrency(subtotal, form.currency)}</span></div>
                  <div className="text-xs text-[#5C5C5C]">Tax: <span className="numeric text-[#1A1A1A]">{fmtCurrency(taxAmt, form.currency)}</span></div>
                  <div className="mt-1 text-lg numeric text-moss" style={{ fontFamily: "Outfit" }}>{fmtCurrency(total, form.currency)}</div>
                </div>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1.5" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="bg-moss hover:bg-[#3D5247] text-white" onClick={submit} disabled={!form.customer_name} data-testid="inv-submit-btn">Create invoice</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-[#F9F8F6]">
                <th className="px-6 py-3 label-eyebrow text-[10px]">Number</th>
                <th className="px-6 py-3 label-eyebrow text-[10px]">Customer</th>
                <th className="px-6 py-3 label-eyebrow text-[10px]">Issue</th>
                <th className="px-6 py-3 label-eyebrow text-[10px]">Due</th>
                <th className="px-6 py-3 label-eyebrow text-[10px]">Status</th>
                <th className="px-6 py-3 label-eyebrow text-[10px] text-right">Total</th>
                <th className="px-6 py-3 label-eyebrow text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-[#F2F0ED] flex items-center justify-center"><FileText className="w-5 h-5 text-[#5C5C5C]" strokeWidth={1.5} /></div>
                    <div className="text-sm font-medium text-[#1A1A1A]">No invoices yet</div>
                    <div className="text-xs text-[#5C5C5C]">Create your first invoice to get started.</div>
                  </div>
                </td></tr>
              ) : items.map((inv) => (
                <tr key={inv.invoice_id} className="border-t border-cream hover:bg-[#F9F8F6]">
                  <td className="px-6 py-3 numeric text-[#1A1A1A] font-medium cursor-pointer" onClick={() => setView(inv)} data-testid={`view-inv-${inv.invoice_id}`}>{inv.number}</td>
                  <td className="px-6 py-3 text-[#1A1A1A]">{inv.customer_name}</td>
                  <td className="px-6 py-3 text-[#5C5C5C]">{fmtDate(inv.issue_date)}</td>
                  <td className="px-6 py-3 text-[#5C5C5C]">{fmtDate(inv.due_date)}</td>
                  <td className="px-6 py-3">
                    <Select value={inv.status} onValueChange={(v) => setStatus(inv.invoice_id, v)}>
                      <SelectTrigger className={`h-7 px-2 text-[10px] uppercase tracking-wider w-28 ${STATUS_STYLE[inv.status]}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-3 text-right numeric text-[#1A1A1A]">{fmtCurrency(inv.total, inv.currency)}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => setView(inv)} className="p-1.5 text-[#5C5C5C] hover:text-moss"><FileText className="w-4 h-4" /></button>
                    <button onClick={() => remove(inv.invoice_id)} className="p-1.5 text-[#5C5C5C] hover:text-terracotta"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View invoice */}
      <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="max-w-2xl">
          {view && (
            <>
              <DialogHeader><DialogTitle style={{ fontFamily: "Outfit" }}>Invoice {view.number}</DialogTitle></DialogHeader>
              <div>
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <div>
                    <div className="label-eyebrow">Bill to</div>
                    <div className="mt-1 text-[#1A1A1A]">{view.customer_name}</div>
                    <div className="text-sm text-[#5C5C5C]">{view.customer_email}</div>
                  </div>
                  <div className="text-right">
                    <div className="label-eyebrow">Issue / Due</div>
                    <div className="mt-1">{fmtDate(view.issue_date)}</div>
                    <div className="text-sm text-[#5C5C5C]">{fmtDate(view.due_date)}</div>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[#5C5C5C] border-b border-cream"><th className="py-2">Item</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Unit</th><th className="py-2 text-right">Total</th></tr></thead>
                  <tbody>
                    {view.line_items.map((li, i) => (
                      <tr key={i} className="border-b border-cream"><td className="py-2">{li.description}</td><td className="py-2 text-right numeric">{li.quantity}</td><td className="py-2 text-right numeric">{fmtCurrency(li.unit_price, view.currency)}</td><td className="py-2 text-right numeric">{fmtCurrency(li.quantity * li.unit_price, view.currency)}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 text-right space-y-1 text-sm">
                  <div>Subtotal: <span className="numeric ml-3">{fmtCurrency(view.subtotal, view.currency)}</span></div>
                  <div>Tax ({view.tax_rate}%): <span className="numeric ml-3">{fmtCurrency(view.tax_amount, view.currency)}</span></div>
                  <div className="text-2xl mt-2 text-moss" style={{ fontFamily: "Outfit" }}><span className="numeric">{fmtCurrency(view.total, view.currency)}</span></div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
