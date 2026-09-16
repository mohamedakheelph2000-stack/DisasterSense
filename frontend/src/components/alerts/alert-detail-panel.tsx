import { AlertRead } from "@/lib/api/types/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, ShieldAlert, CheckCircle2, X, Activity, BookOpen, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { getSafetyGuidance, HazardType, SeverityLevel } from "@/lib/playbooks";

interface AlertDetailPanelProps {
  alert: (AlertRead & { __mock_meta?: any }) | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: () => void;
}

export function AlertDetailPanel({ alert, open, onClose, onStatusChange }: AlertDetailPanelProps) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const { user } = useAuth();

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!alert) return null;

  const severity = (alert.severity || alert.__mock_meta?.severity || "info") as SeverityLevel;
  const hazardType = (alert.cluster_metadata?.hazard_type || alert.__mock_meta?.hazard_type || "unknown") as HazardType;
  const locationName = alert.__mock_meta?.location || `Location ID: ${alert.location_id}`;
  const isPredictive = (alert.cluster_metadata?.record_type || alert.__mock_meta?.record_type) === "predictive";

  const isResponder = user?.role === "responder" || user?.role === "admin";

  const handleAction = async (action: "acknowledge" | "respond" | "resolve" | "notes") => {
    setLoading(true);
    try {
      const options: RequestInit = { method: "POST" };
      options.headers = { "Content-Type": "application/json" };
      
      let body: any = {};
      if (action === "acknowledge") {
        body = { acknowledged_by: user?.full_name || "operator" };
      } else if (action === "respond" || action === "notes") {
        body = { actor: user?.email || "operator", note: note || "No note provided." };
      }

      if (Object.keys(body).length > 0) {
        options.body = JSON.stringify(body);
      } else {
        // Remove empty body for resolve if it doesn't need one
        delete options.headers;
      }
      
      await apiClient(`/alerts/${alert.id}/${action}`, options);
      setNote(""); // clear note on success
      onStatusChange();
      // Only close if it's a resolving action
      if (action === "resolve") {
         onClose();
      }
    } catch (err) {
      console.error(err);
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
  const auditLogs = alert.audit_logs || [];

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
            className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-surface/95 backdrop-blur-xl border-l border-white/10 flex flex-col shadow-2xl"
          >
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className={`p-6 border-b-4 ${
              severity === 'critical' ? 'border-critical' : 
              severity === 'high' ? 'border-danger' : 
              severity === 'moderate' ? 'border-warning' : 'border-info'
            }`}>
              <div className="text-left space-y-4 pt-4">
                <div className="flex items-center space-x-3">
                  <Badge variant={severity as any} className="uppercase">{severity} PRIORITY</Badge>
                  <Badge variant="outline" className="uppercase opacity-70">{alert.status.replace(/_/g, ' ')}</Badge>
                  {isPredictive && <Badge variant="outline" className="text-purple-400 border-purple-500/50">PREDICTIVE</Badge>}
                </div>
                
                <h2 className={`text-2xl font-bold tracking-tight ${getSeverityColor(severity)}`}>
                  {alert.title}
                </h2>
                
                <p className="text-foreground/70 text-base">
                  {alert.message}
                </p>
              </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-sm">
                    <MapPin className="w-4 h-4 text-foreground/50" />
                    <span className="text-foreground/80 font-medium">Location:</span>
                    <span className="text-foreground">{locationName}</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                    <ShieldAlert className="w-4 h-4 text-foreground/50" />
                    <span className="text-foreground/80 font-medium">Hazard Type:</span>
                    <span className="text-foreground capitalize">{hazardType}</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                    <Clock className="w-4 h-4 text-foreground/50" />
                    <span className="text-foreground/80 font-medium">Issued:</span>
                    <span className="text-foreground">{new Date(alert.created_at).toLocaleString()}</span>
                </div>
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
                      <span className="font-mono text-xs">{alert.source_cluster_id.replace('cluster_', '')}</span>
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
              <div className="p-4 bg-surface-muted/30 rounded-lg border border-white/5 space-y-3">
                <h4 className="font-semibold text-foreground/70 uppercase text-xs tracking-wider flex items-center">
                  <BookOpen className="w-4 h-4 mr-2 text-info" /> GENERAL SAFETY GUIDANCE
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
              <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg space-y-2">
                 <h4 className="font-semibold text-danger text-xs uppercase flex items-center">
                   <AlertTriangle className="w-4 h-4 mr-2" /> Emergency Resources
                 </h4>
                 <p className="text-sm text-danger/80">
                   Emergency resource data (shelters, hospitals) unavailable. To integrate, an authoritative dataset must be supplied by the local disaster management authority.
                 </p>
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
            {isResponder && alert.status !== "resolved" && alert.status !== "dismissed" && (
              <div className="p-6 border-t border-white/10 bg-background/50 flex flex-col space-y-3">
                {alert.status === "response_in_progress" && (
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      placeholder="Add an audit note..." 
                      className="flex-1 bg-surface border border-border/50 rounded-md px-3 text-sm focus:outline-none focus:border-primary"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <Button variant="outline" disabled={loading || note.trim().length < 5} onClick={() => handleAction("notes")}>
                      Save Note
                    </Button>
                  </div>
                )}

                <div className="flex space-x-3">
                  {alert.status === "active" && (
                      <Button 
                        className="flex-1" 
                        variant="default" 
                        disabled={loading} 
                        onClick={() => handleAction("acknowledge")}
                      >
                        Acknowledge
                      </Button>
                  )}
                  {alert.status === "acknowledged" && (
                      <Button 
                        className="flex-1 bg-warning hover:bg-warning/90 text-background" 
                        disabled={loading} 
                        onClick={() => handleAction("respond")}
                      >
                        Begin Response
                      </Button>
                  )}
                  {(alert.status === "active" || alert.status === "acknowledged" || alert.status === "response_in_progress") && (
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
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
