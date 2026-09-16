import { RiskScoreCard } from "../risk/risk-score-card";
import { FadeIn } from "../animations/fade-in";
import { Card, CardContent } from "../ui/card";
import { Clock } from "lucide-react";

interface OverallRiskCardProps {
  score: number;
  level: string;
  lastUpdated?: string;
  loading?: boolean;
}

export function OverallRiskCard({ score, level, lastUpdated, loading }: OverallRiskCardProps) {
  if (loading) {
    return (
      <FadeIn>
        <Card className="h-full bg-surface/50 border-white/5 relative overflow-hidden">
          <div className="animate-pulse absolute inset-0 bg-surface-muted/30" />
          <CardContent className="h-64 flex flex-col justify-center items-center">
            <div className="w-32 h-32 rounded-full border-4 border-surface-muted/50 border-t-primary animate-spin" />
          </CardContent>
        </Card>
      </FadeIn>
    );
  }

  return (
    <FadeIn delay={0.1}>
      <div className="h-full flex flex-col">
        <div className="flex-1">
          <RiskScoreCard title="Overall Risk" score={score} level={level} />
        </div>
        {lastUpdated && (
          <div className="text-xs text-foreground/40 flex items-center justify-center mt-3">
            <Clock className="w-3 h-3 mr-1" />
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          </div>
        )}
      </div>
    </FadeIn>
  );
}
