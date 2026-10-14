"use client";

import { useState, useEffect } from "react";
import { History, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { apiClient, errorMessage } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, EmptyState } from "@/components/ui/states";
import { Reveal } from "@/components/animations/motion";

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

interface EventsResponse {
  items: DisasterEvent[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

const PAGE_SIZE = 25;

export default function DisasterEventsPage() {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hazard, setHazard] = useState("");
  const [severity, setSeverity] = useState("");

  const fetchEvents = async (opts: { page?: number; hazard?: string; severity?: string } = {}) => {
    const targetPage = opts.page ?? page;
    const hazardFilter = opts.hazard ?? hazard;
    const severityFilter = opts.severity ?? severity;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        page_size: String(PAGE_SIZE),
      });
      if (hazardFilter) params.set("hazard_type", hazardFilter);
      if (severityFilter) params.set("severity", severityFilter);
      const data = await apiClient<EventsResponse>(`/disaster-events?${params.toString()}`);
      setEvents(data.items);
      setTotal(data.total);
      setPages(data.pages);
      setPage(data.page);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getRecordTypeBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case "historical":
        return <Badge variant="outline" className="bg-surface-muted text-foreground/80 border-foreground/20">Historical</Badge>;
      case "predictive":
      case "live":
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Predictive (Live)</Badge>;
      case "demo":
        return <Badge variant="outline" className="bg-surface-muted text-foreground/60 border-border">Simulated</Badge>;
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
    <AppShell>
      <PageHeader
        eyebrow="Archive"
        title="Disaster Events"
        description="Chronological record of historical, simulated and live predictive assessments emitted by the risk engine."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="hud-label block">Hazard</span>
              <select
                value={hazard}
                onChange={(e) => {
                  setHazard(e.target.value);
                  fetchEvents({ page: 1, hazard: e.target.value });
                }}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              >
                <option value="">All hazards</option>
                <option value="flood">Flood</option>
                <option value="landslide">Landslide</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="hud-label block">Severity</span>
              <select
                value={severity}
                onChange={(e) => {
                  setSeverity(e.target.value);
                  fetchEvents({ page: 1, severity: e.target.value });
                }}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              >
                <option value="">All severities</option>
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <Button size="sm" variant="outline" onClick={() => fetchEvents({ page: 1 })} disabled={loading}>
              <History className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <Reveal>
        <div className="panel overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
              <p>Loading disaster events…</p>
            </div>
          ) : error ? (
            <ErrorState error={new Error(error)} onRetry={() => fetchEvents({ page: 1 })} />
          ) : events.length === 0 ? (
            <EmptyState
              title="No events found"
              description="No disaster events match the current filter combination."
            />
          ) : (
            <>
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
                        <td className="px-6 py-4 text-foreground/80">
                          {Number.isNaN(Date.parse(event.event_time))
                            ? "—"
                            : new Date(event.event_time).toLocaleString()}
                        </td>
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
                            <span className="text-xs text-foreground/60 tabular-nums">
                              {(event.risk_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-foreground/60 truncate max-w-[200px]" title={event.data_source}>
                          {event.data_source || "System"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
                <p className="text-xs text-muted-foreground">
                  {total.toLocaleString()} event{total === 1 ? "" : "s"} total · page {page} of {Math.max(pages, 1)}
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => fetchEvents({ page: page - 1 })}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={loading || page >= pages} onClick={() => fetchEvents({ page: page + 1 })}>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Reveal>
    </AppShell>
  );
}
