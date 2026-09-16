import { RiskAssessmentResponse, FeatureImpactResponse } from "@/lib/api/types/risk";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { RiskGauge } from "../risk/risk-gauge";
import { Badge } from "../ui/badge";
import { ShieldAlert, Database, HelpCircle, Activity } from "lucide-react";

interface AssessmentResultProps {
  result: RiskAssessmentResponse;
}

export function AssessmentResult({ result }: AssessmentResultProps) {
  
  const getSeverityVariant = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical": return "critical";
      case "high": return "danger";
      case "moderate": return "warning";
      default: return "success";
    }
  };

  const severityVariant = getSeverityVariant(result.severity);

  return (
    <div className="space-y-6">
      
      {/* Main Score Card */}
      <Card variant="glass" className="relative overflow-hidden border-t-4" style={{ borderTopColor: `hsl(var(--${severityVariant}))` }}>
        {result.severity === "critical" && (
           <div className="absolute inset-0 bg-critical/5 mix-blend-overlay animate-pulse pointer-events-none" />
        )}
        <CardContent className="pt-8 pb-6 flex flex-col items-center">
          <RiskGauge score={result.risk_score} size={240} strokeWidth={16} />
          
          <div className="mt-6 text-center">
            <h2 className="text-2xl font-bold tracking-tight mb-2 uppercase">{result.risk_level} RISK</h2>
            <Badge variant={severityVariant} className="uppercase px-3 py-1">
              {result.hazard_type} MODEL
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Feature Impacts */}
      <Card variant="glass">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm uppercase tracking-wider text-foreground/70 flex items-center">
            <Activity className="w-4 h-4 mr-2" />
            Model Influence Factors
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {result.feature_impacts.map((impact: FeatureImpactResponse, idx: number) => {
             const pct = Math.min(100, Math.round(impact.importance * 100));
             const impactColor = impact.impact_level === "high" ? "bg-danger" : impact.impact_level === "moderate" ? "bg-warning" : "bg-info";
             
             return (
               <div key={idx}>
                 <div className="flex justify-between text-sm mb-1">
                   <span className="text-foreground/90 font-medium capitalize">{impact.feature.replace(/_/g, ' ')}</span>
                   <span className="font-mono text-foreground/60">{pct}%</span>
                 </div>
                 <div className="flex items-center space-x-3">
                   <div className="flex-1 h-1.5 bg-surface-muted rounded-full overflow-hidden">
                     <div className={`h-full rounded-full ${impactColor}`} style={{ width: `${pct}%` }} />
                   </div>
                   <span className="text-[10px] uppercase text-foreground/40 w-16 text-right">{impact.impact_level}</span>
                 </div>
               </div>
             );
          })}
        </CardContent>
      </Card>

      {/* Snapshot */}
      <Card variant="glass">
         <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-sm uppercase tracking-wider text-foreground/70 flex items-center">
            <Database className="w-4 h-4 mr-2" />
            Environmental Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
           <div className="grid grid-cols-2 gap-3">
              {Object.entries(result.features_used).slice(0, 4).map(([key, val], i) => (
                <div key={i} className="bg-surface-muted/30 p-2 rounded border border-white/5">
                  <div className="text-[10px] text-foreground/50 uppercase mb-1 truncate">{key}</div>
                  <div className="font-mono text-sm">{val as number}</div>
                </div>
              ))}
           </div>
        </CardContent>
      </Card>

      {/* Disclaimers */}
      <Card variant="glass" className="bg-surface/30">
        <CardContent className="p-4 text-xs text-foreground/60 flex items-start space-x-3">
          <HelpCircle className="w-5 h-5 text-foreground/40 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="mb-1"><strong className="text-foreground/80">Model:</strong> {result.model_name} ({result.model_version})</p>
            {result.dataset_version && (
              <p className="mb-1"><strong className="text-foreground/80">Dataset:</strong> {result.dataset_version}</p>
            )}
            <p className="mb-2"><strong className="text-foreground/80">Inference Source:</strong> <span className="capitalize">{result.inference_source?.replace('_', ' ')}</span></p>
            <p className="mb-3">This assessment is generated by a research model for demonstration purposes. Do not use for actual emergency planning.</p>
            
            <div className="pt-3 border-t border-border/50">
              <p className="mb-2 text-foreground/80 font-medium">Operational Feedback</p>
              <div className="flex space-x-2">
                <button 
                  onClick={() => {
                    const outcome = prompt("Provide outcome details (e.g., 'Flooding occurred', 'False alarm'):");
                    if (outcome) {
                      import("@/lib/api/ml-governance").then((m) => {
                        m.MLGovernanceApi.submitFeedback({
                          event_id: result.event_id,
                          hazard_type: result.hazard_type,
                          feedback_type: "uncertain", // Requires review to become confirmed
                          observed_outcome: outcome,
                          feature_snapshot: result.features_used,
                          provenance: "Assessment Result UI Submission",
                        }).then(() => alert("Feedback submitted for review."))
                        .catch(err => alert("Error: " + err.message));
                      });
                    }
                  }}
                  className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-md transition-colors"
                >
                  Submit Observation
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
