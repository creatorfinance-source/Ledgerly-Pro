import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { BACKEND_URL } from "@/lib/api";

export default function Register() {
  const { registerEmail } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await registerEmail(email, password, name);
      toast.success("Account created");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not register");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = () => {
    window.location.href = `${BACKEND_URL}/api/auth/google/login`;
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-8" data-testid="register-page">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-md bg-moss flex items-center justify-center">
            <span className="text-white text-sm font-semibold" style={{ fontFamily: "Outfit" }}>L</span>
          </div>
          <span className="font-medium tracking-tight" style={{ fontFamily: "Outfit", fontSize: 18 }}>Ledgerly</span>
        </Link>
        <h1 className="text-3xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>
          Create your workspace
        </h1>
        <p className="text-sm text-[#5C5C5C] mt-2">Start with a clean ledger and a default chart of accounts.</p>

        <Button
          type="button"
          variant="outline"
          onClick={onGoogle}
          className="mt-8 w-full h-11 border-cream hover:border-moss hover:bg-[#F9F8F6]"
          data-testid="register-google-btn"
        >
          Continue with Google
        </Button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-cream" />
          <span className="label-eyebrow text-[10px]">or with email</span>
          <div className="h-px flex-1 bg-cream" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" data-testid="register-name-input" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" data-testid="register-email-input" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" data-testid="register-password-input" />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-moss hover:bg-[#3D5247] text-white h-11" data-testid="register-submit-btn">
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="mt-8 text-sm text-[#5C5C5C]">
          Already have an account?{" "}
          <Link to="/login" className="text-moss font-medium hover:underline" data-testid="link-to-login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}