import { useEffect, useState } from "react";
import api, { fmtCurrency, fmtDate } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Wallet, FileText, TrendingUp, Banknote } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { useTheme } from "next-themes";

const COLORS = ["#2A3B32", "#4A6B53", "#C45E4C", "#B79A7B", "#3D5247", "#7A8C82"];
const DARK_COLORS = ["#4A6B53", "#7A8C82", "#E57373", "#D4B483", "#689F38", "#A0A0A0"];

function KPI({ label, value, hint, icon: Icon, accent = false, testid, delay = 0 }) {
  return (
    <Card 
      className="surface-card p-6 animate-in fade-in zoom-in-95 duration-500" 
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
      data-testid={testid}
    >
      <div className="flex items-start justify-between">
        <div className="label-eyebrow text-muted-foreground">{label}</div>
        {Icon ? (
          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${accent ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            <Icon className="w-4 h-4" strokeWidth={1.5} />
          </div>
        ) : null}
      </div>
      <div className="mt-4 numeric text-3xl text-foreground font-light" style={{ fontFamily: "Outfit" }}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    api.get("/dashboard/summary")
      .then((r) => setData(r.data))
      .catch(() => setError("Could not load dashboard data. Make sure the backend is running."));
  }, []);

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-500" data-testid="dashboard-error">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <TrendingUp className="w-5 h-5 text-destructive" />
        </div>
        <div className="text-lg font-medium text-foreground" style={{ fontFamily: "Outfit" }}>Dashboard unavailable</div>
        <div className="mt-1 text-sm text-muted-foreground max-w-sm text-center">{error}</div>
        <button
          className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 transition-colors"
          onClick={() => { setError(null); setData(null); api.get("/dashboard/summary").then((r) => setData(r.data)).catch(() => setError("Could not load dashboard data.")); }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 md:p-8 flex flex-col gap-6" data-testid="dashboard-loading">
        <div className="h-8 w-56 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 bg-muted rounded-lg animate-pulse lg:col-span-2" />
          <div className="h-80 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const k = data.kpis;
  const currentColors = isDark ? DARK_COLORS : COLORS;

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto" data-testid="dashboard-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <div className="label-eyebrow text-muted-foreground">Overview · {new Date().getFullYear()}</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight text-foreground" style={{ fontFamily: "Outfit" }}>Financial dashboard</h1>
        </div>
        <div className="text-sm text-muted-foreground">Reporting currency · <span className="text-foreground font-medium numeric">{data.currency}</span></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KPI label="Revenue YTD" value={fmtCurrency(k.revenue, data.currency)} hint="Income statements" icon={TrendingUp} testid="kpi-revenue" delay={0} />
        <KPI label="Expenses YTD" value={fmtCurrency(k.expenses, data.currency)} hint="Operational outflow" icon={ArrowDownRight} accent testid="kpi-expenses" delay={100} />
        <KPI label="Net Profit" value={fmtCurrency(k.net_profit, data.currency)} hint="Income − Expenses" icon={ArrowUpRight} testid="kpi-profit" delay={200} />
        <KPI label="Cash Balance" value={fmtCurrency(k.cash_balance, data.currency)} hint="Cash + Bank" icon={Wallet} testid="kpi-cash" delay={300} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="surface-card p-6 lg:col-span-2 animate-in fade-in slide-in-from-left-4 duration-700 delay-200 fill-mode-both" data-testid="chart-trend-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="label-eyebrow text-muted-foreground">Last 6 months</div>
              <div className="mt-1 text-lg font-medium text-foreground" style={{ fontFamily: "Outfit" }}>Profit trend</div>
            </div>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#2A2A2A" : "#E5E2DC"} vertical={false} />
                <XAxis dataKey="month" stroke={isDark ? "#8A8A8A" : "#5C5C5C"} fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke={isDark ? "#8A8A8A" : "#5C5C5C"} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ 
                    background: isDark ? "#1A1A1A" : "#FFF", 
                    border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E2DC", 
                    borderRadius: 8,
                    color: isDark ? "#FFF" : "#000"
                  }} 
                />
                <Line type="monotone" dataKey="income" stroke={currentColors[1]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expenses" stroke="#C45E4C" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="profit" stroke={currentColors[0]} strokeWidth={3} dot={{ r: 4, fill: currentColors[0] }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="surface-card p-6 animate-in fade-in slide-in-from-right-4 duration-700 delay-200 fill-mode-both" data-testid="chart-breakdown-card">
          <div className="label-eyebrow text-muted-foreground">Where money goes</div>
          <div className="mt-1 text-lg font-medium text-foreground" style={{ fontFamily: "Outfit" }}>Expense breakdown</div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={data.expense_breakdown} 
                  dataKey="value" 
                  nameKey="category" 
                  innerRadius={60} 
                  outerRadius={80} 
                  paddingAngle={5}
                  stroke="none"
                >
                  {data.expense_breakdown.map((_, i) => (
                    <Cell key={i} fill={currentColors[i % currentColors.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    background: isDark ? "#1A1A1A" : "#FFF", 
                    border: isDark ? "1px solid #2A2A2A" : "1px solid #E5E2DC", 
                    borderRadius: 8 
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
            {data.expense_breakdown.slice(0, 6).map((e, i) => (
              <div key={e.category} className="flex items-center gap-2 overflow-hidden">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: currentColors[i % currentColors.length] }} />
                <span className="truncate text-muted-foreground hover:text-foreground transition-colors cursor-default">{e.category}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="surface-card mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both" data-testid="recent-transactions-card">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <div className="label-eyebrow text-muted-foreground">Activity</div>
            <div className="mt-1 text-lg font-medium text-foreground" style={{ fontFamily: "Outfit" }}>Recent transactions</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <Banknote className="w-5 h-5 text-primary" strokeWidth={1.5} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-muted/30">
                <th className="px-6 py-3 label-eyebrow text-[10px] text-muted-foreground">Date</th>
                <th className="px-6 py-3 label-eyebrow text-[10px] text-muted-foreground">Description</th>
                <th className="px-6 py-3 label-eyebrow text-[10px] text-muted-foreground">Source</th>
                <th className="px-6 py-3 label-eyebrow text-[10px] text-muted-foreground text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.recent_transactions.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-10 text-center text-muted-foreground">No transactions yet. Connect a PSP to start syncing.</td></tr>
              ) : data.recent_transactions.map((t) => (
                <tr key={t.txn_id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">{fmtDate(t.date)}</td>
                  <td className="px-6 py-4 text-foreground font-medium">{t.description}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-secondary text-primary border border-border">
                      {t.source}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-right numeric font-medium ${t.type === "credit" ? "text-primary" : "text-destructive"}`}>
                    {t.type === "credit" ? "+" : "-"}{fmtCurrency(t.amount, t.currency)}
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