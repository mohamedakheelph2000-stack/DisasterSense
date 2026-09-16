import { useState } from "react";
import { X, Navigation, CloudRain, Mountain, AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface SelectedLocationPanelProps {
  data: any;
  onClose: () => void;
  onAssessRisk?: (hazard: "flood" | "landslide") => void;
  onEscalateCluster?: (cluster: any, severity: string, note: string) => Promise<void>;
  userRole?: string;
}

export function SelectedLocationPanel({ data, onClose, onAssessRisk, onEscalateCluster, userRole }: SelectedLocationPanelProps) {
  const [showEscalate, setShowEscalate] = useState(false);
  const [escalateSeverity, setEscalateSeverity] = useState("HIGH");
  const [escalateNote, setEscalateNote] = useState("");
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalateSuccess, setEscalateSuccess] = useState(false);

  if (!data) return null;

  if (data.isCluster) {
    return (
      <Card variant="glass" className="w-80 h-full flex flex-col shadow-2xl rounded-none md:rounded-xl border-l-0 md:border-l">
        <CardHeader className="border-b border-border/50 pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg mb-1 uppercase tracking-wider">{data.hazard_type} CLUSTER</CardTitle>
              <div className="flex items-center space-x-2 text-xs text-foreground/50 font-mono">
                <Navigation className="w-3 h-3" />
                <span>{data.centroid_lat.toFixed(3)}, {data.centroid_lon.toFixed(3)}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-muted text-foreground/50 hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          <div>
            <h4 className="text-xs font-semibold text-foreground/50 uppercase mb-2">Cluster Metrics</h4>
            <div className="flex flex-col space-y-2 bg-surface-muted/30 p-3 rounded-lg border border-white/5">
               <div className="flex justify-between items-center">
                 <span className="text-sm text-foreground/80">Average Risk</span>
                 <span className="font-mono font-bold">{data.average_risk}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-sm text-foreground/80">Max Risk</span>
                 <span className="font-mono text-danger font-semibold">{data.max_risk}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-sm text-foreground/80">Members</span>
                 <span className="font-mono">{data.member_count}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-sm text-foreground/80">Quality</span>
                 <span className="font-mono text-xs text-primary">{data.quality_indicator}</span>
               </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground/50 uppercase mb-2">Temporal Extent</h4>
            <div className="bg-surface-muted/30 p-3 rounded-lg border border-white/5 space-y-2">
               <div className="flex justify-between items-center">
                 <span className="text-sm text-foreground/80">First Seen</span>
                 <span className="font-mono text-xs">{new Date(data.first_timestamp).toLocaleDateString()}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-sm text-foreground/80">Duration</span>
                 <span className="font-mono text-xs">{data.duration_hours}h</span>
               </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground/50 uppercase mb-2">Provenance</h4>
            <div className="bg-surface-muted/30 p-3 rounded-lg border border-white/5 space-y-1">
               {data.provenance && data.provenance.length > 0 ? data.provenance.map((src: string, i: number) => (
                 <div key={i} className="text-xs text-foreground/80 truncate font-mono" title={src}>• {src}</div>
               )) : <div className="text-xs text-foreground/50">Unknown</div>}
            </div>
          </div>
          
          {userRole !== "citizen" && onEscalateCluster && (
            <div className="pt-4 border-t border-white/10">
              {!showEscalate && !escalateSuccess ? (
                <Button 
                  onClick={() => setShowEscalate(true)}
                  className="w-full bg-danger/20 hover:bg-danger/30 text-danger-foreground border border-danger/50 shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all"
                >
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  ESCALATE TO REGIONAL ALERT
                </Button>
              ) : escalateSuccess ? (
                <div className="bg-success/20 border border-success/50 p-3 rounded-lg flex items-center justify-center space-x-2 text-success-foreground">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold text-sm">Escalated Successfully</span>
                </div>
              ) : (
                <div className="bg-surface-muted/50 p-3 rounded-lg border border-danger/30 space-y-3">
                  <h4 className="text-sm font-semibold text-danger flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Operator Decision Required
                  </h4>
                  <p className="text-xs text-foreground/70">
                    This will create an active Regional Alert and notify responders. Ensure this cluster represents a verified situation.
                  </p>
                  
                  {data.record_type?.toLowerCase() === "predictive" && (
                    <div className="bg-warning/10 border border-warning/30 p-2 rounded text-xs text-warning">
                      <strong>Warning:</strong> This is a PREDICTIVE cluster. It does not represent a confirmed disaster. Escalate only with corroborating external evidence.
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    <label className="text-xs text-foreground/60 uppercase">Severity</label>
                    <select 
                      className="w-full bg-surface text-sm p-1.5 rounded border border-white/10 outline-none"
                      value={escalateSeverity}
                      onChange={e => setEscalateSeverity(e.target.value)}
                    >
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MODERATE">Moderate</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs text-foreground/60 uppercase">Operational Note</label>
                    <textarea 
                      className="w-full bg-surface text-sm p-1.5 rounded border border-white/10 outline-none resize-none h-16"
                      placeholder="e.g., Satellite imagery confirms inundation extending..."
                      value={escalateNote}
                      onChange={e => setEscalateNote(e.target.value)}
                    />
                  </div>
                  
                  <div className="flex space-x-2 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 text-xs py-1 h-8"
                      onClick={() => setShowEscalate(false)}
                      disabled={isEscalating}
                    >
                      Cancel
                    </Button>
                    <Button 
                      className="flex-1 text-xs py-1 h-8 bg-danger hover:bg-danger/80 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                      disabled={isEscalating}
                      onClick={async () => {
                        setIsEscalating(true);
                        try {
                          await onEscalateCluster(data, escalateSeverity, escalateNote);
                          setEscalateSuccess(true);
                        } catch (err) {
                          console.error(err);
                          alert("Failed to escalate cluster. See console for details.");
                        } finally {
                          setIsEscalating(false);
                        }
                      }}
                    >
                      {isEscalating ? "Escalating..." : "Confirm"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

        </CardContent>
      </Card>
    );
  }

  if (data.isGridCell) {
    return (
      <Card variant="glass" className="w-80 h-full flex flex-col shadow-2xl rounded-none md:rounded-xl border-l-0 md:border-l">
        <CardHeader className="border-b border-border/50 pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg mb-1 uppercase tracking-wider">{data.hazard_type} GRID CELL</CardTitle>
              <div className="flex items-center space-x-2 text-xs text-foreground/50 font-mono">
                <Navigation className="w-3 h-3" />
                <span>{data.center_lat.toFixed(3)}, {data.center_lon.toFixed(3)}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-muted text-foreground/50 hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          <div>
            <h4 className="text-xs font-semibold text-foreground/50 uppercase mb-2">Aggregated Risk</h4>
            <div className="flex flex-col space-y-2 bg-surface-muted/30 p-3 rounded-lg border border-white/5">
               <div className="flex justify-between items-center">
                 <span className="text-sm text-foreground/80">Average Risk</span>
                 <span className="font-mono font-bold">{data.average_risk}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-sm text-foreground/80">Max Risk</span>
                 <span className="font-mono">{data.max_risk}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-sm text-foreground/80">Assessments</span>
                 <span className="font-mono">{data.assessment_count}</span>
               </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground/50 uppercase mb-2">Provenance</h4>
            <div className="bg-surface-muted/30 p-3 rounded-lg border border-white/5 space-y-1">
               {data.provenance && data.provenance.length > 0 ? data.provenance.map((src: string, i: number) => (
                 <div key={i} className="text-xs text-foreground/80 truncate font-mono" title={src}>• {src}</div>
               )) : <div className="text-xs text-foreground/50">Unknown</div>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isCoordinateOnly = data.isCoordinateOnly;
  const isEvent = !!data.severity && !isCoordinateOnly;
  
  return (
    <Card variant="glass" className="w-80 h-full flex flex-col shadow-2xl rounded-none md:rounded-xl border-l-0 md:border-l">
      <CardHeader className="border-b border-border/50 pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg mb-1 uppercase tracking-wider">{data.location || `${data.type} Risk Zone`}</CardTitle>
            <div className="flex items-center space-x-2 text-xs text-foreground/50 font-mono">
              <Navigation className="w-3 h-3" />
              <span>{data.lat.toFixed(3)}, {data.lng.toFixed(3)}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-surface-muted text-foreground/50 hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        
        <div>
          <h4 className="text-xs font-semibold text-foreground/50 uppercase mb-2">Status</h4>
          <div className="flex items-center justify-between bg-surface-muted/30 p-3 rounded-lg border border-white/5">
             <span className="font-medium text-sm">{isEvent ? 'Disaster Event' : 'Risk Assessment'}</span>
             <Badge variant={
               data.riskLevel === 'Critical' || data.severity === 'critical' ? 'critical' :
               data.riskLevel === 'High' || data.severity === 'high' ? 'danger' :
               data.riskLevel === 'Moderate' || data.severity === 'moderate' ? 'warning' : 'success'
             }>
               {data.riskLevel || data.severity}
             </Badge>
          </div>
        </div>

        {data.record_type && (
          <div>
             <h4 className="text-xs font-semibold text-foreground/50 uppercase mb-2">Provenance</h4>
             <div className="space-y-2 text-sm bg-surface-muted/30 p-3 rounded-lg border border-white/5">
                <div className="flex justify-between items-center">
                   <span className="text-foreground/80">Record Type</span>
                   <Badge variant={data.record_type === 'HISTORICAL' ? 'info' : 'outline'} className={data.record_type === 'HISTORICAL' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : ''}>
                     {data.record_type}
                   </Badge>
                </div>
                {data.data_source && (
                  <div className="flex justify-between items-center pt-1 border-t border-white/5 mt-1">
                     <span className="text-foreground/80">Source</span>
                     <span className="font-mono text-xs text-right max-w-[150px] truncate" title={data.data_source}>{data.data_source}</span>
                  </div>
                )}
                {data.source_reference && (
                  <div className="flex justify-between items-center pt-1 mt-1">
                     <span className="text-foreground/80">Ref</span>
                     <a href={data.source_reference} target="_blank" rel="noreferrer" className="text-info text-xs hover:underline truncate max-w-[150px]">Link</a>
                  </div>
                )}
             </div>
          </div>
        )}

        {!isEvent && !isCoordinateOnly && (
          <div>
             <h4 className="text-xs font-semibold text-foreground/50 uppercase mb-2">Score</h4>
             <div className="text-3xl font-bold font-mono">
                {data.score} <span className="text-sm font-normal text-foreground/50">/100</span>
             </div>
          </div>
        )}

        {!isCoordinateOnly && (
          <div>
             <h4 className="text-xs font-semibold text-foreground/50 uppercase mb-2">Environmental Context</h4>
             <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center bg-surface-muted/30 px-3 py-2 rounded-md">
                   <span className="flex items-center text-foreground/80"><CloudRain className="w-3 h-3 mr-2 text-info"/> Rainfall 24h</span>
                   <span className="font-mono text-warning">142 mm</span> <span className="text-[10px] text-warning bg-warning/20 px-1 rounded ml-1">DEMO</span>
                </div>
                <div className="flex justify-between items-center bg-surface-muted/30 px-3 py-2 rounded-md">
                   <span className="flex items-center text-foreground/80"><Mountain className="w-3 h-3 mr-2 text-accent"/> Avg Slope</span>
                   <span className="font-mono">42°</span>
                </div>
             </div>
          </div>
        )}

        {isCoordinateOnly && (
          <div>
            <h4 className="text-xs font-semibold text-foreground/50 uppercase mb-2">Instructions</h4>
            <p className="text-sm text-foreground/80">Select a hazard type below to run an on-demand predictive risk assessment for this location. Environmental features will be automatically hydrated.</p>
          </div>
        )}

      </CardContent>
      <div className="p-4 border-t border-border/50 bg-surface/50">
        {isCoordinateOnly ? (
          <div className="flex flex-col space-y-2">
            <Button variant="default" className="w-full bg-info hover:bg-info/90 text-white" onClick={() => onAssessRisk?.("flood")}>
              Assess Flood Risk
            </Button>
            <Button variant="default" className="w-full bg-warning hover:bg-warning/90 text-white" onClick={() => onAssessRisk?.("landslide")}>
              Assess Landslide Risk
            </Button>
          </div>
        ) : (
          <>
            <Button variant="default" className="w-full mb-2">Full Assessment</Button>
            {isEvent && <Button variant="outline" className="w-full text-danger border-danger/30 hover:bg-danger/10 hover:text-danger">Dispatch Resources</Button>}
          </>
        )}
      </div>
    </Card>
  );
}
