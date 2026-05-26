import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Receipt,
  FileText,
  BookOpen,
  Layers,
  Plug,
  Settings as SettingsIcon,
  LogOut,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/accounts", label: "Chart of Accounts", icon: Layers },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/receipts", label: "Receipts", icon: FileText },
  { to: "/statements", label: "Statements", icon: BookOpen },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = (user?.name || user?.email || "L")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const breadcrumb = NAV.find((n) => location.pathname.startsWith(n.to))?.label || "Workspace";

  return (
    <div className="min-h-screen bg-cream flex" data-testid="app-layout">
      {/* Sidebar */}
      <aside
        className="w-64 shrink-0 bg-[#FFFFFF] border-r border-cream flex flex-col"
        data-testid="app-sidebar"
      >
        <div className="px-6 pt-6 pb-4 border-b border-cream">
          <Link to="/dashboard" className="flex items-center gap-2" data-testid="sidebar-logo">
            <div className="w-8 h-8 rounded-md bg-moss flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <div className="font-medium tracking-tight text-[#1A1A1A]" style={{ fontFamily: "Outfit" }}>
                FP&A Analytics - NEXT
              </div>
              <div className="label-eyebrow text-[10px]">Finance &amp; Accounts</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${to.replace("/", "")}-link`}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-[#F2F0ED] text-moss font-medium"
                    : "text-[#5C5C5C] hover:text-[#1A1A1A] hover:bg-[#F9F8F6]",
                ].join(" ")
              }
            >
              <Icon className="w-4 h-4" strokeWidth={1.5} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-cream p-3">
          <div className="flex items-center gap-3 p-2 rounded-md hover:bg-[#F9F8F6] transition-colors">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.picture} alt={user?.name} />
              <AvatarFallback className="bg-moss text-white text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate text-[#1A1A1A]">{user?.name}</div>
              <div className="text-xs text-[#5C5C5C] truncate">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="p-2 rounded-md text-[#5C5C5C] hover:text-terracotta hover:bg-[#F9F8F6] transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-cream bg-[#F9F8F6] sticky top-0 z-20 flex items-center px-8">
          <div className="flex items-center gap-2 text-sm text-[#5C5C5C]">
            <span>Workspace</span>
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="text-[#1A1A1A] font-medium">{breadcrumb}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="label-eyebrow text-[10px]">{user?.organization || "My Company"}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider bg-[#F2F0ED] text-moss border border-cream">
              {user?.default_currency || "USD"}
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}