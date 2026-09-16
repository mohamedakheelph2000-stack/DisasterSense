import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Counter } from "../animations/counter";
import { Skeleton } from "../ui/skeleton";
import { Waves, Mountain } from "lucide-react";

interface FeatureImpact {
  feature: string;
  value: number;
  importance: number;
  impact_level: string;
}

interface DetailedRiskCardProps {
  type: "flood" | "landslide";
  data: any;
  loading: boolean;
}

export function DetailedRiskCard({ type, data, loading }: DetailedRiskCardProps) {
  if (loading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  if (!data) return null;

  const isCritical = data.risk_score >= 80;
  const isFlood = type === "flood";
  const Icon = isFlood ? Waves : Mountain;
  
  let colorClass = "text-success";
  let barColorClass = "bg-success";
  if (data.risk_score >= 80) { colorClass = "text-critical"; barColorClass = "bg-critical"; }
  else if (data.risk_score >= 60) { colorClass = "text-danger"; barColorClass = "bg-danger"; }
  else if (data.risk_score >= 40) { colorClass = "text-warning"; barColorClass = "bg-warning"; }

  return (
    <Card variant="glass" className="h-full flex flex-col relative overflow-hidden group">
      {isCritical && (
        <div className="absolute inset-0 bg-critical/5 mix-blend-overlay opacity-50 pointer-events-none" />
      )}
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-2">
            <div className={`p-2 rounded-md bg-surface-muted ${isFlood ? "text-info" : "text-warning"}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg uppercase tracking-wider">{type} RISK</CardTitle>
              <div className="text-xs text-foreground/50 mt-1 font-mono">MODEL: {data.model_version}</div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${colorClass}`}>
              <Counter to={data.risk_score} duration={1} />
            </div>
            <Badge variant={data.risk_score >= 80 ? "critical" : data.risk_score >= 60 ? "danger" : data.risk_score >= 40 ? "warning" : "success"} className="mt-1">
              {data.risk_level}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 flex-1">
        <h4 className="text-xs font-semibold text-foreground/50 uppercase mb-3">Key Contributing Factors</h4>
        <div className="space-y-4">
          {data.feature_impacts?.map((feature: FeatureImpact, idx: number) => {
            const pct = Math.min(100, Math.round(feature.importance * 100));
            return (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-foreground/80">{feature.feature.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-foreground/60">{pct}%</span>
                </div>
                <div className="h-1.5 w-full bg-surface-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${barColorClass}`} 
                    style={{ width: `${pct}%` }} 
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
