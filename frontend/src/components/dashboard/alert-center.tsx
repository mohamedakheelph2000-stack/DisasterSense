import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { AlertCard } from "../alerts/alert-card";
import { BellRing, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";

interface AlertCenterProps {
  alerts: any[];
  loading: boolean;
}

export function AlertCenter({ alerts, loading }: AlertCenterProps) {
  return (
    <Card variant="glass" className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center space-x-2">
            <BellRing className="h-5 w-5 text-warning" />
            <span>Active Alerts</span>
          </CardTitle>
          <Link href="/alerts">
            <Button variant="ghost" size="sm" className="text-xs h-7">View All</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {loading ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : alerts.length > 0 ? (
            alerts.map((alert) => (
              <AlertCard 
                key={alert.id}
                title={alert.title}
                message={alert.message}
                severity={alert.severity}
                time={alert.time}
              />
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-foreground/50 space-y-3 p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-success/50" />
              <p>No active emergency alerts at this time.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
