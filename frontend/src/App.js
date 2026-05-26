import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Accounts from "@/pages/Accounts";
import Invoices from "@/pages/Invoices";
import Receipts from "@/pages/Receipts";
import Statements from "@/pages/Statements";
import Integrations from "@/pages/Integrations";
import Settings from "@/pages/Settings";

function AppRouter() {
  const location = useLocation();
  // If returning from Emergent OAuth, handle session_id first
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  const Inner = (Page) => (
    <ProtectedRoute>
      <AppLayout>
        <Page />
      </AppLayout>
    </ProtectedRoute>
  );
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth-callback" element={<AuthCallback />} />
      <Route path="/dashboard" element={Inner(Dashboard)} />
      <Route path="/transactions" element={Inner(Transactions)} />
      <Route path="/accounts" element={Inner(Accounts)} />
      <Route path="/invoices" element={Inner(Invoices)} />
      <Route path="/receipts" element={Inner(Receipts)} />
      <Route path="/statements" element={Inner(Statements)} />
      <Route path="/integrations" element={Inner(Integrations)} />
      <Route path="/settings" element={Inner(Settings)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;