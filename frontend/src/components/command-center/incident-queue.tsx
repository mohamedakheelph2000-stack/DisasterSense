import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, AlertTriangle, Info, Clock, ExternalLink } from "lucide-react";
import { AlertRead } from "@/lib/api/types/alert";
import Link from "next/link";
import { parseSeverityFromTitle } from "@/lib/api/adapters";

interface IncidentQueueProps {
  incidents: (AlertRead & { __mock_meta?: any })[];
  loading: boolean;
}

export function IncidentQueue({ incidents, loading }: IncidentQueueProps) {
  if (loading) {
    return (
      <Card variant="glass" className="h-full p-6 flex flex-col items-center justify-center border-border/50">
        <div className="w-8 h-8 rounded-full border-4 border-surface border-t-primary animate-spin mb-4" />
        <span className="text-foreground/50 text-sm uppercase tracking-wider">Syncing Incidents</span>
      </Card>
    );
  }

  if (incidents.length === 0) {
    return (
      <Card variant="glass" className="h-full p-6 flex flex-col items-center justify-center border-border/50 opacity-60">
        <ShieldAlert className="w-12 h-12 text-success/50 mb-4" />
        <span className="text-foreground/60">No Active Incidents</span>
      </Card>
    );
  }

  // Sort CRITICAL -> HIGH -> MODERATE -> LOW
  const sortedIncidents = [...incidents].sort((a, b) => {
    const sevA = a.severity || a.__mock_meta?.severity || parseSeverityFromTitle(a.title) || "info";
    const sevB = b.severity || b.__mock_meta?.severity || parseSeverityFromTitle(b.title) || "info";
    const order = { critical: 4, high: 3, moderate: 2, low: 1, info: 0 };
    return (order[sevB as keyof typeof order] || 0) - (order[sevA as keyof typeof order] || 0);
  });

  return (
    <Card variant="glass" className="h-full border-border/50 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center justify-between bg-surface-muted/30">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h3 className="font-semibold text-lg tracking-tight">Incident Queue</h3>
        </div>
        <Badge variant="outline" className="bg-surface">{incidents.length} Active</Badge>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {sortedIncidents.map((incident) => {
          const severity = incident.severity || incident.__mock_meta?.severity || parseSeverityFromTitle(incident.title) || "info";
          const isCritical = severity === "critical";
          const isHigh = severity === "high";

          return (
            <Link key={incident.id} href={`/alerts?id=${incident.id}`}>
              <div className={`p-4 rounded-lg border transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isCritical ? "bg-critical/5 border-critical/30 hover:bg-critical/10" :
                isHigh ? "bg-danger/5 border-danger/30 hover:bg-danger/10" :
                "bg-surface-muted/30 border-white/5 hover:bg-surface-muted/50"
              }`}>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={severity as any} className="uppercase text-[10px]">{severity}</Badge>
                    <Badge variant="outline" className="uppercase text-[10px] opacity-70">{incident.status.replace(/_/g, ' ')}</Badge>
                  </div>
                  <h4 className="font-semibold text-foreground/90">{incident.title}</h4>
                  <div className="flex items-center text-xs text-foreground/60 gap-3 mt-1">
                    <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {new Date(incident.created_at).toLocaleTimeString()}</span>
                    <span>{incident.__mock_meta?.location || `Loc ID: ${incident.location_id}`}</span>
                  </div>
                </div>
                <div className="flex items-center text-primary/70 hover:text-primary transition-colors text-sm font-medium">
                  Details <ExternalLink className="w-4 h-4 ml-1" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
