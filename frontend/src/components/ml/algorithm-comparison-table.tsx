import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MLHazardComparisonResponse } from "@/lib/api/types/ml";
import { Badge } from "@/components/ui/badge";

export default function AlgorithmComparisonTable({ experiments }: { experiments: MLHazardComparisonResponse }) {
  if (!experiments || experiments.models.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>F1 on recorded evaluation split</CardTitle>
        <p className="text-sm text-muted-foreground">Evaluated alternatives during model selection (Not an absolute ranking of model quality)</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-secondary/20">
              <tr>
                <th className="px-4 py-3 font-medium">Algorithm</th>
                <th className="px-4 py-3 font-medium text-right">F1 Score</th>
                <th className="px-4 py-3 font-medium text-right">Accuracy</th>
                <th className="px-4 py-3 font-medium text-right">Precision</th>
                <th className="px-4 py-3 font-medium text-right">Recall</th>
                <th className="px-4 py-3 font-medium text-right">ROC-AUC</th>
              </tr>
            </thead>
            <tbody>
              {experiments.models.map((m, idx) => (
                <tr key={idx} className={`border-b last:border-0 ${m.is_best_model ? "bg-primary/5 font-medium" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <span>{m.model_name}</span>
                      {m.is_best_model ? (
                        <Badge variant="default" className="text-[10px] h-5 px-1.5 bg-primary text-primary-foreground">SELECTED / INTEGRATED</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground">EVALUATED ALTERNATIVE</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{(m.metrics.f1_score * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right">{(m.metrics.accuracy * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right">{(m.metrics.precision * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right">{(m.metrics.recall * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right">{(m.metrics.roc_auc * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
