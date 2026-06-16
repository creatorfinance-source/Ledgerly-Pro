import { useState, useEffect, useCallback } from "react";
import api, { fmtCurrency } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkeletonChart, SkeletonKPI } from "@/components/Preloader";
import {
  Plus, X, GripVertical, Settings2, RefreshCw,
  TrendingUp, TrendingDown, DollarSign, BarChart3,
  Maximize2, Download,
} from "lucide-react";

// ── Color palettes ──────────────────────────────────────────────────────────
const PALETTES = {
  moss:   ["#2A3B32", "#4a7c5e", "#7cb899", "#b8ddc8", "#e0f0e8"],
  ocean:  ["#1a3a5c", "#2563ab", "#60a5fa", "#bfdbfe", "#eff6ff"],
  sunset: ["#7c2020", "#c45e4c", "#f0956a", "#fcd5b0", "#fff1e8"],
  violet: ["#3b1f6e", "#7c3aed", "#a78bfa", "#ddd6fe", "#f5f3ff"],
  gold:   ["#6b4e0f", "#d4a017", "#fcd34d", "#fef3c7", "#fffbeb"],
};

const CHART_TYPES = [
  { value: "line",    label: "Line" },
  { value: "bar",     label: "Bar" },
  { value: "area",    label: "Area" },
  { value: "pie",     label: "Pie" },
  { value: "radar",   label: "Radar" },
  { value: "composed",label: "Combined" },
];

const DATA_SOURCES = [
  { value: "monthly_trend",       label: "Monthly Trend (P&L)" },
  { value: "expense_breakdown",   label: "Expense Breakdown" },
  { value: "revenue_vs_expenses", label: "Revenue vs Expenses" },
  { value: "net_profit",         label: "Net Profit Trend" },
];

const DEFAULT_WIDGETS = [
  { id: "w1", title: "Revenue Trend",       chartType: "area",    dataSource: "monthly_trend",       palette: "moss",   size: "lg" },
  { id: "w2", title: "Expense Breakdown",   chartType: "pie",     dataSource: "expense_breakdown",   palette: "sunset", size: "md" },
  { id: "w3", title: "Revenue vs Expenses", chartType: "bar",     dataSource: "revenue_vs_expenses", palette: "ocean",  size: "md" },
  { id: "w4", title: "Net Profit",          chartType: "line",    dataSource: "net_profit",          palette: "moss",   size: "md" },
  { id: "w5", title: "P&L Overview",        chartType: "composed",dataSource: "monthly_trend",       palette: "violet", size: "lg" },
  { id: "w6", title: "Cost Radar",          chartType: "radar",   dataSource: "expense_breakdown",   palette: "gold",   size: "md" },
];

// ── Tooltip ─────────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-semibold text-foreground">
            {typeof p.value === "number" ? fmtCurrency(p.value, currency) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Chart renderer ───────────────────────────────────────────────────────────
function ChartRenderer({ widget, data, currency }) {
  const colors = PALETTES[widget.palette] || PALETTES.moss;
  const h = widget.size === "lg" ? 280 : 220;
  const src = widget.dataSource;

  const chartData = (() => {
    if (src === "monthly_trend" || src === "revenue_vs_expenses" || src === "net_profit") {
      return data.monthly_trend || [];
    }
    if (src === "expense_breakdown") return data.expense_breakdown || [];
    return [];
  })();

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height: h }}>
        No data available
      </div>
    );
  }

  const tip = <CustomTooltip currency={currency} />;

  if (widget.chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="category"
            cx="50%" cy="50%"
            outerRadius={h * 0.36}
            innerRadius={h * 0.18}
            paddingAngle={2}
            label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={tip} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (widget.chartType === "radar") {
    const radarData = chartData.slice(0, 6).map((d) => ({
      subject: d.category || d.month,
      value: d.value || d.income || 0,
    }));
    return (
      <ResponsiveContainer width="100%" height={h}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <Radar dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.25} />
          <Tooltip content={tip} />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  if (widget.chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`g-income-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={colors[0]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors[0]} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`g-exp-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={colors[2]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors[2]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={tip} />
          <Legend />
          <Area type="monotone" dataKey="income"   stroke={colors[0]} fill={`url(#g-income-${widget.id})`} strokeWidth={2} name="Revenue" />
          <Area type="monotone" dataKey="expenses" stroke={colors[2]} fill={`url(#g-exp-${widget.id})`}    strokeWidth={2} name="Expenses" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (widget.chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={chartData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={tip} />
          <Legend />
          <Bar dataKey="income"   fill={colors[0]} radius={[3, 3, 0, 0]} name="Revenue" />
          <Bar dataKey="expenses" fill={colors[2]} radius={[3, 3, 0, 0]} name="Expenses" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (widget.chartType === "composed") {
    return (
      <ResponsiveContainer width="100%" height={h}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={tip} />
          <Legend />
          <Bar  dataKey="income"   fill={colors[0]} radius={[3, 3, 0, 0]} name="Revenue" opacity={0.8} />
          <Bar  dataKey="expenses" fill={colors[2]} radius={[3, 3, 0, 0]} name="Expenses" opacity={0.8} />
          <Line type="monotone" dataKey="profit" stroke={colors[1]} strokeWidth={2.5} dot={{ r: 3 }} name="Net Profit" />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // Default: line
  const key = src === "net_profit" ? "profit" : "income";
  return (
    <ResponsiveContainer width="100%" height={h}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip content={tip} />
        <Legend />
        <Line type="monotone" dataKey={key} stroke={colors[0]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name={key} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Widget card ──────────────────────────────────────────────────────────────
function WidgetCard({ widget, data, currency, onEdit, onRemove }) {
  return (
    <div
      className={[
        "chart-panel surface-card flex flex-col",
        "animate-scale-in",
        widget.size === "lg" ? "col-span-2" : "col-span-1",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 cursor-grab" />
        <h3 className="font-semibold text-sm text-foreground flex-1 truncate">{widget.title}</h3>
        <Badge variant="outline" className="text-[10px] shrink-0 capitalize">{widget.chartType}</Badge>
        <button
          onClick={() => onEdit(widget)}
          className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onRemove(widget.id)}
          className="p-1 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-2 pb-4 flex-1">
        <ChartRenderer widget={widget} data={data} currency={currency} />
      </div>
    </div>
  );
}

// ── KPI bar ──────────────────────────────────────────────────────────────────
function KPIBar({ kpis, currency, loading }) {
  const items = [
    { label: "Revenue YTD",   value: kpis?.revenue,    icon: TrendingUp,   color: "text-emerald-500" },
    { label: "Expenses YTD",  value: kpis?.expenses,   icon: TrendingDown, color: "text-red-400" },
    { label: "Net Profit",    value: kpis?.net_profit, icon: DollarSign,   color: "text-blue-400" },
    { label: "Cash Balance",  value: kpis?.cash_balance, icon: BarChart3,  color: "text-amber-400" },
  ];

  if (loading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[0,1,2,3].map((i) => <SkeletonKPI key={i} />)}
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(({ label, value, icon: Icon, color }) => (
        <Card key={label} className="surface-card border-0">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="label-eyebrow text-[10px] text-muted-foreground mb-1">{label}</p>
                <p className={`text-xl font-bold kpi-value numeric ${color}`}>
                  {fmtCurrency(value ?? 0, currency)}
                </p>
              </div>
              <div className={`p-2 rounded-lg bg-secondary ${color}`}>
                <Icon className="w-4 h-4" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Edit widget dialog ───────────────────────────────────────────────────────
function EditWidgetDialog({ widget, open, onClose, onSave }) {
  const [form, setForm] = useState(widget || {});
  useEffect(() => { if (widget) setForm(widget); }, [widget]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Widget</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Chart Type</Label>
            <Select value={form.chartType} onValueChange={(v) => setForm((f) => ({ ...f, chartType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHART_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data Source</Label>
            <Select value={form.dataSource} onValueChange={(v) => setForm((f) => ({ ...f, dataSource: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATA_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Color Palette</Label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(PALETTES).map(([key, colors]) => (
                <button
                  key={key}
                  onClick={() => setForm((f) => ({ ...f, palette: key }))}
                  className={`flex gap-0.5 rounded overflow-hidden border-2 transition-all ${form.palette === key ? "border-primary scale-110" : "border-transparent"}`}
                  title={key}
                >
                  {colors.slice(0, 3).map((c) => (
                    <span key={c} className="w-4 h-6 block" style={{ background: c }} />
                  ))}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Size</Label>
            <div className="flex gap-2">
              {["md", "lg"].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={form.size === s ? "default" : "outline"}
                  onClick={() => setForm((f) => ({ ...f, size: s }))}
                >
                  {s === "lg" ? "Wide (2 cols)" : "Normal"}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(form); onClose(); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function BIDashboard() {
  const { user } = useAuth();
  const currency = user?.default_currency || "USD";

  const [data, setData]       = useState({});
  const [loading, setLoading] = useState(true);
  const [widgets, setWidgets] = useState(() => {
    try {
      const saved = localStorage.getItem("bi_widgets");
      return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
    } catch { return DEFAULT_WIDGETS; }
  });
  const [editWidget, setEditWidget] = useState(null);
  const [addOpen, setAddOpen]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(`/dashboard/summary?base=${currency}`);
      setData(d);
    } catch (e) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currency]);

  useEffect(() => { load(); }, [load]);

  const saveWidgets = (next) => {
    setWidgets(next);
    localStorage.setItem("bi_widgets", JSON.stringify(next));
  };

  const handleRefresh = () => { setRefreshing(true); load(); };

  const handleRemove = (id) => saveWidgets(widgets.filter((w) => w.id !== id));

  const handleSaveEdit = (updated) =>
    saveWidgets(widgets.map((w) => (w.id === updated.id ? updated : w)));

  const handleAddWidget = (form) => {
    const newW = { ...form, id: `w_${Date.now()}` };
    saveWidgets([...widgets, newW]);
    setAddOpen(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text" style={{ fontFamily: "Outfit" }}>
            BI Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fully configurable analytics — add, edit, and rearrange charts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Widget
          </Button>
        </div>
      </div>

      {/* KPI bar */}
      <KPIBar kpis={data.kpis} currency={currency} loading={loading} />

      {/* Chart grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[0,1,2,3].map((i) => <SkeletonChart key={i} height={240} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {widgets.map((w) => (
            <WidgetCard
              key={w.id}
              widget={w}
              data={data}
              currency={currency}
              onEdit={setEditWidget}
              onRemove={handleRemove}
            />
          ))}
          {/* Add placeholder */}
          <button
            onClick={() => setAddOpen(true)}
            className="col-span-1 border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all duration-200 hover:bg-secondary/30 group"
          >
            <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Add Chart Widget</span>
          </button>
        </div>
      )}

      {/* Edit dialog */}
      <EditWidgetDialog
        widget={editWidget}
        open={!!editWidget}
        onClose={() => setEditWidget(null)}
        onSave={handleSaveEdit}
      />

      {/* Add dialog (reuse EditWidgetDialog with blank widget) */}
      <EditWidgetDialog
        widget={{ id: null, title: "New Chart", chartType: "line", dataSource: "monthly_trend", palette: "moss", size: "md" }}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAddWidget}
      />
    </div>
  );
}
