import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { BACKEND_URL } from "@/lib/api";

const SIDEBAR_IMG =
  "https://images.unsplash.com/photo-1686061592689-312bbfb5c055?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2ODh8MHwxfHNlYXJjaHw0fHxmaW5hbmNpYWwlMjBzcHJlYWRzaGVldCUyMGRhc2hib2FyZHxlbnwwfHx8fDE3NzgzNzY3NzN8MA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { loginEmail } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await loginEmail(email, password);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = () => {
    window.location.href = `${BACKEND_URL}/api/auth/google/login`;
  };

  return (
    <div className="min-h-screen bg-cream grid lg:grid-cols-2" data-testid="login-page">
      <div className="hidden lg:block relative">
        <img src={SIDEBAR_IMG} alt="Finance" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute left-10 right-10 bottom-12 text-white">
          <div className="label-eyebrow text-white/70">Welcome back</div>
          <h2 className="text-4xl mt-3 font-light tracking-tight" style={{ fontFamily: "Outfit" }}>
            One ledger. Every account.
          </h2>
          <p className="mt-3 text-sm text-white/80 max-w-md">
            Pick up where you left off — your statements, integrations and reconciliation queues are waiting.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <Link to="/" className="inline-flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-md bg-moss flex items-center justify-center">
              <span className="text-white text-sm font-semibold" style={{ fontFamily: "Outfit" }}>L</span>
            </div>
            <span className="font-medium tracking-tight" style={{ fontFamily: "Outfit", fontSize: 18 }}>Ledgerly</span>
          </Link>
          <h1 className="text-3xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>
            Sign in to your books
          </h1>
          <p className="text-sm text-[#5C5C5C] mt-2">
            Use your <span className="font-medium text-moss">@wearenext.io</span> or{" "}
            <span className="font-medium text-moss">@nextventures.io</span> account
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={onGoogle}
            className="mt-8 w-full h-11 border-cream hover:border-moss hover:bg-[#F9F8F6]"
            data-testid="login-google-btn"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-cream" />
            <span className="label-eyebrow text-[10px]">or with email</span>
            <div className="h-px flex-1 bg-cream" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" data-testid="login-email-input" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" data-testid="login-password-input" />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-moss hover:bg-[#3D5247] text-white h-11" data-testid="login-submit-btn">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-sm text-[#5C5C5C]">
            New here?{" "}
            <Link to="/register" className="text-moss font-medium hover:underline" data-testid="link-to-register">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
