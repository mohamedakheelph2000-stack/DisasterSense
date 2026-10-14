import { useState } from "react";
import { RiskAssessmentResponse, FeatureImpactResponse } from "@/lib/api/types/risk";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { RiskGauge } from "../risk/risk-gauge";
import { Badge } from "../ui/badge";
import { Database, HelpCircle, Activity, Send, Loader2 } from "lucide-react";

interface AssessmentResultProps {
  result: RiskAssessmentResponse;
}

const FEEDBACK_TYPES: { value: string; label: string }[] = [
  { value: "uncertain", label: "Outcome uncertain" },
  { value: "confirmed_event", label: "Event confirmed" },
  { value: "false_positive", label: "False positive" },
  { value: "false_negative", label: "Missed event" },
  { value: "data_correction", label: "Data correction" },
];

export function AssessmentResult({ result }: AssessmentResultProps) {
  const [outcome, setOutcome] = useState("");
  const [feedbackType, setFeedbackType] = useState("uncertain");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackState, setFeedbackState] = useState<"idle" | "sent" | "error">("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const getSeverityVariant = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical": return "critical";
      case "high": return "danger";
      case "moderate": return "warning";
      default: return "success";
    }
  };

  const severityVariant = getSeverityVariant(result.severity);

  const submitFeedback = async () => {
    if (!outcome.trim()) {
      setFeedbackState("error");
      setFeedbackMessage("Describe what actually happened before submitting.");
      return;
    }
    setSubmitting(true);
    setFeedbackState("idle");
    setFeedbackMessage(null);
    try {
      const { MLGovernanceApi } = await import("@/lib/api/ml-governance");
      await MLGovernanceApi.submitFeedback({
        event_id: result.event_id ?? undefined,
        hazard_type: result.hazard_type,
        feedback_type: feedbackType,
        observed_outcome: outcome.trim(),
        feature_snapshot: result.features_used,
        provenance: "Assessment Result UI Submission",
      });
      setFeedbackState("sent");
      setOutcome("");
      setFeedbackMessage("Feedback queued for reviewer validation. It does not change the deployed model.");
    } catch (err) {
      setFeedbackState("error");
      setFeedbackMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

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
            <p className="mb-1"><strong className="text-foreground/80">Inference source:</strong> <span className="capitalize">{result.inference_source?.replace('_', ' ')}</span></p>
            <p className="mb-1"><strong className="text-foreground/80">Mode:</strong> <span className="capitalize">{result.mode || result.hazard_type}</span> · assessed {new Date(result.assessed_at).toLocaleString()}</p>
            <p className="mb-3">
              Feature contributions below are computed for this single prediction. They explain how the
              model reached this score — they are not a forecast guarantee. Live inputs come from
              Open-Meteo and Open-Elevation telemetry.
            </p>

            <div className="pt-3 border-t border-border/50">
              <p className="mb-2 text-foreground/80 font-medium">Operational Feedback</p>
              <div className="space-y-2">
                <label className="block" htmlFor="assessment-feedback-type">
                  <span className="text-[11px] uppercase text-foreground/50">Classification</span>
                  <select
                    id="assessment-feedback-type"
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                  >
                    {FEEDBACK_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block" htmlFor="assessment-feedback-outcome">
                  <span className="text-[11px] uppercase text-foreground/50">Observed outcome</span>
                  <textarea
                    id="assessment-feedback-outcome"
                    rows={3}
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    placeholder="e.g., Flooding observed on the Kallani bridge approach, 14:20 IST."
                    className="mt-1 w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={submitFeedback}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/20 px-3 py-1.5 text-primary transition-colors hover:bg-primary/30 disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Submit Observation
                  </button>
                </div>
                {feedbackMessage && (
                  <p
                    role={feedbackState === "error" ? "alert" : "status"}
                    className={`text-xs ${feedbackState === "error" ? "text-danger" : "text-success"}`}
                  >
                    {feedbackMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
