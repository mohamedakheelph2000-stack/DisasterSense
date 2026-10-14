"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { apiClient, errorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { Card } from "@/components/ui/card";
import { Activity, Mail, CheckCircle2, AlertTriangle, XCircle, BrainCircuit, RefreshCw } from "lucide-react";
import { FadeIn } from "@/components/animations/fade-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ForbiddenState, ErrorState, LoadingPanel } from "@/components/ui/states";

export default function SystemStatusPage() {
  const { user, loading: authLoading } = useAuth();

  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient<any>("/system/status");
      setTelemetry(res);
    } catch (err) {
      setError(errorMessage(err));
      setTelemetry(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
       fetchTelemetry();
    } else if (!authLoading) {
       setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  if (authLoading || user?.role !== "admin") {
    return (
      <AppShell>
        <ForbiddenState message="System telemetry is restricted to administrator accounts." />
      </AppShell>
    );
  }

  const renderStatusIcon = (status: string | boolean, isConfig?: boolean) => {
    if (typeof status === 'boolean') {
        if (status) return <CheckCircle2 className="w-5 h-5 text-success" />;
        return isConfig ? <AlertTriangle className="w-5 h-5 text-warning" /> : <XCircle className="w-5 h-5 text-danger" />;
    }
    if (status === "OPERATIONAL") return <CheckCircle2 className="w-5 h-5 text-success" />;
    if (status === "DEGRADED") return <AlertTriangle className="w-5 h-5 text-warning" />;
    return <XCircle className="w-5 h-5 text-danger" />;
  };

  const renderStatusBadge = (status: string | boolean, configLabel: string = "CONFIGURED", unconfigLabel: string = "NOT_CONFIGURED") => {
    if (typeof status === 'boolean') {
        if (status) return <Badge variant="outline" className="text-success border-success/30">{configLabel}</Badge>;
        return <Badge variant="outline" className="text-warning border-warning/30">{unconfigLabel}</Badge>;
    }
    if (status === "OPERATIONAL") return <Badge variant="outline" className="text-success border-success/30">OPERATIONAL</Badge>;
    if (status === "DEGRADED") return <Badge variant="outline" className="text-warning border-warning/30">DEGRADED</Badge>;
    return <Badge variant="outline" className="text-danger border-danger/30">UNAVAILABLE</Badge>;
  };

  return (
    <AppShell>
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-info/20 blur-[150px] rounded-full mix-blend-screen" />
      </div>

      <PageHeader
        eyebrow="Operations"
        title="System Telemetry"
        description="Administrator view of backend health, notification pipeline configuration and deployed ML engines."
        actions={
          <Button variant="outline" size="sm" onClick={fetchTelemetry} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      {loading && !telemetry ? (
        <LoadingPanel label="Loading telemetry…" />
      ) : error ? (
        <ErrorState error={new Error(error)} onRetry={fetchTelemetry} />
      ) : telemetry && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <FadeIn delay={0.1}>
            <Card variant="glass" className="p-6 h-full flex flex-col border-border/50">
              <h3 className="text-lg font-semibold mb-6 flex items-center border-b border-white/10 pb-4">
                <Activity className="w-5 h-5 mr-3 text-info" /> Backend Services
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-surface-muted/30 rounded-lg border border-white/5">
                  <div className="flex items-center space-x-4">
                     {renderStatusIcon(telemetry.core_api)}
                     <div>
                       <div className="font-medium">Core API Server</div>
                       <div className="text-xs text-foreground/50">FastAPI backend instance</div>
                     </div>
                  </div>
                  {renderStatusBadge(telemetry.core_api)}
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-muted/30 rounded-lg border border-white/5">
                  <div className="flex items-center space-x-4">
                     {renderStatusIcon(telemetry.database)}
                     <div>
                       <div className="font-medium">Database Persistence</div>
                       <div className="text-xs text-foreground/50">PostgreSQL connection state</div>
                     </div>
                  </div>
                  {renderStatusBadge(telemetry.database)}
                </div>
              </div>
            </Card>
          </FadeIn>

          <FadeIn delay={0.2}>
            <Card variant="glass" className="p-6 h-full flex flex-col border-border/50">
              <h3 className="text-lg font-semibold mb-6 flex items-center border-b border-white/10 pb-4">
                <Mail className="w-5 h-5 mr-3 text-warning" /> Notification Providers
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-surface-muted/30 rounded-lg border border-white/5">
                  <div className="flex items-center space-x-4">
                     {renderStatusIcon(telemetry.notifications?.email?.configured, true)}
                     <div>
                       <div className="font-medium">SMTP Email Gateway</div>
                       <div className="text-xs text-foreground/50">{telemetry.notifications?.email?.enabled ? "Enabled globally" : "Disabled by policy"}</div>
                     </div>
                  </div>
                  {renderStatusBadge(telemetry.notifications?.email?.configured, "CONFIGURED", "NOT_CONFIGURED")}
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-muted/30 rounded-lg border border-white/5">
                  <div className="flex items-center space-x-4">
                     {renderStatusIcon(telemetry.notifications?.sms?.configured, true)}
                     <div>
                       <div className="font-medium">SMS Provider</div>
                       <div className="text-xs text-foreground/50">{telemetry.notifications?.sms?.enabled ? "Enabled globally" : "Disabled by policy"}</div>
                     </div>
                  </div>
                  {renderStatusBadge(telemetry.notifications?.sms?.configured, "CONFIGURED", "NOT_CONFIGURED")}
                </div>
              </div>
            </Card>
          </FadeIn>

          <FadeIn delay={0.3}>
            <Card variant="glass" className="p-6 h-full flex flex-col border-border/50">
              <h3 className="text-lg font-semibold mb-6 flex items-center border-b border-white/10 pb-4">
                <BrainCircuit className="w-5 h-5 mr-3 text-purple-400" /> ML Model Status
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-surface-muted/30 rounded-lg border border-white/5">
                  <div className="flex items-center space-x-4">
                     {renderStatusIcon(telemetry.ml_models?.flood?.loaded)}
                     <div>
                       <div className="font-medium">Flood Risk Engine</div>
                       <div className="text-xs text-foreground/50">
                         {telemetry.ml_models?.flood?.loaded ? (
                             `${telemetry.ml_models.flood.model_name || "Unknown"} (${telemetry.ml_models.flood.model_version || "Unknown"})`
                         ) : (
                             "Model unavailable"
                         )}
                       </div>
                     </div>
                  </div>
                  {renderStatusBadge(telemetry.ml_models?.flood?.loaded, "LOADED", "UNAVAILABLE")}
                </div>

                <div className="flex items-center justify-between p-4 bg-surface-muted/30 rounded-lg border border-white/5">
                  <div className="flex items-center space-x-4">
                     {renderStatusIcon(telemetry.ml_models?.landslide?.loaded)}
                     <div>
                       <div className="font-medium">Landslide Risk Engine</div>
                       <div className="text-xs text-foreground/50">
                          {telemetry.ml_models?.landslide?.loaded ? (
                             `${telemetry.ml_models.landslide.model_name || "Unknown"} (${telemetry.ml_models.landslide.model_version || "Unknown"})`
                          ) : (
                             "Model unavailable"
                          )}
                       </div>
                     </div>
                  </div>
                  {renderStatusBadge(telemetry.ml_models?.landslide?.loaded, "LOADED", "UNAVAILABLE")}
                </div>
              </div>
            </Card>
          </FadeIn>

          <FadeIn delay={0.4}>
            <Card variant="glass" className="p-6 h-full flex flex-col border-border/50">
              <h3 className="text-lg font-semibold mb-6 flex items-center border-b border-white/10 pb-4">
                <Activity className="w-5 h-5 mr-3 text-primary" /> Notification Delivery (24h)
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface-muted/30 rounded-lg border border-white/5 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-foreground/50 uppercase tracking-wider mb-1">Total Attempted</span>
                  <span className="text-3xl font-bold">{telemetry.notifications?.total_deliveries_24h || 0}</span>
                </div>
                <div className="p-4 bg-surface-muted/30 rounded-lg border border-white/5 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-foreground/50 uppercase tracking-wider mb-1">Successful</span>
                  <span className="text-3xl font-bold text-success">{telemetry.notifications?.successful_deliveries_24h || 0}</span>
                </div>
                <div className="p-4 bg-surface-muted/30 rounded-lg border border-white/5 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-foreground/50 uppercase tracking-wider mb-1">Failed</span>
                  <span className="text-3xl font-bold text-danger">{telemetry.notifications?.failed_deliveries_24h || 0}</span>
                </div>
                <div className="p-4 bg-surface-muted/30 rounded-lg border border-white/5 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-foreground/50 uppercase tracking-wider mb-1">Breakdown</span>
                  <span className="text-sm font-medium text-foreground/70 mt-1">
                    {telemetry.notifications?.email_deliveries_24h || 0} Email • {telemetry.notifications?.sms_deliveries_24h || 0} SMS
                  </span>
                </div>
              </div>
            </Card>
          </FadeIn>

        </div>
      )}
    </AppShell>
  );
}
