import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PulseGlow } from "../animations/pulse-glow";

interface AlertCardProps {
  title: string;
  message: string;
  severity: "info" | "warning" | "high" | "critical";
  time: string;
}

export function AlertCard({ title, message, severity, time }: AlertCardProps) {
  const config = {
    info: { icon: Info, color: "text-info", bg: "bg-info/10", border: "border-info/20" },
    warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
    high: { icon: ShieldAlert, color: "text-danger", bg: "bg-danger/10", border: "border-danger/20" },
    critical: { icon: ShieldAlert, color: "text-critical", bg: "bg-critical/10", border: "border-critical/30" },
  };

  const { icon: Icon, color, bg, border } = config[severity];
  const isCritical = severity === "critical";

  const content = (
    <Card className={`relative overflow-hidden ${bg} ${border}`}>
      <CardContent className="p-4 flex items-start space-x-4">
        <div className={`p-2 rounded-full bg-background/50 ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className={`font-semibold ${color}`}>{title}</h4>
            <span className="text-xs text-foreground/50">{time}</span>
          </div>
          <p className="text-sm text-foreground/80 mt-1">{message}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (isCritical) {
    return (
      <PulseGlow color="rgba(var(--critical), 0.3)">
        {content}
      </PulseGlow>
    );
  }

  return content;
}
