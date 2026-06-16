import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SkeletonTable } from "@/components/Preloader";
import {
  ShieldCheck, Users, Crown, UserCheck, Search, RefreshCw,
  BarChart3, Receipt, FileText,
} from "lucide-react";

const ROLES = ["viewer", "analyst", "manager", "admin", "super_admin"];

const ROLE_META = {
  super_admin: { label: "Super Admin", color: "bg-gradient-to-r from-[#2A3B32] to-[#4a7c5e] text-white", icon: Crown },
  admin:       { label: "Admin",       color: "bg-blue-950 text-blue-300",     icon: ShieldCheck },
  manager:     { label: "Manager",     color: "bg-purple-950 text-purple-300", icon: UserCheck },
  analyst:     { label: "Analyst",     color: "bg-emerald-950 text-emerald-300", icon: BarChart3 },
  viewer:      { label: "Viewer",      color: "bg-secondary text-secondary-foreground", icon: Users },
};

function RoleBadge({ role }) {
  const m = ROLE_META[role] || ROLE_META.viewer;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${m.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {m.label}
    </span>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ stats, loading }) {
  if (loading || !stats) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[0,1,2,3].map((i) => (
        <div key={i} className="surface-card p-4 space-y-2 animate-pulse">
          <div className="h-3 bg-secondary rounded w-20" />
          <div className="h-7 bg-secondary rounded w-16" />
        </div>
      ))}
    </div>
  );

  const items = [
    { label: "Total Users",     value: stats.total_users,       icon: Users,     color: "text-blue-400" },
    { label: "Super Admin / Admin", value: (stats.by_role?.super_admin || 0) + (stats.by_role?.admin || 0), icon: ShieldCheck, color: "text-violet-400" },
    { label: "Transactions",    value: stats.total_transactions, icon: Receipt,   color: "text-emerald-400" },
    { label: "Invoices",        value: stats.total_invoices,     icon: FileText,  color: "text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map(({ label, value, icon: Icon, color }) => (
        <Card key={label} className="surface-card border-0">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-secondary ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xl font-bold kpi-value text-foreground">{value?.toLocaleString() ?? "–"}</p>
              <p className="label-eyebrow text-[9px] text-muted-foreground">{label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Role distribution ─────────────────────────────────────────────────────────
function RoleDistribution({ stats }) {
  if (!stats?.by_role) return null;
  const total = stats.total_users || 1;
  return (
    <Card className="surface-card border-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Role Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {ROLES.slice().reverse().map((role) => {
          const count = stats.by_role?.[role] || 0;
          const pct   = Math.round((count / total) * 100);
          const m     = ROLE_META[role];
          return (
            <div key={role} className="flex items-center gap-3">
              <RoleBadge role={role} />
              <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: role === "super_admin" ? "#2A3B32" : undefined }}
                  data-role={role}
                />
              </div>
              <span className="text-xs font-semibold text-foreground w-5 text-right">{count}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── User row ──────────────────────────────────────────────────────────────────
function UserRow({ usr, currentUser, isSuperAdmin, onRoleChange }) {
  const initials = (usr.name || usr.email || "?").split(" ").map((s) => s[0]).join("").toUpperCase().slice(0, 2);
  const isMe = usr.user_id === currentUser?.user_id;
  const isSA = usr.email === "zubair.ahmad@nextventures.io";

  return (
    <tr className="border-b border-border hover:bg-secondary/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border border-border">
            <AvatarImage src={usr.picture} />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-foreground">{usr.name || "—"}</span>
              {isMe && <Badge variant="outline" className="text-[9px]">You</Badge>}
              {isSA && <Crown className="w-3 h-3 text-amber-400" title="Super Admin" />}
            </div>
            <div className="text-xs text-muted-foreground">{usr.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={usr.role || "viewer"} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {usr.organization || "—"}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {usr.role_updated_at ? format(new Date(usr.role_updated_at), "MMM d, yyyy") : "—"}
      </td>
      <td className="px-4 py-3">
        {/* Cannot change super_admin's role unless you are the super admin */}
        {isSA && !isSuperAdmin ? (
          <span className="text-xs text-muted-foreground italic">Protected</span>
        ) : (
          <Select
            value={usr.role || "viewer"}
            onValueChange={(role) => onRoleChange(usr, role)}
            disabled={isMe && !isSuperAdmin}
          >
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem
                  key={r}
                  value={r}
                  disabled={!isSuperAdmin && (r === "super_admin" || r === "admin")}
                >
                  {ROLE_META[r]?.label || r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers]   = useState([]);
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [confirm, setConfirm] = useState(null); // { usr, newRole }

  const load = useCallback(async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get("/admin/users"),
        api.get("/admin/stats"),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch {
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => { setRefreshing(true); load(); };

  const handleRoleChange = (usr, newRole) => {
    setConfirm({ usr, newRole });
  };

  const confirmRoleChange = async () => {
    if (!confirm) return;
    try {
      await api.patch(`/admin/users/${confirm.usr.user_id}/role`, { role: confirm.newRole });
      setUsers((u) => u.map((x) => x.user_id === confirm.usr.user_id ? { ...x, role: confirm.newRole } : x));
      toast.success(`${confirm.usr.name || confirm.usr.email} → ${ROLE_META[confirm.newRole]?.label}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update role");
    } finally {
      setConfirm(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold gradient-text" style={{ fontFamily: "Outfit" }}>Admin Panel</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage users, assign roles, and view system stats
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} loading={loading} />

      <div className="grid md:grid-cols-[1fr_260px] gap-6">
        {/* Users table */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-9 h-8 text-sm"
                placeholder="Search users…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Badge variant="outline" className="shrink-0">
              {filtered.length} user{filtered.length !== 1 ? "s" : ""}
            </Badge>
          </div>

          {loading ? (
            <SkeletonTable rows={5} cols={5} />
          ) : (
            <div className="surface-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    {["User", "Role", "Org", "Role Updated", "Change Role"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left label-eyebrow text-[10px] text-muted-foreground font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((u) => (
                      <UserRow
                        key={u.user_id}
                        usr={u}
                        currentUser={currentUser}
                        isSuperAdmin={isSuperAdmin}
                        onRoleChange={handleRoleChange}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Role distribution */}
        <RoleDistribution stats={stats} />
      </div>

      {/* Confirm role change dialog */}
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>
              Change <strong>{confirm?.usr?.name || confirm?.usr?.email}</strong>'s role to{" "}
              <strong>{ROLE_META[confirm?.newRole]?.label}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button onClick={confirmRoleChange}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
