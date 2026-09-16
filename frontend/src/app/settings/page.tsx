"use client";

import { useState, useEffect } from "react";
import { User, Settings as SettingsIcon, Phone, Mail, MessageSquare, LogOut, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [preferences, setPreferences] = useState({
    phone_number: "",
    email_enabled: true,
    sms_enabled: false,
  });

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const data = await apiClient<any>("/users/me/preferences");
      if (data) {
        setPreferences({
          phone_number: data.phone_number || "",
          email_enabled: data.email_enabled ?? true,
          sms_enabled: data.sms_enabled ?? false,
        });
      }
    } catch (error) {
      console.warn("Could not fetch preferences", error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    // Validation
    if (preferences.sms_enabled) {
      if (!preferences.phone_number) {
        alert("Please enter a phone number to enable SMS alerts.");
        return;
      }
      if (!/^\+[1-9]\d{1,14}$/.test(preferences.phone_number.replace(/\s+/g, ""))) {
        alert("Phone number must follow E.164 format (e.g., +1234567890).");
        return;
      }
    }

    setSaving(true);
    setSaveSuccess(false);
    try {
      await apiClient("/users/me/preferences", {
        method: "PUT",
        body: JSON.stringify(preferences)
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save preferences", error);
      alert("Failed to save preferences. Please check your inputs.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-foreground/60">Manage your account and notification preferences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Profile Section */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold flex items-center mb-6">
              <User className="w-5 h-5 mr-2 text-primary" />
              Profile
            </h2>
            
            {user ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-foreground/50 uppercase tracking-wider font-semibold">Full Name</label>
                  <div className="mt-1 font-medium">{user.full_name}</div>
                </div>
                <div>
                  <label className="text-xs text-foreground/50 uppercase tracking-wider font-semibold">Email</label>
                  <div className="mt-1 font-medium">{user.email}</div>
                </div>
                <div>
                  <label className="text-xs text-foreground/50 uppercase tracking-wider font-semibold">Role</label>
                  <div className="mt-1">
                    <Badge variant="outline" className="uppercase">{user.role}</Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-border">
              <button 
                onClick={logout}
                className="w-full flex items-center justify-center px-4 py-2 border border-critical text-critical rounded-lg hover:bg-critical/10 transition-colors font-medium"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold flex items-center mb-6">
              <SettingsIcon className="w-5 h-5 mr-2 text-primary" />
              Notification Preferences
            </h2>

            {loading ? (
              <div className="animate-pulse space-y-6">
                <div className="h-12 bg-surface-muted rounded-lg w-full"></div>
                <div className="h-12 bg-surface-muted rounded-lg w-full"></div>
                <div className="h-20 bg-surface-muted rounded-lg w-full"></div>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Email Toggle */}
                <div className="flex items-center justify-between p-4 bg-surface-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-info/10 rounded-lg text-info">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">Email Alerts</div>
                      <div className="text-sm text-foreground/60">Receive HIGH/CRITICAL alerts via email</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" className="sr-only peer" checked={preferences.email_enabled} onChange={(e) => setPreferences({ ...preferences, email_enabled: e.target.checked })} />
                    <div className="w-11 h-6 bg-surface-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success"></div>
                  </label>
                </div>

                {/* SMS Toggle */}
                <div className="flex items-center justify-between p-4 bg-surface-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-warning/10 rounded-lg text-warning">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">SMS Alerts</div>
                      <div className="text-sm text-foreground/60">Receive CRITICAL alerts via SMS</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" className="sr-only peer" checked={preferences.sms_enabled} onChange={(e) => setPreferences({ ...preferences, sms_enabled: e.target.checked })} />
                    <div className="w-11 h-6 bg-surface-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success"></div>
                  </label>
                </div>

                {/* Phone Number Input */}
                {preferences.sms_enabled && (
                  <div className="p-4 bg-surface-muted/20 rounded-lg border border-border/50 animate-in fade-in zoom-in-95 duration-200">
                    <label className="block text-sm font-medium text-foreground/80 mb-2">Phone Number</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-foreground/50">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        className="bg-background border border-border text-foreground text-sm rounded-lg focus:ring-primary focus:border-primary block w-full pl-10 p-3 outline-none transition-shadow hover:border-foreground/30 focus:shadow-[0_0_0_2px_rgba(var(--color-primary),0.2)]"
                        placeholder="+1234567890"
                        value={preferences.phone_number}
                        onChange={(e) => setPreferences({ ...preferences, phone_number: e.target.value })}
                      />
                    </div>
                    <p className="mt-2 text-xs text-foreground/50">Must include country code (e.g., +1). Standard messaging rates apply.</p>
                  </div>
                )}
                
                <div className="pt-4 flex items-center justify-end gap-4 border-t border-border mt-4">
                  {saveSuccess && (
                    <span className="text-sm text-success font-medium animate-in fade-in">Preferences saved successfully!</span>
                  )}
                  <button 
                    onClick={savePreferences} 
                    disabled={loading || saving} 
                    className="px-6 py-2.5 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 transition shadow-lg shadow-primary/20 text-primary-foreground flex items-center disabled:opacity-70"
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {saving ? "Saving..." : "Save Preferences"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
