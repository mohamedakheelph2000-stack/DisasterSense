"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/auth-context";
import { getMLStatus, getMLEvaluation, getMLExperiments } from "@/lib/api/ml";
import { MLStatusResponse, MLHazardEvaluation, MLHazardComparisonResponse } from "@/lib/api/types/ml";
import MLSystemOverview from "@/components/ml/ml-system-overview";
import ModelEvaluationCard from "@/components/ml/model-evaluation-card";
import ConfusionMatrixView from "@/components/ml/confusion-matrix-view";
import FeatureImportanceChart from "@/components/ml/feature-importance-chart";
import AlgorithmComparisonTable from "@/components/ml/algorithm-comparison-table";
import DatasetTransparencyPanel from "@/components/ml/dataset-transparency-panel";
import ModelLimitations from "@/components/ml/model-limitations";

export default function MLIntelligencePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [status, setStatus] = useState<MLStatusResponse | null>(null);
  const [floodEval, setFloodEval] = useState<MLHazardEvaluation | null>(null);
  const [landslideEval, setLandslideEval] = useState<MLHazardEvaluation | null>(null);
  const [floodExp, setFloodExp] = useState<MLHazardComparisonResponse | null>(null);
  const [landslideExp, setLandslideExp] = useState<MLHazardComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role === "citizen") {
      router.push("/");
    }
  }, [user, router]);

  useEffect(() => {
    if (!user || user.role === "citizen") return;
    
    async function fetchData() {
      try {
        const statusData = await getMLStatus();
        setStatus(statusData);

        if (statusData.flood.loaded && statusData.flood.inference_source !== "heuristic") {
          getMLEvaluation("flood").then(setFloodEval).catch(console.error);
          getMLExperiments("flood").then(setFloodExp).catch(console.error);
        }
        if (statusData.landslide.loaded && statusData.landslide.inference_source !== "heuristic") {
          getMLEvaluation("landslide").then(setLandslideEval).catch(console.error);
          getMLExperiments("landslide").then(setLandslideExp).catch(console.error);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load ML intelligence data");
      }
    }
    fetchData();
  }, [user]);

  if (!user || user.role === "citizen") return null;

  return (
    <div className="container mx-auto p-4 space-y-8 mt-16 text-foreground">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">ML Intelligence Center</h1>
        <p className="text-muted-foreground">Technical transparency dashboard for DisasterSense predictive models.</p>
      </div>
      
      {error && (
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="p-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {status && <MLSystemOverview status={status} />}

      {/* FLOOD MODEL SECTION */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">Flood Model Intelligence</h2>
        {floodEval ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="space-y-6">
              <ModelEvaluationCard hazard="flood" evaluation={floodEval} />
              <DatasetTransparencyPanel evaluation={floodEval} />
              {floodEval.limitations && <ModelLimitations limitations={floodEval.limitations} />}
            </div>
            <div className="space-y-6">
              <FeatureImportanceChart featureImportance={floodEval.feature_importance} title="Flood Feature Importance" />
              {floodEval.metrics?.confusion_matrix && (
                <ConfusionMatrixView matrix={floodEval.metrics.confusion_matrix} />
              )}
            </div>
            <div className="space-y-6">
              {floodExp && floodExp.models.length > 0 && (
                <AlgorithmComparisonTable experiments={floodExp} />
              )}
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Detailed evaluation metadata is not available for the currently loaded flood model.
            </CardContent>
          </Card>
        )}
      </section>

      {/* LANDSLIDE MODEL SECTION */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">Landslide Model Intelligence</h2>
        {landslideEval ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="space-y-6">
              <ModelEvaluationCard hazard="landslide" evaluation={landslideEval} />
              <DatasetTransparencyPanel evaluation={landslideEval} />
              {landslideEval.limitations && <ModelLimitations limitations={landslideEval.limitations} />}
            </div>
            <div className="space-y-6">
              <FeatureImportanceChart featureImportance={landslideEval.feature_importance} title="Landslide Feature Importance" />
              {landslideEval.metrics?.confusion_matrix && (
                <ConfusionMatrixView matrix={landslideEval.metrics.confusion_matrix} />
              )}
            </div>
            <div className="space-y-6">
              {landslideExp && landslideExp.models.length > 0 && (
                <AlgorithmComparisonTable experiments={landslideExp} />
              )}
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Detailed evaluation metadata is not available for the currently loaded landslide model.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
