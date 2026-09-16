"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { MLGovernanceApi, FeedbackResponse, DatasetCandidateSummary } from "@/lib/api/ml-governance";
import FeedbackTable from "@/components/ml/data-governance/feedback-table";
import DatasetCandidateExport from "@/components/ml/data-governance/dataset-candidate-export";
import { Database, Inbox, CheckCircle, XCircle, RefreshCw } from "lucide-react";

export default function DataGovernancePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [feedbacks, setFeedbacks] = useState<FeedbackResponse[]>([]);
  const [candidates, setCandidates] = useState<DatasetCandidateSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/");
    }
  }, [user, router]);

  const fetchData = async () => {
    try {
      const fbData = await MLGovernanceApi.listFeedback();
      setFeedbacks(fbData);

      const candData = await MLGovernanceApi.getCandidates();
      setCandidates(candData);
    } catch (err: any) {
      setError(err.message || "Failed to load governance data");
    }
  };

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    fetchData();
  }, [user]);

  const handleGenerate = async (hazardType: string) => {
    if (!confirm(`Are you sure you want to generate a new explicit candidate dataset for ${hazardType}?`)) return;
    
    setIsGenerating(true);
    setError(null);
    try {
      await MLGovernanceApi.generateCandidate(hazardType);
      await fetchData();
    } catch (err: any) {
      setError(err.message || `Failed to generate candidate for ${hazardType}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!user || user.role !== "admin") return null;

  const pendingCount = feedbacks.filter(f => f.review_status === "submitted" || f.review_status === "under_review").length;
  const approvedCount = feedbacks.filter(f => f.review_status === "approved_ground_truth").length;
  const rejectedCount = feedbacks.filter(f => f.review_status === "rejected").length;

  return (
    <div className="container mx-auto p-4 space-y-8 mt-16 text-foreground">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary mb-2">ML Data Governance</h1>
        <p className="text-muted-foreground">Admin-only console for validating feedback and managing training datasets.</p>
      </div>

      {error && (
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="p-4 text-destructive font-semibold">{error}</CardContent>
        </Card>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center space-x-4">
            <Database className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">DEPLOYED MODEL</p>
              <p className="text-lg font-bold text-success uppercase">UNCHANGED (real-v1)</p>
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
          Ground truth is curated here to generate <strong>offline dataset candidates</strong>. Your production `real-v1` deployment is completely unaffected by this workflow.
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
  );
}
