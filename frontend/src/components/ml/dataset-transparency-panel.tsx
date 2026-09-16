import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MLHazardEvaluation } from "@/lib/api/types/ml";
import { Database, FileDigit, CalendarDays, MapPin } from "lucide-react";

export default function DatasetTransparencyPanel({ evaluation }: { evaluation: MLHazardEvaluation }) {
  if (!evaluation) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dataset Transparency</CardTitle>
        <p className="text-sm text-muted-foreground">Information about the training & evaluation data</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <Database className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Dataset Version</p>
              <p className="text-sm text-muted-foreground">{evaluation.dataset_version || "Unknown"}</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <FileDigit className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Evaluation Set Size</p>
              <p className="text-sm text-muted-foreground">
                {evaluation.metrics?.dataset_size 
                  ? `${evaluation.metrics.dataset_size} records` 
                  : "Unknown"}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Geographic Scope</p>
              <p className="text-sm text-muted-foreground">Wayanad District, Kerala</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <CalendarDays className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Temporal Coverage</p>
              <p className="text-sm text-muted-foreground">Recent historical events</p>
            </div>
          </div>
          
          {evaluation.dataset_version === "real-v1" && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                Note on Dataset Size
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                The real-v1 dataset is extremely small (academic prototype). Derived negatives are used and are not strictly equivalent to confirmed non-disaster observations. High metrics on this dataset do not guarantee production-level accuracy in the real world.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
