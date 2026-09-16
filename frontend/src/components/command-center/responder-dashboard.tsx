import { SystemStatusHero } from "@/components/dashboard/system-status-hero";
import { MLSystemStatus } from "@/components/dashboard/ml-system-status";
import { MapPreview } from "@/components/dashboard/map-preview";
import { FadeIn } from "@/components/animations/fade-in";
import { AlertTriangle, ShieldAlert, CheckCircle2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IncidentQueue } from "./incident-queue";
import { Counter } from "@/components/animations/counter";
import { RegionalSituation } from "@/components/dashboard/regional-situation";

export function ResponderCommandCenter({ data, loading, error, onRetry }: any) {
  if (error) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-center">
        <AlertTriangle className="h-16 w-16 text-danger mb-4" />
        <h2 className="text-2xl font-bold tracking-tight mb-2">COMMAND CENTER OFFLINE</h2>
        <p className="text-foreground/60 mb-6">{error}</p>
        <Button onClick={onRetry}>Retry Connection</Button>
      </div>
    );
  }

  const activeIncidents = data.alerts?.filter((a: any) => a.status === 'active') || [];
  const respondingIncidents = data.alerts?.filter((a: any) => a.status === 'acknowledged' || a.status === 'response_in_progress') || [];
  const highCriticalAlerts = data.alerts?.filter((a: any) => {
      const sev = a.__mock_meta?.severity || "info"; // Simplified for dashboard KPIs
      return sev === 'critical' || sev === 'high' || a.title?.includes('CRITICAL') || a.title?.includes('HIGH');
  }) || [];
  const totalEvents = data.events?.length || 0;

  return (
    <>
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-danger/20 blur-[150px] rounded-full mix-blend-screen" />
      </div>

      <FadeIn direction="up">
        <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-border/50">
          <ShieldAlert className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Operational Command Center</h1>
        </div>
      </FadeIn>

      {/* Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <FadeIn delay={0.1}>
          <div className="bg-surface-muted/30 border border-danger/30 rounded-xl p-6 flex flex-col relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldAlert className="w-16 h-16 text-danger" /></div>
            <span className="text-sm font-semibold text-danger uppercase tracking-wider mb-2">High/Critical Alerts</span>
            <span className="text-4xl font-bold text-danger"><Counter to={highCriticalAlerts.length} /></span>
          </div>
        </FadeIn>
        <FadeIn delay={0.2}>
          <div className="bg-surface-muted/30 border border-warning/30 rounded-xl p-6 flex flex-col relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 p-4 opacity-10"><AlertTriangle className="w-16 h-16 text-warning" /></div>
            <span className="text-sm font-semibold text-warning uppercase tracking-wider mb-2">Awaiting Ack</span>
            <span className="text-4xl font-bold text-warning"><Counter to={activeIncidents.length} /></span>
          </div>
        </FadeIn>
        <FadeIn delay={0.3}>
          <div className="bg-surface-muted/30 border border-info/30 rounded-xl p-6 flex flex-col relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Activity className="w-16 h-16 text-info" /></div>
            <span className="text-sm font-semibold text-info uppercase tracking-wider mb-2">In Response</span>
            <span className="text-4xl font-bold text-info"><Counter to={respondingIncidents.length} /></span>
          </div>
        </FadeIn>
        <FadeIn delay={0.4}>
          <div className="bg-surface-muted/30 border border-white/10 rounded-xl p-6 flex flex-col relative overflow-hidden h-full">
            <div className="absolute top-0 right-0 p-4 opacity-10"><CheckCircle2 className="w-16 h-16 text-foreground" /></div>
            <span className="text-sm font-semibold text-foreground/50 uppercase tracking-wider mb-2">Recent Events</span>
            <span className="text-4xl font-bold"><Counter to={totalEvents} /></span>
          </div>
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 pb-12">
        
        {/* Incident Queue (Col Span 4) */}
        <div className="xl:col-span-4 h-[500px]">
          <FadeIn delay={0.5} className="h-full">
             <IncidentQueue incidents={data.alerts} loading={loading} />
          </FadeIn>
        </div>

        {/* Live Map Integration (Col Span 5) */}
        <div className="xl:col-span-5 h-[500px]">
          <FadeIn delay={0.6} className="h-full">
             <MapPreview />
          </FadeIn>
        </div>
        
        {/* Regional Situation Signal (Col Span 3) */}
        <div className="xl:col-span-3 h-[500px]">
          <FadeIn delay={0.65} className="h-full">
             <RegionalSituation clusters={data.clusters} />
          </FadeIn>
        </div>

        {/* System Status */}
        <div className="xl:col-span-12 h-[350px] mt-6">
           <FadeIn delay={0.7} className="h-full">
              <MLSystemStatus status={data.systemStatus} loading={loading} />
           </FadeIn>
        </div>

      </div>
    </>
  );
}
