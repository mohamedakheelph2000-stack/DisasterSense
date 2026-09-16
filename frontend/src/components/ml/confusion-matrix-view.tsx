import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MLConfusionMatrix } from "@/lib/api/types/ml";

export default function ConfusionMatrixView({ matrix }: { matrix: MLConfusionMatrix }) {
  if (!matrix || !matrix.matrix || matrix.matrix.length !== 2) return null;

  const [[tn, fp], [fn, tp]] = matrix.matrix;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confusion Matrix</CardTitle>
        <p className="text-sm text-muted-foreground">Actual vs. Predicted class distribution on evaluation split</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center max-w-sm mx-auto">
          {/* Header Row */}
          <div className="grid grid-cols-3 w-full text-center text-sm font-medium text-muted-foreground mb-2">
            <div></div>
            <div>Pred Neg</div>
            <div>Pred Pos</div>
          </div>
          
          {/* Actual Negative Row */}
          <div className="grid grid-cols-3 w-full mb-2">
            <div className="flex items-center justify-end pr-4 text-sm font-medium text-muted-foreground">Act Neg</div>
            <div className="bg-green-500/20 text-green-700 dark:text-green-400 p-4 border rounded-l text-center">
              <div className="text-2xl font-bold">{tn}</div>
              <div className="text-xs">True Neg</div>
            </div>
            <div className="bg-red-500/20 text-red-700 dark:text-red-400 p-4 border rounded-r text-center">
              <div className="text-2xl font-bold">{fp}</div>
              <div className="text-xs">False Pos</div>
            </div>
          </div>

          {/* Actual Positive Row */}
          <div className="grid grid-cols-3 w-full">
            <div className="flex items-center justify-end pr-4 text-sm font-medium text-muted-foreground">Act Pos</div>
            <div className="bg-red-500/20 text-red-700 dark:text-red-400 p-4 border rounded-l text-center">
              <div className="text-2xl font-bold">{fn}</div>
              <div className="text-xs">False Neg</div>
            </div>
            <div className="bg-green-500/20 text-green-700 dark:text-green-400 p-4 border rounded-r text-center">
              <div className="text-2xl font-bold">{tp}</div>
              <div className="text-xs">True Pos</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
