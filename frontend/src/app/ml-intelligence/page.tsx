"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, ForbiddenState, LoadingGrid } from "@/components/ui/states";
import { errorMessage } from "@/lib/api/client";

export default function MLIntelligencePage() {
  const { user } = useAuth();

  const [status, setStatus] = useState<MLStatusResponse | null>(null);
  const [floodEval, setFloodEval] = useState<MLHazardEvaluation | null>(null);
  const [landslideEval, setLandslideEval] = useState<MLHazardEvaluation | null>(null);
  const [floodExp, setFloodExp] = useState<MLHazardComparisonResponse | null>(null);
  const [landslideExp, setLandslideExp] = useState<MLHazardComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partialError, setPartialError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role === "citizen") return;

    async function fetchData() {
      setError(null);
      setPartialError(null);
      try {
        const statusData = await getMLStatus();
        setStatus(statusData);

        const problems: string[] = [];
        const loadHazard = async (hazard: "flood" | "landslide") => {
          const model = statusData[hazard];
          if (!model.loaded || model.inference_source === "heuristic") return;
          try {
            const evaluation = await getMLEvaluation(hazard);
            if (hazard === "flood") setFloodEval(evaluation);
            else setLandslideEval(evaluation);
          } catch (err) {
            problems.push(`${hazard} evaluation: ${errorMessage(err)}`);
          }
          try {
            const experiments = await getMLExperiments(hazard);
            if (hazard === "flood") setFloodExp(experiments);
            else setLandslideExp(experiments);
          } catch (err) {
            problems.push(`${hazard} experiments: ${errorMessage(err)}`);
          }
        };

        await Promise.all([loadHazard("flood"), loadHazard("landslide")]);
        if (problems.length) setPartialError(problems.join(" · "));
      } catch (err) {
        setError(errorMessage(err));
      }
    }
    fetchData();
  }, [user]);

  if (!user || user.role === "citizen") {
    return (
      <AppShell>
        <ForbiddenState message="ML model transparency is available to responder and admin accounts only." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Intelligence"
        title="ML Intelligence Center"
        description="Technical transparency for the deployed flood and landslide models: evaluation metrics, feature attribution, dataset provenance and algorithm comparisons."
      />

      {error ? (
        <div className="mb-6">
          <ErrorState error={new Error(error)} />
        </div>
      ) : null}

      {partialError && !error ? (
        <div className="mb-6">
          <ErrorState error={new Error(partialError)} title="Some model detail is unavailable" />
        </div>
      ) : null}

      {!status && !error ? <LoadingGrid rows={2} className="mb-6" /> : null}

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
              Detailed evaluation metadata is not available for the currently loaded flood model. Run{" "}
              <code className="text-info">ml/src/models/train_real_models.py</code> and restart the backend to publish it.
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
              Detailed evaluation metadata is not available for the currently loaded landslide model. Run{" "}
              <code className="text-info">ml/src/models/train_real_models.py</code> and restart the backend to publish it.
            </CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}
