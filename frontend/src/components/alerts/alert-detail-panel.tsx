import { AlertRead, AlertAuditRead } from "@/lib/api/types/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, ShieldAlert, CheckCircle2, X, Activity, BookOpen, AlertTriangle, Loader2, Phone, Navigation } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { apiClient, errorMessage, ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { getSafetyGuidance, HazardType, SeverityLevel } from "@/lib/playbooks";
import { parseSeverityFromTitle } from "@/lib/api/adapters";
import { resourcesApi, EmergencyResource } from "@/lib/api/resources";

interface DisasterEventLite {
  id: number;
  location_id: number;
  hazard_type: string;
  severity: string;
  record_type: string;
  risk_score: number;
  data_source?: string | null;
  event_time: string;
}

interface LocationLite {
  id: number;
  name: string;
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  district?: string | null;
  state?: string | null;
}

interface AlertDetailPanelProps {
  alert: AlertRead | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: () => void;
}

const RESOURCE_TYPES: Record<string, string> = {
  shelter: "Shelter",
  hospital: "Hospital",
  fire_station: "Fire station",
  police_station: "Police station",
  relief_center: "Relief centre",
  other_emergency_resource: "Emergency resource",
};

function hazardFromTitle(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes("landslide") || t.includes("mudslide")) return "landslide";
  if (t.includes("flood") || t.includes("rain") || t.includes("cyclone")) return "flood";
  return null;
}

export function AlertDetailPanel({ alert, open, onClose, onStatusChange }: AlertDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const { user } = useAuth();

  const [detail, setDetail] = useState<AlertRead | null>(null);
  const [event, setEvent] = useState<DisasterEventLite | null>(null);
  const [location, setLocation] = useState<LocationLite | null>(null);
  const [resources, setResources] = useState<EmergencyResource[]>([]);
  const [resourcesNote, setResourcesNote] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);

  const loadDetail = useCallback(async (alertId: number, eventId: number, locationId: number) => {
    setEnriching(true);
    setActionError(null);

    const [alertResult, eventResult, locationResult] = await Promise.allSettled([
      apiClient<AlertRead>(`/alerts/${alertId}`),
      apiClient<DisasterEventLite>(`/disaster-events/${eventId}`),
      apiClient<LocationLite>(`/locations/${locationId}`),
    ]);

    if (alertResult.status === "fulfilled") setDetail(alertResult.value);
    if (eventResult.status === "fulfilled") setEvent(eventResult.value);
    if (locationResult.status === "fulfilled") setLocation(locationResult.value);

    const loc = locationResult.status === "fulfilled" ? locationResult.value : null;
    if (loc && typeof loc.latitude === "number" && typeof loc.longitude === "number") {
      try {
        const res = await resourcesApi.getResources({
          latitude: loc.latitude,
          longitude: loc.longitude,
          radius_km: 30,
          limit: 6,
        });
        setResources(res.items);
        setResourcesNote(res.items.length ? null : "No verified emergency resources are registered within 30 km.");
      } catch (err) {
        setResources([]);
        setResourcesNote(errorMessage(err));
      }
    } else {
      setResources([]);
      setResourcesNote("Location coordinates are unknown, so proximity search is unavailable.");
    }

    const failures: string[] = [];
    if (alertResult.status === "rejected") failures.push(`alert: ${errorMessage(alertResult.reason)}`);
    if (eventResult.status === "rejected") failures.push(`event: ${errorMessage(eventResult.reason)}`);
    if (locationResult.status === "rejected") failures.push(`location: ${errorMessage(locationResult.reason)}`);
    if (failures.length) setActionError(`Could not enrich this alert — ${failures.join(" · ")}`);

    setEnriching(false);
  }, []);

  useEffect(() => {
    if (!open || !alert) return;
    setDetail(null);
    setEvent(null);
    setLocation(null);
    setResources([]);
    setResourcesNote(null);
    loadDetail(alert.id, alert.disaster_event_id, alert.location_id);
  }, [open, alert, loadDetail]);

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!alert) return null;

  const effective = detail ?? alert;
  const severity = ((event?.severity) || effective.severity || parseSeverityFromTitle(alert.title) || "moderate") as SeverityLevel;
  const hazardType = ((event?.hazard_type) || alert.cluster_metadata?.hazard_type || hazardFromTitle(alert.title) || "unknown") as HazardType;
  const recordType = event?.record_type || alert.cluster_metadata?.record_type;
  const isPredictive = recordType === "predictive";

  const locationName = location
    ? [location.name, location.district, location.state].filter(Boolean).join(", ")
    : `Location ID: ${alert.location_id}`;
  const coordinates =
    location && typeof location.latitude === "number" && typeof location.longitude === "number"
      ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
      : null;

  const isResponder = user?.role === "responder" || user?.role === "admin";

  const handleAction = async (action: "acknowledge" | "respond" | "resolve" | "notes") => {
    setLoading(true);
    setActionError(null);
    try {
      const options: RequestInit = { method: "POST", headers: { "Content-Type": "application/json" } };

      let body: Record<string, unknown> = {};
      if (action === "acknowledge") {
        body = { acknowledged_by: user?.full_name || user?.email || "operator" };
      } else if (action === "respond" || action === "notes") {
        body = { actor: user?.email || "operator", note: note || "No note provided." };
      }

      if (Object.keys(body).length > 0) {
        options.body = JSON.stringify(body);
      } else {
        delete options.headers;
      }

      const updated = await apiClient<AlertRead>(`/alerts/${alert.id}/${action}`, options);
      setDetail(updated);
      setNote("");
      onStatusChange();
      if (action === "resolve") {
        onClose();
      }
    } catch (err) {
      if (err instanceof ApiError && err.isForbidden) {
        setActionError("Your account does not have permission to perform alert actions. A responder or admin role is required.");
      } else if (err instanceof ApiError && err.isUnauthorized) {
        setActionError("Your session has expired. Sign in again to continue.");
      } else {
        setActionError(errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (sev: string) => {
    switch(sev) {
      case "critical": return "text-critical";
      case "high": return "text-danger";
      case "moderate": return "text-warning";
      default: return "text-info";
    }
  };

  const guidance = getSafetyGuidance(hazardType, severity);
  const auditLogs: AlertAuditRead[] = effective.audit_logs || [];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-surface/95 backdrop-blur-xl border-l border-border flex flex-col shadow-2xl"
          >
            <button
              onClick={onClose}
              aria-label="Close alert detail"
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className={`p-6 border-b-4 ${
              severity === 'critical' ? 'border-critical' :
              severity === 'high' ? 'border-danger' :
              severity === 'moderate' ? 'border-warning' : 'border-info'
            }`}>
              <div className="text-left space-y-4 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={severity as any} className="uppercase">{severity} PRIORITY</Badge>
                  <Badge variant="outline" className="uppercase opacity-70">{effective.status.replace(/_/g, ' ')}</Badge>
                  {isPredictive && <Badge variant="outline" className="text-purple-400 border-purple-500/50">PREDICTIVE</Badge>}
                  {enriching && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> enriching
                    </span>
                  )}
                </div>

                <h2 className={`text-2xl font-bold tracking-tight ${getSeverityColor(severity)}`}>
                  {effective.title}
                </h2>

                <p className="text-foreground/70 text-base">
                  {effective.message}
                </p>
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
              {actionError ? (
                <div role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs font-mono text-danger">
                  {actionError}
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-sm">
                    <MapPin className="w-4 h-4 text-foreground/50" />
                    <span className="text-foreground/80 font-medium">Location:</span>
                    <span className="text-foreground">{locationName}</span>
                </div>
                {coordinates && (
                  <div className="flex items-center space-x-3 text-sm">
                    <Navigation className="w-4 h-4 text-foreground/50" />
                    <span className="text-foreground/80 font-medium">Coordinates:</span>
                    <span className="text-foreground font-mono text-xs">{coordinates}</span>
                  </div>
                )}
                <div className="flex items-center space-x-3 text-sm">
                    <ShieldAlert className="w-4 h-4 text-foreground/50" />
                    <span className="text-foreground/80 font-medium">Hazard Type:</span>
                    <span className="text-foreground capitalize">{hazardType}</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                    <Clock className="w-4 h-4 text-foreground/50" />
                    <span className="text-foreground/80 font-medium">Issued:</span>
                    <span className="text-foreground">{new Date(effective.created_at).toLocaleString()}</span>
                </div>
                {event && (
                  <div className="flex items-center space-x-3 text-sm">
                    <Activity className="w-4 h-4 text-foreground/50" />
                    <span className="text-foreground/80 font-medium">Risk score:</span>
                    <span className="text-foreground tabular-nums">{(event.risk_score * 100).toFixed(0)}%</span>
                    <span className="text-muted-foreground">· event #{event.id}</span>
                  </div>
                )}
              </div>

              {/* Cluster Metadata (if escalated) */}
              {alert.source_cluster_id && alert.cluster_metadata && (
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/20 space-y-3">
                  <h4 className="font-semibold text-primary/90 uppercase text-xs tracking-wider flex items-center">
                    <Activity className="w-4 h-4 mr-2" /> SOURCE CLUSTER DATA
                  </h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground/70">Cluster ID</span>
                      <span className="font-mono text-xs">{String(alert.source_cluster_id).replace('cluster_', '')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground/70">Member Count</span>
                      <span className="font-mono">{alert.cluster_metadata.member_count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground/70">Average Risk</span>
                      <span className="font-mono">{alert.cluster_metadata.average_risk}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground/70">First Seen</span>
                      <span className="font-mono text-xs">{new Date(alert.cluster_metadata.first_seen).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Safety Guidance Playbook */}
              <div className="p-4 bg-surface-muted/30 rounded-lg border border-border space-y-3">
                <h4 className="font-semibold text-foreground/70 uppercase text-xs tracking-wider flex items-center">
                  <BookOpen className="w-4 h-4 mr-2 text-info" /> SAFETY GUIDANCE
                </h4>
                <ul className="list-disc pl-5 text-sm space-y-1 text-foreground/80">
                  {guidance.map((g, idx) => (
                    <li key={idx}>{g}</li>
                  ))}
                </ul>
                <div className="text-[10px] text-foreground/50 italic border-t border-border/30 pt-2 mt-2">
                  * Note: These are general safety guidelines. Always follow official local authority instructions.
                </div>
              </div>

              {/* Emergency Resource Data */}
              <div className={`p-4 rounded-lg space-y-2 border ${resources.length ? "bg-success/5 border-success/20" : "bg-danger/10 border-danger/20"}`}>
                 <h4 className={`font-semibold text-xs uppercase flex items-center ${resources.length ? "text-success" : "text-danger"}`}>
                   <AlertTriangle className="w-4 h-4 mr-2" /> Emergency Resources
                 </h4>
                 {resources.length ? (
                   <ul className="space-y-1.5">
                     {resources.map((r) => (
                       <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
                         <span className="text-foreground/90">
                           {r.name}
                           <span className="block text-[11px] text-muted-foreground capitalize">
                             {RESOURCE_TYPES[r.resource_type] ?? r.resource_type}
                             {r.address ? ` · ${r.address}` : ""}
                           </span>
                         </span>
                         <span className="shrink-0 flex flex-col items-end gap-1">
                           {typeof r.distance_km === "number" && (
                             <span className="font-mono text-xs text-muted-foreground tabular-nums">{r.distance_km.toFixed(1)} km</span>
                           )}
                           {r.contact_info && (
                             <span className="inline-flex items-center gap-1 font-mono text-xs text-info">
                               <Phone className="h-3 w-3" /> {r.contact_info}
                             </span>
                           )}
                         </span>
                       </li>
                     ))}
                   </ul>
                 ) : (
                   <p className="text-sm text-danger/80">
                     {resourcesNote ?? "Emergency resource data (shelters, hospitals) unavailable. To integrate, an authoritative dataset must be supplied by the local disaster management authority."}
                   </p>
                 )}
              </div>

              {/* Audit Trail */}
              {auditLogs.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground/70 uppercase text-xs tracking-wider">Audit Trail</h4>
                  <div className="space-y-3 pl-2 border-l-2 border-border/50">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="relative pl-4">
                        <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-primary" />
                        <div className="text-xs text-foreground/50">{new Date(log.timestamp).toLocaleString()} • {log.actor}</div>
                        <div className="text-sm font-medium">{log.action.replace(/_/g, ' ')}</div>
                        {log.note && <div className="text-sm text-foreground/70 italic mt-1">&quot;{log.note}&quot;</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Actions Footer */}
            {isResponder && effective.status !== "resolved" && effective.status !== "dismissed" && (
              <div className="p-6 border-t border-border bg-background/50 flex flex-col space-y-3">
                {effective.status === "response_in_progress" && (
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Add an audit note..."
                      className="flex-1 bg-surface border border-input rounded-md px-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <Button variant="outline" disabled={loading || note.trim().length < 5} onClick={() => handleAction("notes")}>
                      Save Note
                    </Button>
                  </div>
                )}

                <div className="flex space-x-3">
                  {effective.status === "active" && (
                      <Button
                        className="flex-1"
                        variant="default"
                        disabled={loading}
                        onClick={() => handleAction("acknowledge")}
                      >
                        Acknowledge
                      </Button>
                  )}
                  {effective.status === "acknowledged" && (
                      <Button
                        className="flex-1 bg-warning hover:bg-warning/90 text-background"
                        disabled={loading}
                        onClick={() => handleAction("respond")}
                      >
                        Begin Response
                      </Button>
                  )}
                  {(effective.status === "active" || effective.status === "acknowledged" || effective.status === "response_in_progress") && (
                      <Button
                        className="flex-1 bg-success/20 text-success hover:bg-success/30 border border-success/30"
                        variant="outline"
                        disabled={loading}
                        onClick={() => handleAction("resolve")}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Resolve
                      </Button>
                  )}
                </div>
                {loading && (
                  <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Applying action…
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
