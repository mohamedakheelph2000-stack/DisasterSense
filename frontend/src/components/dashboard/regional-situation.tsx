import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Map, AlertTriangle } from "lucide-react";

export function RegionalSituation({ clusters = [] }: { clusters: any[] }) {
  const floodClusters = clusters.filter(c => c.hazard_type === 'flood');
  const landslideClusters = clusters.filter(c => c.hazard_type === 'landslide');

  return (
    <Card variant="glass" className="h-full border-border/30">
      <CardHeader className="border-b border-border/30 pb-3">
        <div className="flex items-center space-x-2">
          <Map className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Regional Situation Signal</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {clusters.length === 0 ? (
          <div className="text-center py-6 text-foreground/50 text-sm">
            No significant regional clusters detected.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-muted/30 p-3 rounded-lg border border-info/20 text-center">
                 <div className="text-xs uppercase text-info/70 font-semibold mb-1">Flood Clusters</div>
                 <div className="text-2xl font-bold text-info">{floodClusters.length}</div>
              </div>
              <div className="bg-surface-muted/30 p-3 rounded-lg border border-warning/20 text-center">
                 <div className="text-xs uppercase text-warning/70 font-semibold mb-1">Landslide Clusters</div>
                 <div className="text-2xl font-bold text-warning">{landslideClusters.length}</div>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
              {clusters.map((cluster) => (
                <div key={cluster.cluster_id} className="bg-surface-muted/50 p-3 rounded-md border border-white/5 flex flex-col space-y-2">
                   <div className="flex justify-between items-center">
                     <Badge variant={cluster.hazard_type === 'flood' ? 'info' : 'warning'} className="uppercase text-[10px]">
                       {cluster.hazard_type}
                     </Badge>
                     <span className="text-xs text-foreground/50 font-mono">
                       {cluster.centroid_lat.toFixed(2)}, {cluster.centroid_lon.toFixed(2)}
                     </span>
                   </div>
                   <div className="flex justify-between text-sm">
                     <span className="text-foreground/70">Avg Risk</span>
                     <span className="font-bold font-mono">{cluster.average_risk}</span>
                   </div>
                   <div className="flex justify-between text-xs text-foreground/50">
                     <span>{cluster.member_count} Members</span>
                     <span className={cluster.quality_indicator === "WELL_SUPPORTED" ? "text-success" : "text-primary"}>
                       {cluster.quality_indicator.replace('_', ' ')}
                     </span>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
