import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  BookOpen,
  BookText,
  PieChart,
  Layers,
  Plug,
  Settings as SettingsIcon,
  LogOut,
  Sparkles,
  ChevronRight,
  Menu,
  BarChart3,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

const ROLE_COLORS = {
  super_admin: "bg-gradient-to-r from-[#2A3B32] to-[#4a7c5e] text-white",
  admin:       "bg-blue-950 text-blue-300",
  manager:     "bg-purple-950 text-purple-300",
  analyst:     "bg-emerald-950 text-emerald-300",
  viewer:      "bg-secondary text-secondary-foreground",
};

function RoleBadge({ role }) {
  const label = (role || "viewer").replace("_", " ");
  return (
    <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${ROLE_COLORS[role] || ROLE_COLORS.viewer}`}>
      {label}
    </span>
  );
}

const BASE_NAV = [
  { to: "/dashboard",    label: "Dashboard",        icon: LayoutDashboard },
  { to: "/bi-dashboard", label: "BI Dashboard",      icon: BarChart3 },
  { to: "/transactions", label: "Transactions",      icon: Receipt },
  { to: "/journal",      label: "Journal Entries",   icon: BookText },
  { to: "/accounts",     label: "Chart of Accounts", icon: Layers },
  { to: "/cost-centers", label: "Cost-Center P&L",   icon: PieChart },
  { to: "/invoices",     label: "Invoices",           icon: FileText },
  { to: "/receipts",     label: "Receipts",           icon: FileText },
  { to: "/statements",   label: "Statements",         icon: BookOpen },
  { to: "/automations",  label: "Automations",        icon: Zap,        minRole: "analyst" },
  { to: "/integrations", label: "Integrations",       icon: Plug },
  { to: "/settings",     label: "Settings",           icon: SettingsIcon },
];

const ADMIN_NAV = { to: "/admin", label: "Admin Panel", icon: ShieldCheck, minRole: "admin" };

export default function AppLayout({ children }) {
  const { user, logout, role, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = (user?.name || user?.email || "L")
    .split(" ").map((s) => s[0]).join("").toUpperCase().slice(0, 2);

  const nav = [...BASE_NAV, ...(isAdmin ? [ADMIN_NAV] : [])];

  const breadcrumb =
    nav.find((n) => location.pathname === n.to)?.label ||
    nav.find((n) => location.pathname.startsWith(n.to))?.label ||
    "Workspace";

  useEffect(() => setIsMobileMenuOpen(false), [location.pathname]);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card sidebar-bg">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2.5 group" data-testid="sidebar-logo">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
            <Sparkles className="w-4 h-4 text-primary-foreground" strokeWidth={1.5} />
          </div>
          <div>
            <div className="font-semibold tracking-tight text-foreground text-[13px]" style={{ fontFamily: "Outfit" }}>
              FP&A Analytics
            </div>
            <div className="label-eyebrow text-[9px] text-muted-foreground">NEXT Ventures · Finance</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={`nav-${to.replace("/", "")}-link`}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150 relative",
                isActive
                  ? "bg-secondary text-primary font-medium nav-active-bar"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 hover:translate-x-0.5",
              ].join(" ")
            }
          >
            <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User profile */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 p-2 rounded-md hover:bg-secondary/50 transition-colors">
          <Avatar className="h-8 w-8 border border-border shrink-0">
            <AvatarImage src={user?.picture} alt={user?.name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate text-foreground">{user?.name}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <RoleBadge role={role} />
            </div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row" data-testid="app-layout">
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex w-64 shrink-0 bg-card border-r border-border flex-col sticky top-0 h-screen"
        data-testid="app-sidebar"
      >
        <SidebarContent />
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Sticky header */}
        <header className="h-14 border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-20 flex items-center px-4 md:px-6">
          <div className="flex items-center gap-3 flex-1">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 border-r border-border">
                <SidebarContent />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-1.5 text-sm text-muted-foreground overflow-hidden">
              <span className="hidden sm:inline text-xs">Workspace</span>
              <ChevronRight className="hidden sm:block w-3 h-3 shrink-0" strokeWidth={2} />
              <span className="text-foreground font-medium text-sm truncate">{breadcrumb}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:flex items-center gap-2">
              <span className="label-eyebrow text-[9px] text-muted-foreground">
                {user?.organization || "NEXT Ventures"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-secondary text-primary border border-border">
                {user?.default_currency || "USD"}
              </span>
            </div>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <ThemeToggle />
          </div>
        </header>

        {/* Page content with entry animation */}
        <div
          key={location.pathname}
          className="flex-1 overflow-auto animate-slide-up-fade"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
