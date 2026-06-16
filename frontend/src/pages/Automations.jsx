import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SkeletonTable } from "@/components/Preloader";
import {
  Plus, Zap, Play, Trash2, Edit2, Clock,
  Bell, Tag, FileText, BookText, CheckCircle2, XCircle,
} from "lucide-react";

const TRIGGER_META = {
  schedule:            { label: "Schedule (cron)", icon: Clock,     color: "bg-blue-500/10 text-blue-500" },
  transaction_created: { label: "Transaction Created", icon: Zap,   color: "bg-emerald-500/10 text-emerald-500" },
  invoice_overdue:     { label: "Invoice Overdue",     icon: Bell,  color: "bg-amber-500/10 text-amber-500" },
  balance_threshold:   { label: "Balance Threshold",   icon: CheckCircle2, color: "bg-purple-500/10 text-purple-500" },
};

const ACTION_META = {
  notify:                { label: "Send Notification",   icon: Bell,     color: "bg-sky-500/10 text-sky-500" },
  tag_transaction:       { label: "Tag Transaction",     icon: Tag,      color: "bg-teal-500/10 text-teal-500" },
  generate_report:       { label: "Generate Report",     icon: FileText, color: "bg-violet-500/10 text-violet-500" },
  create_journal_entry:  { label: "Create Journal Entry",icon: BookText, color: "bg-rose-500/10 text-rose-500" },
};

const EMPTY_FORM = {
  name: "",
  description: "",
  trigger_type: "schedule",
  trigger_config: {},
  action_type: "notify",
  action_config: {},
};

// ── Form ─────────────────────────────────────────────────────────────────────
function AutomationForm({ initial, onSubmit, onClose }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const triggerMeta = TRIGGER_META[form.trigger_type];
  const actionMeta  = ACTION_META[form.action_type];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-1">
      <div className="space-y-1.5">
        <Label>Name <span className="text-destructive">*</span></Label>
        <Input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Monthly P&L Alert" required />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={(e) => set("description")(e.target.value)} placeholder="What does this automation do?" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Trigger</Label>
          <Select value={form.trigger_type} onValueChange={set("trigger_type")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TRIGGER_META).map(([v, m]) => (
                <SelectItem key={v} value={v}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {triggerMeta && (
            <div className={`flex items-center gap-1.5 text-xs rounded px-2 py-1 ${triggerMeta.color}`}>
              <triggerMeta.icon className="w-3 h-3" />
              {triggerMeta.label}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Action</Label>
          <Select value={form.action_type} onValueChange={set("action_type")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ACTION_META).map(([v, m]) => (
                <SelectItem key={v} value={v}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {actionMeta && (
            <div className={`flex items-center gap-1.5 text-xs rounded px-2 py-1 ${actionMeta.color}`}>
              <actionMeta.icon className="w-3 h-3" />
              {actionMeta.label}
            </div>
          )}
        </div>
      </div>

      {/* Trigger config */}
      {form.trigger_type === "schedule" && (
        <div className="space-y-1.5">
          <Label>Cron Expression</Label>
          <Input
            placeholder="0 9 * * 1  (Monday 9am)"
            value={form.trigger_config?.cron || ""}
            onChange={(e) => set("trigger_config")({ cron: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Uses standard 5-field cron format.</p>
        </div>
      )}
      {form.trigger_type === "balance_threshold" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Threshold Amount</Label>
            <Input
              type="number"
              placeholder="10000"
              value={form.trigger_config?.threshold || ""}
              onChange={(e) => set("trigger_config")({ ...form.trigger_config, threshold: parseFloat(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Direction</Label>
            <Select
              value={form.trigger_config?.direction || "below"}
              onValueChange={(v) => set("trigger_config")({ ...form.trigger_config, direction: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="below">Falls Below</SelectItem>
                <SelectItem value="above">Rises Above</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Action config */}
      {form.action_type === "notify" && (
        <div className="space-y-1.5">
          <Label>Notification Message</Label>
          <Input
            placeholder="Alert: your balance is below threshold"
            value={form.action_config?.message || ""}
            onChange={(e) => set("action_config")({ ...form.action_config, message: e.target.value })}
          />
        </div>
      )}
      {form.action_type === "tag_transaction" && (
        <div className="space-y-1.5">
          <Label>Tag Label</Label>
          <Input
            placeholder="auto:reviewed"
            value={form.action_config?.tag || ""}
            onChange={(e) => set("action_config")({ tag: e.target.value })}
          />
        </div>
      )}
      {form.action_type === "generate_report" && (
        <div className="space-y-1.5">
          <Label>Report Type</Label>
          <Select
            value={form.action_config?.type || "pnl"}
            onValueChange={(v) => set("action_config")({ type: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pnl">Profit & Loss</SelectItem>
              <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
              <SelectItem value="cash_flow">Cash Flow</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : initial ? "Update" : "Create"}</Button>
      </DialogFooter>
    </form>
  );
}

// ── Automation card ──────────────────────────────────────────────────────────
function AutomationCard({ rule, onToggle, onRun, onEdit, onDelete }) {
  const trigger = TRIGGER_META[rule.trigger_type] || TRIGGER_META.schedule;
  const action  = ACTION_META[rule.action_type]   || ACTION_META.notify;

  return (
    <Card className="surface-card border-0 animate-slide-up-fade">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${trigger.color}`}>
            <trigger.icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground">{rule.name}</span>
              <Badge variant={rule.is_active ? "default" : "secondary"} className="text-[10px]">
                {rule.is_active ? "Active" : "Paused"}
              </Badge>
            </div>
            {rule.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{rule.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${trigger.color}`}>
                <trigger.icon className="w-2.5 h-2.5" /> {trigger.label}
              </span>
              <span className="text-muted-foreground text-xs">→</span>
              <span className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${action.color}`}>
                <action.icon className="w-2.5 h-2.5" /> {action.label}
              </span>
            </div>
            {rule.last_run_at && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Last run: {format(new Date(rule.last_run_at), "MMM d, yyyy HH:mm")} · {rule.run_count} runs
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Switch
              checked={rule.is_active}
              onCheckedChange={() => onToggle(rule)}
              title={rule.is_active ? "Pause" : "Activate"}
            />
            <button onClick={() => onRun(rule)} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-emerald-500" title="Run now">
              <Play className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onEdit(rule)} className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(rule)} className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Automations() {
  const [rules, setRules]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRule, setEditRule]     = useState(null);
  const [deleteRule, setDeleteRule] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/automations");
      setRules(data);
    } catch {
      toast.error("Failed to load automations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (form) => {
    const { data } = await api.post("/automations", form);
    setRules((r) => [data, ...r]);
    toast.success("Automation created");
  };

  const handleUpdate = async (form) => {
    const { data } = await api.patch(`/automations/${editRule.automation_id}`, form);
    setRules((r) => r.map((x) => (x.automation_id === data.automation_id ? data : x)));
    setEditRule(null);
    toast.success("Automation updated");
  };

  const handleToggle = async (rule) => {
    const { data } = await api.patch(`/automations/${rule.automation_id}`, { is_active: !rule.is_active });
    setRules((r) => r.map((x) => (x.automation_id === data.automation_id ? data : x)));
    toast.success(data.is_active ? "Automation activated" : "Automation paused");
  };

  const handleRun = async (rule) => {
    try {
      await api.post(`/automations/${rule.automation_id}/run`);
      toast.success(`"${rule.name}" triggered successfully`);
      load();
    } catch {
      toast.error("Failed to run automation");
    }
  };

  const handleDelete = async () => {
    if (!deleteRule) return;
    await api.delete(`/automations/${deleteRule.automation_id}`);
    setRules((r) => r.filter((x) => x.automation_id !== deleteRule.automation_id));
    setDeleteRule(null);
    toast.success("Automation deleted");
  };

  const active   = rules.filter((r) => r.is_active).length;
  const totalRuns = rules.reduce((s, r) => s + (r.run_count || 0), 0);

  return (
    <div className="p-4 md:p-6 space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text" style={{ fontFamily: "Outfit" }}>Automations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Rule-based workflows — trigger actions automatically</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Automation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Rules",  value: rules.length, color: "text-foreground" },
          { label: "Active",       value: active,        color: "text-emerald-500" },
          { label: "Total Runs",   value: totalRuns,     color: "text-blue-400" },
        ].map(({ label, value, color }) => (
          <Card key={label} className="surface-card border-0">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold kpi-value ${color}`}>{value}</p>
              <p className="label-eyebrow text-[10px] text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rules list */}
      {loading ? (
        <SkeletonTable rows={4} cols={3} />
      ) : rules.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30 animate-float" />
          <p className="font-medium">No automations yet</p>
          <p className="text-sm mt-1">Create your first rule to automate repetitive tasks</p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Automation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <AutomationCard
              key={rule.automation_id}
              rule={rule}
              onToggle={handleToggle}
              onRun={handleRun}
              onEdit={setEditRule}
              onDelete={setDeleteRule}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Automation</DialogTitle>
            <DialogDescription>Define a trigger and the action to run.</DialogDescription>
          </DialogHeader>
          <AutomationForm onSubmit={handleCreate} onClose={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editRule} onOpenChange={(o) => !o && setEditRule(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Automation</DialogTitle>
          </DialogHeader>
          {editRule && (
            <AutomationForm initial={editRule} onSubmit={handleUpdate} onClose={() => setEditRule(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteRule} onOpenChange={(o) => !o && setDeleteRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete automation?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteRule?.name}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
