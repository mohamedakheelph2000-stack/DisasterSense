import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Server, Database, CheckCircle2 } from "lucide-react";

interface MLSystemStatusProps {
  status: any;
  loading: boolean;
}

export function MLSystemStatus({ status, loading }: MLSystemStatusProps) {
  if (loading) {
    return <Skeleton className="h-[200px] w-full" />;
  }

  if (!status) return null;

  return (
    <Card variant="glass" className="h-full">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="text-lg flex items-center space-x-2">
          <Server className="h-5 w-5 text-foreground/50" />
          <span>System & ML Status</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-foreground/70 flex items-center"><Database className="w-3 h-3 mr-2" />Flood Model</span>
            <span className="text-success font-medium text-xs bg-success/10 px-2 py-0.5 rounded flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-1" /> {status.flood_model_version}
            </span>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-foreground/70 flex items-center"><Database className="w-3 h-3 mr-2" />Landslide Model</span>
            <span className="text-success font-medium text-xs bg-success/10 px-2 py-0.5 rounded flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-1" /> {status.landslide_model_version}
            </span>
          </div>
        </div>
        <div className="pt-2 border-t border-border/50">
           <div className="flex justify-between text-xs text-foreground/50">
              <span>Risk Engine Connectivity</span>
              <span className="text-success">Verified</span>
           </div>
           <div className="flex justify-between text-xs text-foreground/50 mt-1">
              <span>Data Integration</span>
              <span className="text-info">{status.weather_api}</span>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
