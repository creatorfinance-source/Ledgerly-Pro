import { useEffect, useState } from "react";
import api, { CURRENCIES, fmtCurrency, fmtDate } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
const DEFAULT = () => ({
  payer_name: "",
  issue_date: today(),
  line_items: [{ description: "", quantity: 1, unit_price: 0 }],
  tax_rate: 0,
  currency: "USD",
  method: "cash",
  notes: "",
});

export default function Receipts() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT());

  const load = async () => {
    try {
      setItems((await api.get("/receipts")).data);
    } catch {
      toast.error("Failed to load receipts");
    }
  };
  useEffect(() => { load(); }, []);

  const subtotal = form.line_items.reduce((s, li) => s + (Number(li.quantity || 0) * Number(li.unit_price || 0)), 0);
  const total = subtotal + (subtotal * Number(form.tax_rate || 0)) / 100;

  const updateLine = (idx, key, val) => {
    const li = [...form.line_items]; li[idx] = { ...li[idx], [key]: val }; setForm({ ...form, line_items: li });
  };
  const addLine = () => setForm({ ...form, line_items: [...form.line_items, { description: "", quantity: 1, unit_price: 0 }] });
  const removeLine = (i) => setForm({ ...form, line_items: form.line_items.filter((_, x) => x !== i) });

  const submit = async () => {
    try {
      await api.post("/receipts", { ...form, line_items: form.line_items.map((li) => ({ ...li, quantity: Number(li.quantity), unit_price: Number(li.unit_price) })) });
      toast.success("Receipt created");
      setOpen(false); setForm(DEFAULT()); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const remove = async (id) => { await api.delete(`/receipts/${id}`); toast.success("Deleted"); load(); };

  return (
    <div className="p-6 md:p-8" data-testid="receipts-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="label-eyebrow">Sales</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>Receipts</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-moss hover:bg-[#3D5247] text-white" data-testid="add-receipt-btn"><Plus className="w-4 h-4 mr-1" /> New receipt</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle style={{ fontFamily: "Outfit" }}>New receipt</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Payer name</Label><Input value={form.payer_name} onChange={(e) => setForm({ ...form, payer_name: e.target.value })} className="mt-1.5" data-testid="rcp-payer" /></div>
                <div><Label>Issue date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} className="mt-1.5" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Method</Label>
                  <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem><SelectItem value="card">Card</SelectItem></SelectContent>
                  </Select>
                </div>
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
                      <Input placeholder="Description" value={li.description} onChange={(e) => updateLine(i, "description", e.target.value)} className="col-span-6" />
                      <Input type="number" placeholder="Qty" value={li.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} className="col-span-2" />
                      <Input type="number" step="0.01" placeholder="Unit price" value={li.unit_price} onChange={(e) => updateLine(i, "unit_price", e.target.value)} className="col-span-3" />
                      <button onClick={() => removeLine(i)} className="col-span-1 p-2 text-[#5C5C5C] hover:text-terracotta"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addLine} className="mt-3"><Plus className="w-3 h-3 mr-1" /> Add line</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tax rate (%)</Label><Input type="number" step="0.01" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} className="mt-1.5" /></div>
                <div className="flex flex-col items-end justify-end">
                  <div className="text-xs text-[#5C5C5C]">Subtotal: <span className="numeric text-[#1A1A1A]">{fmtCurrency(subtotal, form.currency)}</span></div>
                  <div className="mt-1 text-lg numeric text-moss" style={{ fontFamily: "Outfit" }}>{fmtCurrency(total, form.currency)}</div>
                </div>
              </div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1.5" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="bg-moss hover:bg-[#3D5247] text-white" onClick={submit} disabled={!form.payer_name} data-testid="rcp-submit-btn">Create</Button>
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
                <th className="px-6 py-3 label-eyebrow text-[10px]">Payer</th>
                <th className="px-6 py-3 label-eyebrow text-[10px]">Method</th>
                <th className="px-6 py-3 label-eyebrow text-[10px]">Issue</th>
                <th className="px-6 py-3 label-eyebrow text-[10px] text-right">Total</th>
                <th className="px-6 py-3 label-eyebrow text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-[#F2F0ED] flex items-center justify-center"><Plus className="w-5 h-5 text-[#5C5C5C]" strokeWidth={1.5} /></div>
                    <div className="text-sm font-medium text-[#1A1A1A]">No receipts yet</div>
                    <div className="text-xs text-[#5C5C5C]">Create your first receipt to get started.</div>
                  </div>
                </td></tr>
              ) : items.map((r) => (
                <tr key={r.receipt_id} className="border-t border-cream hover:bg-[#F9F8F6]">
                  <td className="px-6 py-3 numeric text-[#1A1A1A] font-medium">{r.number}</td>
                  <td className="px-6 py-3">{r.payer_name}</td>
                  <td className="px-6 py-3 text-[#5C5C5C] capitalize">{r.method}</td>
                  <td className="px-6 py-3 text-[#5C5C5C]">{fmtDate(r.issue_date)}</td>
                  <td className="px-6 py-3 text-right numeric">{fmtCurrency(r.total, r.currency)}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => remove(r.receipt_id)} className="p-1.5 text-[#5C5C5C] hover:text-terracotta"><Trash2 className="w-4 h-4" /></button>
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
