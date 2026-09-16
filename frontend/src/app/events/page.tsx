"use client";

import { useState, useEffect } from "react";
import { History, Search, AlertCircle, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";

interface DisasterEvent {
  id: number;
  hazard_type: string;
  severity: string;
  record_type: string;
  risk_score: number;
  data_source: string;
  event_time: string;
  created_at: string;
}

export default function DisasterEventsPage() {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<{ items: DisasterEvent[] }>("/disaster-events/");
      setEvents(data?.items || []);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setError("Failed to load disaster events. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getRecordTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case "historical":
        return <Badge variant="outline" className="bg-surface-muted text-foreground/80 border-foreground/20">Historical</Badge>;
      case "predictive":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Predictive</Badge>;
      case "demo":
        return <Badge variant="warning">Demo</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return <Badge variant="critical">Critical</Badge>;
      case "high":
        return <Badge variant="warning" className="bg-warning text-warning-foreground">High</Badge>;
      case "moderate":
        return <Badge variant="info">Moderate</Badge>;
      case "low":
      case "very_low":
        return <Badge variant="success">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center">
            <History className="w-8 h-8 mr-3 text-primary" />
            Disaster Events
          </h1>
          <p className="text-foreground/60">Comprehensive log of historical and predictive disaster assessments.</p>
        </div>
        <button 
          onClick={fetchEvents}
          className="px-4 py-2 bg-surface-muted hover:bg-surface-muted/80 text-foreground text-sm font-medium rounded-lg transition border border-border"
        >
          Refresh Data
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 text-foreground/50">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p>Loading disaster events...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-16 text-critical">
            <AlertCircle className="h-8 w-8 mb-4" />
            <p>{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-foreground/50">
            <Search className="h-12 w-12 mb-4 text-foreground/20" />
            <h3 className="text-lg font-medium text-foreground">No Events Found</h3>
            <p className="mt-1">There are currently no recorded disaster events in the system.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-surface-muted/50 text-foreground/70 uppercase text-xs font-semibold tracking-wider border-b border-border">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Hazard</th>
                  <th className="px-6 py-4">Severity</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Score</th>
                  <th className="px-6 py-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-surface-muted/20 transition-colors">
                    <td className="px-6 py-4 font-mono text-foreground/50">#{event.id}</td>
                    <td className="px-6 py-4 text-foreground/80">{new Date(event.event_time).toLocaleString()}</td>
                    <td className="px-6 py-4 capitalize font-medium">{event.hazard_type}</td>
                    <td className="px-6 py-4">{getSeverityBadge(event.severity)}</td>
                    <td className="px-6 py-4">{getRecordTypeBadge(event.record_type)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-surface-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${event.risk_score > 0.7 ? "bg-critical" : event.risk_score > 0.4 ? "bg-warning" : "bg-success"}`} 
                            style={{ width: `${Math.min(100, Math.max(0, event.risk_score * 100))}%` }} 
                          />
                        </div>
                        <span className="text-xs text-foreground/60">{(event.risk_score * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-foreground/60 truncate max-w-[200px]" title={event.data_source}>{event.data_source || "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
