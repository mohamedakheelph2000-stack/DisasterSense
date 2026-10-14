"use client";

import { useState, useEffect } from "react";
import { User, Settings as SettingsIcon, Phone, Mail, MessageSquare, LogOut, Loader2 } from "lucide-react";
import { apiClient, errorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingPanel } from "@/components/ui/states";
import { Reveal } from "@/components/animations/motion";

interface Preferences {
  phone_number: string;
  email_enabled: boolean;
  sms_enabled: boolean;
}

const E164 = /^\+[1-9]\d{1,14}$/;

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<Preferences>({
    phone_number: "",
    email_enabled: true,
    sms_enabled: false,
  });

  useEffect(() => {
    fetchPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPreferences = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<Partial<Preferences>>("/users/me/preferences");
      setPreferences({
        phone_number: data?.phone_number || "",
        email_enabled: data?.email_enabled ?? true,
        sms_enabled: data?.sms_enabled ?? false,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setFormError(null);
    setSaveSuccess(false);

    let cleanPhone = preferences.phone_number ? preferences.phone_number.replace(/[\s\-()]+/g, "") : "";
    if (cleanPhone) {
      if (cleanPhone.startsWith("0") && cleanPhone.length === 11 && /^\d+$/.test(cleanPhone)) {
        cleanPhone = "+91" + cleanPhone.slice(1);
      } else if (cleanPhone.length === 10 && /^\d+$/.test(cleanPhone)) {
        cleanPhone = "+91" + cleanPhone;
      } else if (!cleanPhone.startsWith("+")) {
        cleanPhone = "+" + cleanPhone;
      }
    }

    if (preferences.sms_enabled) {
      if (!cleanPhone) {
        setFormError("Enter a phone number before enabling SMS alerts.");
        return;
      }
      if (!E164.test(cleanPhone)) {
        setFormError("Phone number must follow international format (e.g., +919876543210 or 10-digit mobile).");
        return;
      }
    }

    setSaving(true);
    try {
      await apiClient("/users/me/preferences", {
        method: "PUT",
        body: JSON.stringify({
          ...preferences,
          phone_number: cleanPhone,
        }),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({
    checked,
    onChange,
    label,
    description,
    icon,
    tone,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description: string;
    icon: React.ReactNode;
    tone: string;
  }) => (
    <div className="flex items-center justify-between p-4 bg-surface-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center gap-4">
        <div className={`p-2.5 rounded-lg ${tone}`}>{icon}</div>
        <div>
          <div className="font-medium text-foreground">{label}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-11 h-6 bg-surface-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success"></div>
      </label>
    </div>
  );

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your profile and the channels used to deliver disaster notifications."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Reveal className="md:col-span-1 space-y-6">
          <div className="panel p-6">
            <h2 className="text-lg font-semibold flex items-center mb-6">
              <User className="w-5 h-5 mr-2 text-primary" />
              Profile
            </h2>

            {user ? (
              <div className="space-y-4">
                <div>
                  <label className="hud-label">Full Name</label>
                  <div className="mt-1 font-medium">{user.full_name}</div>
                </div>
                <div>
                  <label className="hud-label">Email</label>
                  <div className="mt-1 font-medium break-all">{user.email}</div>
                </div>
                <div>
                  <label className="hud-label">Role</label>
                  <div className="mt-1">
                    <Badge variant="outline" className="uppercase">{user.role}</Badge>
                  </div>
                </div>
                {preferences.phone_number ? (
                  <div>
                    <label className="hud-label">Phone</label>
                    <div className="mt-1 font-medium tabular-nums">{preferences.phone_number}</div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-border">
              <Button
                variant="outline"
                onClick={logout}
                className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="md:col-span-2 space-y-6">
          <div className="panel p-6">
            <h2 className="text-lg font-semibold flex items-center mb-6">
              <SettingsIcon className="w-5 h-5 mr-2 text-primary" />
              Notification Preferences
            </h2>

            {loading ? (
              <LoadingPanel label="Loading preferences…" />
            ) : error ? (
              <ErrorState error={new Error(error)} onRetry={fetchPreferences} />
            ) : (
              <div className="space-y-6">
                <Toggle
                  checked={preferences.email_enabled}
                  onChange={(v) => setPreferences((p) => ({ ...p, email_enabled: v }))}
                  label="Email Alerts"
                  description="Receive HIGH and CRITICAL alerts via email"
                  icon={<Mail className="w-5 h-5" />}
                  tone="bg-info/10 text-info"
                />

                <Toggle
                  checked={preferences.sms_enabled}
                  onChange={(v) => setPreferences((p) => ({ ...p, sms_enabled: v }))}
                  label="SMS Alerts"
                  description="Receive CRITICAL alerts via SMS"
                  icon={<MessageSquare className="w-5 h-5" />}
                  tone="bg-warning/10 text-warning"
                />

                {preferences.sms_enabled && (
                  <Reveal className="p-4 bg-surface-muted/20 rounded-lg border border-border/50">
                    <label className="block text-sm font-medium text-foreground/80 mb-2" htmlFor="settings-phone">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        id="settings-phone"
                        type="tel"
                        className="bg-background border border-input text-foreground text-sm rounded-lg block w-full pl-10 p-3 outline-none transition-shadow hover:border-foreground/30 focus:ring-2 focus:ring-ring focus:border-primary"
                        placeholder="+1234567890"
                        value={preferences.phone_number}
                        onChange={(e) => setPreferences((p) => ({ ...p, phone_number: e.target.value }))}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Must include country code (e.g., +1). Standard messaging rates apply.
                    </p>
                  </Reveal>
                )}

                {formError ? <ErrorState error={new Error(formError)} compact /> : null}

                <div className="pt-4 flex flex-wrap items-center justify-end gap-4 border-t border-border mt-4">
                  {saveSuccess && (
                    <span className="text-sm text-success font-medium">Preferences saved successfully.</span>
                  )}
                  <Button onClick={savePreferences} disabled={loading || saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {saving ? "Saving…" : "Save Preferences"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </AppShell>
  );
}
