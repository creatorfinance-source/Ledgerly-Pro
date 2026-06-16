import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import BIDashboard from "@/pages/BIDashboard";
import Transactions from "@/pages/Transactions";
import JournalEntries from "@/pages/JournalEntries";
import CostCenters from "@/pages/CostCenters";
import Accounts from "@/pages/Accounts";
import Invoices from "@/pages/Invoices";
import Receipts from "@/pages/Receipts";
import Statements from "@/pages/Statements";
import Integrations from "@/pages/Integrations";
import Settings from "@/pages/Settings";
import Automations from "@/pages/Automations";
import AdminPanel from "@/pages/AdminPanel";

/** Wraps a page component in ProtectedRoute + AppLayout */
function Protected({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

/** Admin-only route — redirects to /dashboard if insufficient role */
function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Protected>{children}</Protected>;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/"               element={<Landing />} />
      <Route path="/login"          element={<Login />} />
      <Route path="/register"       element={<Register />} />
      <Route path="/auth-callback"  element={<AuthCallback />} />

      <Route path="/dashboard"    element={<Protected><Dashboard /></Protected>} />
      <Route path="/bi-dashboard" element={<Protected><BIDashboard /></Protected>} />
      <Route path="/transactions" element={<Protected><Transactions /></Protected>} />
      <Route path="/journal"      element={<Protected><JournalEntries /></Protected>} />
      <Route path="/cost-centers" element={<Protected><CostCenters /></Protected>} />
      <Route path="/accounts"     element={<Protected><Accounts /></Protected>} />
      <Route path="/invoices"     element={<Protected><Invoices /></Protected>} />
      <Route path="/receipts"     element={<Protected><Receipts /></Protected>} />
      <Route path="/statements"   element={<Protected><Statements /></Protected>} />
      <Route path="/automations"  element={<Protected><Automations /></Protected>} />
      <Route path="/integrations" element={<Protected><Integrations /></Protected>} />
      <Route path="/settings"     element={<Protected><Settings /></Protected>} />

      <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="App">
        <BrowserRouter>
          <AuthProvider>
            <AppRouter />
            <Toaster position="top-right" richColors closeButton />
          </AuthProvider>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}

export default App;
