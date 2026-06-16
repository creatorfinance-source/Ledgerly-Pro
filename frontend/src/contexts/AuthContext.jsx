import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

const ROLE_LEVEL = { viewer: 1, analyst: 2, manager: 3, admin: 4, super_admin: 5 };
const SUPER_ADMIN_EMAIL = "zubair.ahmad@nextventures.io";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.location.hash?.includes("token=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const loginEmail = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("ledgerly_token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const registerEmail = async (email, password, name) => {
    const { data } = await api.post("/auth/register", { email, password, name });
    localStorage.setItem("ledgerly_token", data.access_token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("ledgerly_token");
    setUser(null);
  };

  const refresh = async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
    return data;
  };

  // ── Role helpers ──────────────────────────────────────────────────────────
  const role = user?.role || "viewer";
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL || role === "super_admin";
  const isAdmin = isSuperAdmin || role === "admin";
  const isManager = isAdmin || role === "manager";
  const isAnalyst = isManager || role === "analyst";

  /** Returns true if current user's role is >= minRole */
  const hasRole = (minRole) =>
    (ROLE_LEVEL[role] || 1) >= (ROLE_LEVEL[minRole] || 1);

  return (
    <AuthContext.Provider
      value={{
        user, setUser, loading,
        loginEmail, registerEmail, logout, refresh,
        role, isSuperAdmin, isAdmin, isManager, isAnalyst, hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
