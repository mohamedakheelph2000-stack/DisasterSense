import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Download, AlertTriangle } from "lucide-react";
import { MLGovernanceApi, DatasetCandidateSummary } from "@/lib/api/ml-governance";

interface Props {
  candidate: DatasetCandidateSummary;
}

export default function DatasetCandidateExport({ candidate }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const records = await MLGovernanceApi.exportCandidate(candidate.id);
      
      const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${candidate.dataset_version}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Failed to export dataset");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex justify-between items-center">
          <span className="font-mono text-sm">{candidate.dataset_version}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${candidate.hazard_type === 'flood' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
            {candidate.hazard_type}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="grid grid-cols-2 gap-4 text-sm mb-4 flex-1">
          <div className="col-span-2 border-b pb-2 mb-2">
            <p className="text-muted-foreground font-semibold">Inclusion Statistics</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <p className="text-xs text-muted-foreground">Total Included</p>
                <p className="font-semibold text-success">{candidate.included_count}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Excluded</p>
                <p className="font-semibold text-danger">{candidate.excluded_count}</p>
              </div>
              <div className="col-span-2 mt-1 text-xs text-muted-foreground bg-secondary/10 p-2 rounded">
                <p><span className="font-semibold">Leakage (Temporal/Test):</span> {candidate.leakage_count}</p>
                <p><span className="font-semibold">Duplicates (Spatial):</span> {candidate.duplicate_count}</p>
                <p><span className="font-semibold">Unknown Provenance:</span> {candidate.unknown_provenance_count}</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground">Labels</p>
            <p className="font-semibold text-xs">{candidate.positive_samples} pos / {candidate.negative_samples} neg</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <p className="font-semibold">{candidate.status}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Geographic</p>
            <p className="font-semibold truncate">{candidate.geographic_coverage}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Temporal</p>
            <p className="font-semibold truncate">{candidate.temporal_coverage}</p>
          </div>
          <div className="col-span-2">
            <p className="text-muted-foreground">Methodology</p>
            <p className="font-semibold truncate text-xs">{candidate.methodology}</p>
          </div>
          <div className="col-span-2">
            <p className="text-muted-foreground">Features</p>
            <p className="font-mono text-xs text-muted-foreground">{candidate.feature_schema?.join(", ")}</p>
          </div>
        </div>
        
        {error && (
          <p className="text-xs text-destructive mb-4 flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1" /> {error}
          </p>
        )}

        <Button 
          className="w-full mt-auto" 
          onClick={handleExport}
          disabled={isExporting || candidate.record_count === 0}
        >
          <Download className="w-4 h-4 mr-2" />
          {isExporting ? "Exporting..." : "Export JSON"}
        </Button>
      </CardContent>
    </Card>
  );
}
