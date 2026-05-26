import { useEffect, useState } from "react";
import api, { fmtCurrency, fmtDate } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Wallet, FileText, TrendingUp, Banknote } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid } from "recharts";

const COLORS = ["#2A3B32", "#4A6B53", "#C45E4C", "#B79A7B", "#3D5247", "#7A8C82"];

function KPI({ label, value, hint, icon: Icon, accent = false, testid }) {
  return (
    <Card className="surface-card p-6" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className="label-eyebrow">{label}</div>
        {Icon ? (
          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${accent ? "bg-[#C45E4C]/10 text-terracotta" : "bg-[#F2F0ED] text-moss"}`}>
            <Icon className="w-4 h-4" strokeWidth={1.5} />
          </div>
        ) : null}
      </div>
      <div className="mt-4 numeric text-3xl text-[#1A1A1A]" style={{ fontFamily: "Outfit", fontWeight: 300 }}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-[#5C5C5C]">{hint}</div> : null}
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.get("/dashboard/summary")
      .then((r) => setData(r.data))
      .catch(() => setError("Could not load dashboard data. Make sure the backend is running."));
  }, []);

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]" data-testid="dashboard-error">
        <div className="w-12 h-12 rounded-full bg-[#FBEDE9] flex items-center justify-center mb-4">
          <TrendingUp className="w-5 h-5 text-terracotta" />
        </div>
        <div className="text-lg font-medium text-[#1A1A1A]" style={{ fontFamily: "Outfit" }}>Dashboard unavailable</div>
        <div className="mt-1 text-sm text-[#5C5C5C] max-w-sm text-center">{error}</div>
        <button
          className="mt-4 px-4 py-2 rounded-md bg-moss text-white text-sm hover:bg-[#3D5247] transition-colors"
          onClick={() => { setError(null); setData(null); api.get("/dashboard/summary").then((r) => setData(r.data)).catch(() => setError("Could not load dashboard data.")); }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 flex flex-col gap-6" data-testid="dashboard-loading">
        <div className="h-8 w-56 bg-[#F2F0ED] rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-[#F2F0ED] rounded-lg animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 bg-[#F2F0ED] rounded-lg animate-pulse lg:col-span-2" />
          <div className="h-80 bg-[#F2F0ED] rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className="p-6 md:p-8" data-testid="dashboard-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="label-eyebrow">Overview · {new Date().getFullYear()}</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>Financial dashboard</h1>
        </div>
        <div className="text-sm text-[#5C5C5C]">Reporting currency · <span className="text-[#1A1A1A] font-medium numeric">{data.currency}</span></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KPI label="Revenue YTD" value={fmtCurrency(k.revenue, data.currency)} hint="Income statements" icon={TrendingUp} testid="kpi-revenue" />
        <KPI label="Expenses YTD" value={fmtCurrency(k.expenses, data.currency)} hint="Operational outflow" icon={ArrowDownRight} accent testid="kpi-expenses" />
        <KPI label="Net Profit" value={fmtCurrency(k.net_profit, data.currency)} hint="Income − Expenses" icon={ArrowUpRight} testid="kpi-profit" />
        <KPI label="Cash Balance" value={fmtCurrency(k.cash_balance, data.currency)} hint="Cash + Bank" icon={Wallet} testid="kpi-cash" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="surface-card p-6 lg:col-span-2" data-testid="chart-trend-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="label-eyebrow">Last 6 months</div>
              <div className="mt-1 text-lg font-medium" style={{ fontFamily: "Outfit" }}>Profit trend</div>
            </div>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
                <XAxis dataKey="month" stroke="#5C5C5C" fontSize={12} />
                <YAxis stroke="#5C5C5C" fontSize={12} />
                <Tooltip contentStyle={{ background: "#FFF", border: "1px solid #E5E2DC", borderRadius: 8 }} />
                <Line type="monotone" dataKey="income" stroke="#4A6B53" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expenses" stroke="#C45E4C" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="profit" stroke="#2A3B32" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="surface-card p-6" data-testid="chart-breakdown-card">
          <div className="label-eyebrow">Where money goes</div>
          <div className="mt-1 text-lg font-medium" style={{ fontFamily: "Outfit" }}>Expense breakdown</div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.expense_breakdown} dataKey="value" nameKey="category" innerRadius={50} outerRadius={86} paddingAngle={2}>
                  {data.expense_breakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#FFF", border: "1px solid #E5E2DC", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {data.expense_breakdown.slice(0, 6).map((e, i) => (
              <div key={e.category} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="truncate text-[#5C5C5C]">{e.category}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="surface-card mt-6" data-testid="recent-transactions-card">
        <div className="p-6 border-b border-cream flex items-center justify-between">
          <div>
            <div className="label-eyebrow">Activity</div>
            <div className="mt-1 text-lg font-medium" style={{ fontFamily: "Outfit" }}>Recent transactions</div>
          </div>
          <Banknote className="w-5 h-5 text-moss" strokeWidth={1.5} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-6 py-3 label-eyebrow text-[10px]">Date</th>
                <th className="px-6 py-3 label-eyebrow text-[10px]">Description</th>
                <th className="px-6 py-3 label-eyebrow text-[10px]">Source</th>
                <th className="px-6 py-3 label-eyebrow text-[10px] text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_transactions.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-10 text-center text-[#5C5C5C]">No transactions yet. Connect a PSP to start syncing.</td></tr>
              ) : data.recent_transactions.map((t) => (
                <tr key={t.txn_id} className="border-t border-cream hover:bg-[#F9F8F6] transition-colors">
                  <td className="px-6 py-3 text-[#5C5C5C]">{fmtDate(t.date)}</td>
                  <td className="px-6 py-3 text-[#1A1A1A]">{t.description}</td>
                  <td className="px-6 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-[#F2F0ED] text-moss">{t.source}</span></td>
                  <td className={`px-6 py-3 text-right numeric ${t.type === "credit" ? "text-moss" : "text-terracotta"}`}>{t.type === "credit" ? "+" : "-"}{fmtCurrency(t.amount, t.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}