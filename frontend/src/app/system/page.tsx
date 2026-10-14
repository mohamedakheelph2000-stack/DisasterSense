"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { apiClient, errorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
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
        if (status) return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
        return isConfig ? <AlertTriangle className="w-4 h-4 text-warning shrink-0" /> : <XCircle className="w-4 h-4 text-danger shrink-0" />;
    }
    if (status === "OPERATIONAL") return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
    if (status === "DEGRADED") return <AlertTriangle className="w-4 h-4 text-warning shrink-0" />;
    return <XCircle className="w-4 h-4 text-danger shrink-0" />;
  };

  const renderStatusBadge = (status: string | boolean, configLabel: string = "CONFIGURED", unconfigLabel: string = "NOT_CONFIGURED") => {
    if (typeof status === 'boolean') {
        if (status) return <Badge variant="outline" className="text-success border-success/30 bg-success/5 font-mono text-[11px]">{configLabel}</Badge>;
        return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/5 font-mono text-[11px]">{unconfigLabel}</Badge>;
    }
    if (status === "OPERATIONAL") return <Badge variant="outline" className="text-success border-success/30 bg-success/5 font-mono text-[11px]">OPERATIONAL</Badge>;
    if (status === "DEGRADED") return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/5 font-mono text-[11px]">DEGRADED</Badge>;
    return <Badge variant="outline" className="text-danger border-danger/30 bg-danger/5 font-mono text-[11px]">UNAVAILABLE</Badge>;
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Administration"
        title="System Telemetry"
        description="Health diagnostics, notification provider status, deployed ML models, and delivery performance."
        actions={
          <Button variant="outline" size="sm" onClick={fetchTelemetry} disabled={loading} className="h-8 gap-1.5 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
            <span>Refresh</span>
          </Button>
        }
      />

      {loading && !telemetry ? (
        <LoadingPanel label="Loading telemetry diagnostics…" />
      ) : error ? (
        <ErrorState error={new Error(error)} onRetry={fetchTelemetry} />
      ) : telemetry && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 1. Backend Core Services */}
          <FadeIn delay={0.05}>
            <div className="rounded-xl border border-border/80 bg-surface/60 p-5 shadow-sm h-full flex flex-col">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 pb-3 border-b border-border/60 text-foreground">
                <Activity className="w-4 h-4 text-primary" />
                Backend Services
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-surface-muted/30 rounded-lg border border-border/40">
                  <div className="flex items-center gap-3">
                     {renderStatusIcon(telemetry.core_api)}
                     <div>
                       <div className="text-sm font-medium text-foreground">Core API Server</div>
                       <div className="text-xs text-muted-foreground">FastAPI instance (Uvicorn)</div>
                     </div>
                  </div>
                  {renderStatusBadge(telemetry.core_api)}
                </div>

                <div className="flex items-center justify-between p-3.5 bg-surface-muted/30 rounded-lg border border-border/40">
                  <div className="flex items-center gap-3">
                     {renderStatusIcon(telemetry.database)}
                     <div>
                       <div className="text-sm font-medium text-foreground">Database Persistence</div>
                       <div className="text-xs text-muted-foreground">PostgreSQL relational storage</div>
                     </div>
                  </div>
                  {renderStatusBadge(telemetry.database)}
                </div>
              </div>
            </div>
          </FadeIn>

          {/* 2. Notification Gateways */}
          <FadeIn delay={0.1}>
            <div className="rounded-xl border border-border/80 bg-surface/60 p-5 shadow-sm h-full flex flex-col">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 pb-3 border-b border-border/60 text-foreground">
                <Mail className="w-4 h-4 text-primary" />
                Notification Providers
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-surface-muted/30 rounded-lg border border-border/40">
                  <div className="flex items-center gap-3">
                     {renderStatusIcon(telemetry.notifications?.email?.configured, true)}
                     <div>
                       <div className="text-sm font-medium text-foreground">SMTP Email Gateway</div>
                       <div className="text-xs text-muted-foreground">
                         {telemetry.notifications?.email?.enabled ? "Enabled for citizen & responder alerts" : "Disabled by configuration"}
                       </div>
                     </div>
                  </div>
                  {renderStatusBadge(telemetry.notifications?.email?.configured, "CONFIGURED", "NOT_CONFIGURED")}
                </div>

                <div className="flex items-center justify-between p-3.5 bg-surface-muted/30 rounded-lg border border-border/40">
                  <div className="flex items-center gap-3">
                     {renderStatusIcon(telemetry.notifications?.sms?.configured, true)}
                     <div>
                       <div className="text-sm font-medium text-foreground">SMS Provider</div>
                       <div className="text-xs text-muted-foreground">
                         {telemetry.notifications?.sms?.enabled ? "Enabled for urgent hazard dispatches" : "Disabled by configuration"}
                       </div>
                     </div>
                  </div>
                  {renderStatusBadge(telemetry.notifications?.sms?.configured, "CONFIGURED", "NOT_CONFIGURED")}
                </div>
              </div>
            </div>
          </FadeIn>

          {/* 3. ML Model Status */}
          <FadeIn delay={0.15}>
            <div className="rounded-xl border border-border/80 bg-surface/60 p-5 shadow-sm h-full flex flex-col">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 pb-3 border-b border-border/60 text-foreground">
                <BrainCircuit className="w-4 h-4 text-primary" />
                Deployed ML Models
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-surface-muted/30 rounded-lg border border-border/40">
                  <div className="flex items-center gap-3">
                     {renderStatusIcon(telemetry.ml_models?.flood?.loaded)}
                     <div>
                       <div className="text-sm font-medium text-foreground">Flood Risk Engine</div>
                       <div className="text-xs text-muted-foreground font-mono">
                         {telemetry.ml_models?.flood?.loaded ? (
                             `${telemetry.ml_models.flood.model_name || "Production"} · ${telemetry.ml_models.flood.model_version || "v1.0"}`
                         ) : (
                             "Model weights unavailable"
                         )}
                       </div>
                     </div>
                  </div>
                  {renderStatusBadge(telemetry.ml_models?.flood?.loaded, "LOADED", "UNAVAILABLE")}
                </div>

                <div className="flex items-center justify-between p-3.5 bg-surface-muted/30 rounded-lg border border-border/40">
                  <div className="flex items-center gap-3">
                     {renderStatusIcon(telemetry.ml_models?.landslide?.loaded)}
                     <div>
                       <div className="text-sm font-medium text-foreground">Landslide Risk Engine</div>
                       <div className="text-xs text-muted-foreground font-mono">
                          {telemetry.ml_models?.landslide?.loaded ? (
                             `${telemetry.ml_models.landslide.model_name || "Production"} · ${telemetry.ml_models.landslide.model_version || "v1.0"}`
                          ) : (
                             "Model weights unavailable"
                          )}
                       </div>
                     </div>
                  </div>
                  {renderStatusBadge(telemetry.ml_models?.landslide?.loaded, "LOADED", "UNAVAILABLE")}
                </div>
              </div>
            </div>
          </FadeIn>

          {/* 4. Notification Delivery Metrics */}
          <FadeIn delay={0.2}>
            <div className="rounded-xl border border-border/80 bg-surface/60 p-5 shadow-sm h-full flex flex-col">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 pb-3 border-b border-border/60 text-foreground">
                <Activity className="w-4 h-4 text-primary" />
                Notification Delivery (24 Hours)
              </h3>
              
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="p-3 bg-surface-muted/30 rounded-lg border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block mb-0.5">Attempted</span>
                  <span className="text-xl font-bold font-mono text-foreground">{telemetry.notifications?.total_deliveries_24h || 0}</span>
                </div>
                <div className="p-3 bg-surface-muted/30 rounded-lg border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block mb-0.5">Successful</span>
                  <span className="text-xl font-bold font-mono text-success">{telemetry.notifications?.successful_deliveries_24h || 0}</span>
                </div>
                <div className="p-3 bg-surface-muted/30 rounded-lg border border-border/40 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block mb-0.5">Failed</span>
                  <span className="text-xl font-bold font-mono text-danger">{telemetry.notifications?.failed_deliveries_24h || 0}</span>
                </div>
              </div>

              <div className="p-2.5 bg-surface-muted/20 rounded-lg border border-border/30 text-center text-xs text-muted-foreground">
                Breakdown: <span className="font-mono text-foreground/80 font-medium">{telemetry.notifications?.email_deliveries_24h || 0} Email</span> · <span className="font-mono text-foreground/80 font-medium">{telemetry.notifications?.sms_deliveries_24h || 0} SMS</span>
              </div>
            </div>
          </FadeIn>

        </div>
      )}
    </AppShell>
  );
}
