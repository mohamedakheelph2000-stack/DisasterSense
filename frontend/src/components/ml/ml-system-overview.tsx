import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MLStatusResponse, MLModelSummary } from "@/lib/api/types/ml";

function ModelStatus({ summary }: { summary: MLModelSummary }) {
  if (!summary.loaded) {
    return <span className="text-destructive font-semibold">Offline</span>;
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <span className="font-semibold text-lg">{summary.model_name || "Unknown"}</span>
        <Badge variant={summary.is_real ? "default" : "outline"} className={summary.is_real ? "bg-primary text-primary-foreground" : ""}>
          {summary.is_real ? "Real Model" : summary.inference_source === "synthetic_model" ? "Synthetic Baseline" : "Heuristic Fallback"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <div>Version: <span className="font-mono text-foreground">{summary.model_version || "N/A"}</span></div>
        <div>Dataset: <span className="font-mono text-foreground">{summary.dataset_version || "N/A"}</span></div>
        <div>Features: <span className="font-mono text-foreground">{summary.feature_count || "N/A"}</span></div>
        <div>Source: <span className="font-mono text-foreground">{summary.inference_source || "N/A"}</span></div>
      </div>
    </div>
  );
}

export default function MLSystemOverview({ status }: { status: MLStatusResponse }) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle>ML System Overview</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 rounded-lg bg-secondary/20 border">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Flood Risk Engine</h3>
          <ModelStatus summary={status.flood} />
        </div>
        <div className="p-4 rounded-lg bg-secondary/20 border">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Landslide Risk Engine</h3>
          <ModelStatus summary={status.landslide} />
        </div>
      </CardContent>
    </Card>
  );
}
