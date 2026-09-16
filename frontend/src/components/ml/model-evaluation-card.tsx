import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MLHazardEvaluation } from "@/lib/api/types/ml";

export default function ModelEvaluationCard({ hazard, evaluation }: { hazard: string; evaluation: MLHazardEvaluation }) {
  const metrics = evaluation.metrics;
  if (!metrics) return null;

  const MetricBox = ({ label, value }: { label: string, value: number }) => (
    <div className="flex flex-col items-center justify-center p-4 bg-background border rounded-lg shadow-sm">
      <span className="text-sm text-muted-foreground uppercase tracking-wide mb-1">{label}</span>
      <span className="text-2xl font-bold text-primary">{(value * 100).toFixed(1)}%</span>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evaluation Metrics</CardTitle>
        <p className="text-sm text-muted-foreground">
          Evaluation on <span className="font-mono">{evaluation.dataset_version}</span> dataset
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricBox label="Accuracy" value={metrics.accuracy} />
          <MetricBox label="Precision" value={metrics.precision} />
          <MetricBox label="Recall" value={metrics.recall} />
          <MetricBox label="F1 Score" value={metrics.f1_score} />
          <MetricBox label="ROC-AUC" value={metrics.roc_auc} />
        </div>
      </CardContent>
    </Card>
  );
}
