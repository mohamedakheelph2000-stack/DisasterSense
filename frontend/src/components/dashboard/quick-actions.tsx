import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Activity, Map, AlertTriangle, BarChart3, Database } from "lucide-react";

export function QuickActions() {
  const actions = [
    { label: "Assess Risk", icon: Activity, color: "text-primary", bg: "bg-primary/10 hover:bg-primary/20" },
    { label: "Live Map", icon: Map, color: "text-info", bg: "bg-info/10 hover:bg-info/20" },
    { label: "Manage Alerts", icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10 hover:bg-warning/20" },
    { label: "View Analytics", icon: BarChart3, color: "text-accent", bg: "bg-accent/10 hover:bg-accent/20" },
  ];

  return (
    <Card variant="glass" className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, idx) => (
            <button 
              key={idx} 
              className={`flex flex-col items-center justify-center p-4 rounded-xl border border-white/5 transition-all duration-200 group ${action.bg}`}
            >
              <action.icon className={`h-6 w-6 mb-2 ${action.color} group-hover:scale-110 transition-transform`} />
              <span className="text-xs font-medium text-foreground/80">{action.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
