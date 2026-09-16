import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskGauge } from "./risk-gauge";
import { Badge } from "@/components/ui/badge";
import { PulseGlow } from "../animations/pulse-glow";
import { Activity } from "lucide-react";

interface RiskScoreCardProps {
  title: string;
  score: number;
  level: string;
  trend?: "up" | "down" | "stable";
}

export function RiskScoreCard({ title, score, level, trend }: RiskScoreCardProps) {
  const isCritical = score >= 80;

  let badgeVariant: "success" | "warning" | "danger" | "critical" = "success";
  if (score >= 80) badgeVariant = "critical";
  else if (score >= 60) badgeVariant = "danger";
  else if (score >= 40) badgeVariant = "warning";

  const content = (
    <Card variant="glass" className="relative overflow-hidden h-full">
      {/* Decorative background gradient based on risk */}
      {isCritical && (
        <div className="absolute inset-0 bg-critical/5 mix-blend-overlay pointer-events-none" />
      )}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Activity className="h-4 w-4 text-primary" />
            <span>{title}</span>
          </CardTitle>
          <Badge variant={badgeVariant} className="uppercase tracking-widest text-[10px]">
            {level}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center pt-6 pb-8">
        <RiskGauge score={score} size={160} strokeWidth={12} />
        <div className="mt-4 text-center">
          <p className="text-sm text-foreground/60">
            Current calculated probability based on live data and ML models.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (isCritical) {
    return <PulseGlow className="h-full">{content}</PulseGlow>;
  }

  return content;
}
