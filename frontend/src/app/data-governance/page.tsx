"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { MLGovernanceApi, FeedbackResponse, DatasetCandidateSummary } from "@/lib/api/ml-governance";
import { getMLStatus } from "@/lib/api/ml";
import { MLStatusResponse } from "@/lib/api/types/ml";
import FeedbackTable from "@/components/ml/data-governance/feedback-table";
import DatasetCandidateExport from "@/components/ml/data-governance/dataset-candidate-export";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, ForbiddenState, LoadingGrid } from "@/components/ui/states";
import { errorMessage } from "@/lib/api/client";
import { Database, Inbox, CheckCircle, XCircle, RefreshCw } from "lucide-react";

export default function DataGovernancePage() {
  const { user } = useAuth();

  const [feedbacks, setFeedbacks] = useState<FeedbackResponse[]>([]);
  const [candidates, setCandidates] = useState<DatasetCandidateSummary[]>([]);
  const [mlStatus, setMlStatus] = useState<MLStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchData = async (opts: { showLoading?: boolean } = {}) => {
    if (opts.showLoading !== false) setLoading(true);
    setError(null);
    try {
      const [fbData, candData] = await Promise.all([
        MLGovernanceApi.listFeedback(),
        MLGovernanceApi.getCandidates(),
      ]);
      setFeedbacks(fbData);
      setCandidates(candData);

      try {
        setMlStatus(await getMLStatus());
      } catch {
        setMlStatus(null);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      if (opts.showLoading !== false) setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleGenerate = async (hazardType: string) => {
    if (!confirm(`Are you sure you want to generate a new explicit candidate dataset for ${hazardType}?`)) return;

    setIsGenerating(true);
    setError(null);
    try {
      await MLGovernanceApi.generateCandidate(hazardType);
      await fetchData({ showLoading: false });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <AppShell>
        <ForbiddenState message="ML data governance is restricted to administrator accounts." />
      </AppShell>
    );
  }

  const pendingCount = feedbacks.filter((f) => f.review_status === "submitted" || f.review_status === "under_review").length;
  const approvedCount = feedbacks.filter((f) => f.review_status === "approved_ground_truth").length;
  const rejectedCount = feedbacks.filter((f) => f.review_status === "rejected").length;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Governance"
        title="ML Data Governance"
        description="Administrator console for validating field feedback as ground truth and curating offline training-dataset candidates."
        actions={
          <Button size="sm" variant="outline" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      {error ? <ErrorState error={new Error(error)} onRetry={() => fetchData()} /> : null}

      {loading && !error ? <LoadingGrid rows={2} /> : null}

      <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <Database className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">DEPLOYED MODEL</p>
              <p className="text-lg font-bold text-success uppercase">
                {mlStatus?.flood.model_version || mlStatus?.landslide.model_version || "unknown"}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <Inbox className="w-8 h-8 text-warning" />
            <div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-lg font-bold">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <CheckCircle className="w-8 h-8 text-success" />
            <div>
              <p className="text-sm text-muted-foreground">Ground Truth (Approved)</p>
              <p className="text-lg font-bold">{approvedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <XCircle className="w-8 h-8 text-danger" />
            <div>
              <p className="text-sm text-muted-foreground">Rejected / Invalid</p>
              <p className="text-lg font-bold">{rejectedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-4 bg-primary/10 border border-primary/20 rounded-md shadow-sm">
        <p className="text-sm font-bold text-primary uppercase">🛡️ Deployed Model Immutability Enforced</p>
        <p className="text-sm text-foreground mt-1">
          Reviewing and approving feedback does <strong>NOT</strong> automatically retrain or deploy models. 
          Ground truth is curated here to generate <strong>offline dataset candidates</strong>.           Your production <code>real-v1</code> deployment is completely unaffected by this workflow.
        </p>
        <p className="text-sm font-semibold text-danger mt-2">Candidate data does not affect deployed predictions.</p>
      </div>

      {/* Dataset Candidates */}
      <section className="space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="text-2xl font-semibold">Dataset Candidates</h2>
          <div className="flex space-x-2">
            <Button size="sm" variant="outline" onClick={() => handleGenerate('flood')} disabled={isGenerating}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Generate Flood Candidate
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleGenerate('landslide')} disabled={isGenerating}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Generate Landslide Candidate
            </Button>
          </div>
        </div>
        
        {candidates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {candidates.map((cand) => (
              <DatasetCandidateExport key={cand.id} candidate={cand} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No explicitly generated dataset candidates. Click &quot;Generate&quot; to curate a new candidate from approved ground truth.
            </CardContent>
          </Card>
        )}
      </section>

      {/* Feedback Queue */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">Data Lineage & Review Queue</h2>
        <FeedbackTable feedbacks={feedbacks} onRefresh={fetchData} currentUserId={user.id} />
      </section>
      </div>
    </AppShell>
  );
}
