import { useEffect, useRef, useState } from "react";
import api, { CURRENCIES } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Layers, Check, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
];

const TYPE_COLOR = {
  asset: "bg-[#F2F0ED] text-moss",
  liability: "bg-[#FEEAE6] text-terracotta",
  equity: "bg-[#EFF1ED] text-[#3D5247]",
  income: "bg-[#EAF1EC] text-[#4A6B53]",
  expense: "bg-[#FBEDE9] text-terracotta",
};

const DEFAULT = () => ({ name: "", code: "", type: "asset", currency: "USD", description: "" });

// Inline editable cell — click to activate
function InlineCell({ value, onCommit, className = "", inputClassName = "", type = "text", tabIndex }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  const commit = () => { setEditing(false); if (draft !== value) onCommit(draft); };
  const cancel = () => { setEditing(false); setDraft(value); };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") cancel();
    if (e.key === "Tab") { e.preventDefault(); commit(); }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={cn("w-full border border-moss rounded px-2 py-1 text-sm outline-none bg-white ring-1 ring-moss", inputClassName)}
        tabIndex={tabIndex}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className={cn("block cursor-text rounded px-1 py-0.5 hover:bg-[#F2F0ED] transition-colors group", className)}
      title="Click to edit"
      tabIndex={tabIndex}
      onFocus={() => { setDraft(value); setEditing(true); }}
    >
      {value || <span className="text-[#BDBDBD] italic text-xs">—</span>}
      <Pencil className="w-3 h-3 ml-1 inline opacity-0 group-hover:opacity-40 transition-opacity text-[#5C5C5C]" />
    </span>
  );
}

// Quick-add row at the bottom of each group
function QuickAddRow({ type, onAdded }) {
  const [active, setActive] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", currency: "USD" });
  const codeRef = useRef(null);

  useEffect(() => { if (active) codeRef.current?.focus(); }, [active]);

  const submit = async () => {
    if (!form.code || !form.name) { toast.error("Code and name are required"); return; }
    try {
      await api.post("/accounts", { ...form, type });
      toast.success("Account added");
      setForm({ code: "", name: "", currency: "USD" });
      setActive(false);
      onAdded();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to add account");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { setActive(false); setForm({ code: "", name: "", currency: "USD" }); }
  };

  if (!active) {
    return (
      <tr>
        <td colSpan="4" className="px-4 py-2 border-t border-cream">
          <button
            onClick={() => setActive(true)}
            className="flex items-center gap-1.5 text-xs text-[#9E9E9E] hover:text-moss transition-colors group"
          >
            <Plus className="w-3.5 h-3.5 group-hover:text-moss" />
            Add account
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-moss/20 bg-[#F7FAF7]">
      <td className="px-3 py-2 w-24">
        <input
          ref={codeRef}
          placeholder="Code"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); else handleKeyDown(e); }}
          className="w-full border border-moss rounded px-2 py-1 text-xs outline-none bg-white ring-1 ring-moss"
        />
      </td>
      <td className="px-3 py-2">
        <input
          placeholder="Account name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); else handleKeyDown(e); }}
          className="w-full border border-moss rounded px-2 py-1 text-xs outline-none bg-white ring-1 ring-moss"
        />
      </td>
      <td className="px-3 py-2 w-20">
        <select
          value={form.currency}
          onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          className="w-full border border-moss rounded px-1 py-1 text-xs outline-none bg-white"
        >
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <button onClick={submit} className="p-1 text-moss hover:bg-[#EEF2ED] rounded" title="Save (Enter)">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setActive(false); setForm({ code: "", name: "", currency: "USD" }); }} className="p-1 text-[#5C5C5C] hover:text-terracotta hover:bg-[#FEEAE6] rounded" title="Cancel (Esc)">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Accounts() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT());
  const [savingId, setSavingId] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/accounts");
      setItems(data);
    } catch {
      toast.error("Failed to load accounts");
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await api.post("/accounts", form);
      toast.success("Account added");
      setOpen(false);
      setForm(DEFAULT());
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };

  const remove = async (id) => {
    await api.delete(`/accounts/${id}`);
    toast.success("Deleted");
    load();
  };

  const patchField = async (id, field, value) => {
    if (savingId === id) return;
    setSavingId(id);
    try {
      await api.patch(`/accounts/${id}`, { [field]: value });
      setItems((prev) => prev.map((a) => a.account_id === id ? { ...a, [field]: value } : a));
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save");
      load(); // revert
    } finally {
      setSavingId(null);
    }
  };

  const grouped = TYPES.map(({ value, label }) => ({
    label,
    type: value,
    rows: items.filter((a) => a.type === value),
  }));

  return (
    <div className="p-6 md:p-8" data-testid="accounts-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="label-eyebrow">Bookkeeping</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>Chart of accounts</h1>
          <p className="mt-1 text-xs text-[#5C5C5C]">Click any cell to edit inline · Tab to advance · Enter to save · Esc to cancel</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-moss hover:bg-[#3D5247] text-white" data-testid="add-account-btn">
              <Plus className="w-4 h-4 mr-1" /> New account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle style={{ fontFamily: "Outfit" }}>New account</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1.5" data-testid="acc-code-input" /></div>
                <div><Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger className="mt-1.5" data-testid="acc-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" data-testid="acc-name-input" /></div>
              <div><Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger className="mt-1.5" data-testid="acc-currency-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1.5" data-testid="acc-desc-input" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="bg-moss hover:bg-[#3D5247] text-white" onClick={submit} disabled={!form.name || !form.code} data-testid="acc-submit-btn">Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {grouped.map((g) => (
          <Card key={g.type} className="surface-card overflow-hidden" data-testid={`acc-group-${g.type}`}>
            <div className="px-5 py-3.5 border-b border-cream flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${TYPE_COLOR[g.type]}`}>{g.label}</span>
              <span className="label-eyebrow text-[10px]">{g.rows.length} account{g.rows.length !== 1 ? "s" : ""}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#FAFAF8]">
                  <th className="px-4 py-2 text-left label-eyebrow text-[10px] w-20">Code</th>
                  <th className="px-4 py-2 text-left label-eyebrow text-[10px]">Name</th>
                  <th className="px-4 py-2 text-left label-eyebrow text-[10px] w-20">CCY</th>
                  <th className="px-4 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {g.rows.length === 0 ? (
                  <tr><td colSpan="4" className="px-5 py-6 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Layers className="w-4 h-4 text-[#B0B0B0]" strokeWidth={1.5} />
                      <span className="text-xs text-[#5C5C5C]">No {g.label.toLowerCase()} accounts yet</span>
                    </div>
                  </td></tr>
                ) : g.rows.map((a) => (
                  <tr
                    key={a.account_id}
                    className={cn("border-t border-cream group/row transition-colors", savingId === a.account_id ? "bg-[#F7FAF7]" : "hover:bg-[#F9F8F6]")}
                  >
                    <td className="px-3 py-2 w-20">
                      <InlineCell
                        value={a.code}
                        onCommit={(v) => patchField(a.account_id, "code", v)}
                        className="numeric text-[#5C5C5C] text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <InlineCell
                        value={a.name}
                        onCommit={(v) => patchField(a.account_id, "name", v)}
                        className="text-[#1A1A1A] text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 w-20">
                      <InlineCell
                        value={a.currency}
                        onCommit={(v) => patchField(a.account_id, "currency", v)}
                        className="numeric text-[#5C5C5C] text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => remove(a.account_id)}
                        className="p-1.5 text-[#C0C0C0] hover:text-terracotta opacity-0 group-hover/row:opacity-100 transition-opacity"
                        data-testid={`delete-acc-${a.account_id}`}
                        title="Delete account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {/* ClickUp-style quick-add row */}
                <QuickAddRow type={g.type} onAdded={load} />
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </div>
  );
}
