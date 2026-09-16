import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { CloudRain, Thermometer, Droplets, Mountain, Activity } from "lucide-react";
import { Badge } from "../ui/badge";

interface EnvironmentalPanelProps {
  data: any;
  loading: boolean;
}

export function EnvironmentalPanel({ data, loading }: EnvironmentalPanelProps) {
  if (loading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!data) return null;

  return (
    <Card variant="glass" className="h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center space-x-2">
          <CloudRain className="h-5 w-5 text-info" />
          <span>Environmental Telemetry</span>
        </CardTitle>
        {data.status && (
          <Badge variant={data.status === "LIVE" ? "success" : data.status === "ERROR" ? "danger" : "default"}>
            {data.status}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface-muted/30 p-3 rounded-lg border border-white/5">
            <div className="flex items-center space-x-2 text-foreground/60 text-xs uppercase mb-1">
              <CloudRain className="w-3 h-3 text-info" />
              <span>Rainfall 24h</span>
            </div>
            <div className="text-2xl font-bold">{data.rainfall_24h ?? data.rainfall_mm_24h ?? '--'} <span className="text-sm font-normal text-foreground/50">mm</span></div>
            <div className="h-1 w-full bg-surface-muted rounded-full mt-2">
               <div className="h-full bg-info rounded-full" style={{ width: `${Math.min(((data.rainfall_24h ?? data.rainfall_mm_24h ?? 0) / 200) * 100, 100)}%` }} />
            </div>
          </div>
          
          <div className="bg-surface-muted/30 p-3 rounded-lg border border-white/5">
            <div className="flex items-center space-x-2 text-foreground/60 text-xs uppercase mb-1">
              <Thermometer className="w-3 h-3 text-warning" />
              <span>Temperature</span>
            </div>
            <div className="text-2xl font-bold">{data.temperature ?? data.temperature_c ?? '--'} <span className="text-sm font-normal text-foreground/50">°C</span></div>
          </div>

          <div className="bg-surface-muted/30 p-3 rounded-lg border border-white/5">
            <div className="flex items-center space-x-2 text-foreground/60 text-xs uppercase mb-1">
              <Droplets className="w-3 h-3 text-primary" />
              <span>7-Day Rainfall</span>
            </div>
            <div className="text-2xl font-bold text-danger">{data.antecedent_rainfall_7d ?? '--'} <span className="text-sm font-normal text-foreground/50">mm</span></div>
             <div className="h-1 w-full bg-surface-muted rounded-full mt-2">
               <div className="h-full bg-danger rounded-full animate-pulse" style={{ width: `${Math.min(((data.antecedent_rainfall_7d ?? 0) / 500) * 100, 100)}%` }} />
            </div>
          </div>

          <div className="bg-surface-muted/30 p-3 rounded-lg border border-white/5">
            <div className="flex items-center space-x-2 text-foreground/60 text-xs uppercase mb-1">
              <Mountain className="w-3 h-3 text-foreground/40" />
              <span>Elevation</span>
            </div>
            <div className="text-2xl font-bold">{data.elevation ?? '--'} <span className="text-sm font-normal text-foreground/50">m</span></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
