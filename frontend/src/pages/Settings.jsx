import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api, { CURRENCIES } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User, Building2, Phone, FileText, Mail, Globe } from "lucide-react";

const TIMEZONES = [
  { value: "UTC", label: "UTC — Coordinated Universal Time" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET/CEST)" },
  { value: "Europe/Istanbul", label: "Europe/Istanbul (TRT)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST +4)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +5:30)" },
  { value: "Asia/Dhaka", label: "Asia/Dhaka (BST +6)" },
  { value: "Asia/Colombo", label: "Asia/Colombo (SLST +5:30)" },
  { value: "Asia/Kuala_Lumpur", label: "Asia/Kuala_Lumpur (MYT +8)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT +8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST +9)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
  { value: "America/New_York", label: "America/New_York (ET)" },
  { value: "America/Chicago", label: "America/Chicago (CT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PT)" },
];

export default function Settings() {
  const { user, refresh } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [jobTitle, setJobTitle] = useState(user?.job_title || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [organization, setOrganization] = useState(user?.organization || "");
  const [defaultCurrency, setDefaultCurrency] = useState(user?.default_currency || "USD");
  const [timezone, setTimezone] = useState(user?.timezone || "UTC");
  const [busy, setBusy] = useState(false);

  const initials = (user?.name || user?.email || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const save = async () => {
    setBusy(true);
    try {
      await api.patch("/settings", {
        name,
        job_title: jobTitle,
        phone,
        bio,
        organization,
        default_currency: defaultCurrency,
        timezone,
      });
      await refresh();
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl" data-testid="settings-page">
      <div className="mb-8">
        <div className="label-eyebrow">Workspace</div>
        <h1 className="mt-2 text-3xl md:text-4xl font-light tracking-tight" style={{ fontFamily: "Outfit" }}>
          Profile & Settings
        </h1>
      </div>

      {/* Profile header card */}
      <Card className="surface-card p-6 mb-6">
        <div className="flex items-center gap-5">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarImage src={user?.picture || ""} alt={user?.name} />
            <AvatarFallback className="bg-moss text-white text-xl font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-lg font-medium text-[#1A1A1A] truncate">{user?.name || "—"}</div>
            {user?.job_title && (
              <div className="text-sm text-[#5C5C5C] truncate">{user.job_title}</div>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs text-[#5C5C5C] flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {user?.email}
              </span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cream text-moss">
                {user?.provider === "google" ? "Google" : "Email"}
              </Badge>
              {user?.organization && (
                <span className="text-xs text-[#5C5C5C] flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {user.organization}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Edit form */}
      <Card className="surface-card p-6">
        <div className="space-y-6">
          {/* Personal section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-[#5C5C5C]" />
              <span className="label-eyebrow text-xs">Personal</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Full name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5"
                  data-testid="settings-name-input"
                />
              </div>
              <div>
                <Label>Job title</Label>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Finance Manager"
                  className="mt-1.5"
                  data-testid="settings-jobtitle-input"
                />
              </div>
              <div>
                <Label>
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3" />
                    Phone
                  </span>
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  className="mt-1.5"
                  data-testid="settings-phone-input"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled className="mt-1.5 opacity-60" />
              </div>
            </div>
            <div className="mt-4">
              <Label>
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3" />
                  Bio
                </span>
              </Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short description about you…"
                rows={3}
                className="mt-1.5 resize-none"
                data-testid="settings-bio-input"
              />
            </div>
          </div>

          <div className="border-t border-cream" />

          {/* Workspace section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-[#5C5C5C]" />
              <span className="label-eyebrow text-xs">Workspace</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Organization</Label>
                <Input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="mt-1.5"
                  data-testid="settings-org-input"
                />
              </div>
              <div>
                <Label>Default currency</Label>
                <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
                  <SelectTrigger className="mt-1.5" data-testid="settings-currency-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} · {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3 h-3" />
                    Timezone
                  </span>
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="mt-1.5" data-testid="settings-timezone-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              onClick={save}
              disabled={busy}
              className="bg-moss hover:bg-[#3D5247] text-white"
              data-testid="settings-save-btn"
            >
              {busy ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
