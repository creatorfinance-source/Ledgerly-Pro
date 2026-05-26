import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthCallback() {
  const navigate = useNavigate();
  const processed = useRef(false);
  const { setUser } = useAuth();

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash || "";
    const m = hash.match(/token=([^&]+)/);
    if (!m) {
      navigate("/login", { replace: true });
      return;
    }
    const token = decodeURIComponent(m[1]);
    localStorage.setItem("ledgerly_token", token);

    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
        navigate("/dashboard", { replace: true });
      } catch (err) {
        console.error(err);
        navigate("/login?error=oauth", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream" data-testid="auth-callback">
      <div className="w-8 h-8 border-4 border-moss border-t-transparent rounded-full animate-spin mb-4" />
      <div className="text-sm font-medium text-[#5C5C5C]" style={{ fontFamily: "Outfit" }}>
        Completing your sign in...
      </div>
    </div>
  );
}