import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { History, MapPin, ShieldCheck, AlertTriangle } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface RecentEventsListProps {
  events: any[];
  loading: boolean;
}

export function RecentEventsList({ events, loading }: RecentEventsListProps) {
  return (
    <Card variant="glass" className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center space-x-2">
            <History className="h-5 w-5 text-accent" />
            <span>Recent Events</span>
          </CardTitle>
          <Button variant="link" size="sm" className="text-xs h-7 text-primary">View All</Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {loading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : events.length > 0 ? (
            <div className="relative border-l border-border/50 ml-3 space-y-6">
              {events.map((event) => (
                <div key={event.id} className="relative pl-6">
                  {/* Timeline dot */}
                  <div className={`absolute -left-2 top-1 h-4 w-4 rounded-full border-4 border-surface ${event.status === 'active' ? 'bg-danger animate-pulse' : 'bg-success'}`} />
                  
                  <div className="bg-surface-muted/30 p-3 rounded-lg border border-white/5 group hover:border-white/20 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground/90 capitalize">{event.type}</span>
                        {event.status === 'active' && <Badge variant="danger" className="text-[10px] px-1.5 py-0">ACTIVE</Badge>}
                      </div>
                      <span className="text-xs text-foreground/50">{new Date(event.time).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center text-xs text-foreground/60 space-x-3">
                      <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {event.location}</span>
                      <span className="flex items-center">
                         {event.severity === 'high' ? <AlertTriangle className="w-3 h-3 mr-1 text-danger" /> : <ShieldCheck className="w-3 h-3 mr-1 text-warning" />}
                         Severity: <span className="capitalize ml-1">{event.severity}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-foreground/50">
              <p>No recent events recorded.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
