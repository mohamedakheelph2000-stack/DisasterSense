import { useState } from "react";
import { MLGovernanceApi, FeedbackResponse } from "@/lib/api/ml-governance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function FeedbackTable({ feedbacks, onRefresh, currentUserId }: { feedbacks: FeedbackResponse[], onRefresh: () => void, currentUserId: number }) {
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleReview = async (id: number, action: string) => {
    setProcessingId(id);
    try {
      await MLGovernanceApi.reviewFeedback(id, action, `Transitioned to ${action} from UI`);
      onRefresh();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveGT = async (id: number) => {
    const evidenceType = prompt("Please provide Evidence Type (e.g., 'verified_field_report', 'usgs_data'):", "verified_field_report");
    if (!evidenceType) return;
    
    const evidenceRef = prompt("Please provide Evidence Reference (e.g., URL or Incident ID):", "incident-123");
    if (!evidenceRef) return;

    setProcessingId(id);
    try {
      await MLGovernanceApi.approveGroundTruth(id, {
        evidence_type: evidenceType,
        evidence_reference: evidenceRef,
        notes: "Approved from UI"
      });
      onRefresh();
    } catch (e: any) {
      alert("Error approving ground truth: " + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  if (!feedbacks || feedbacks.length === 0) {
    return <p className="text-sm text-muted-foreground">No feedback records found.</p>;
  }

  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-sm text-left">
        <thead className="text-xs uppercase bg-secondary/20 border-b">
          <tr>
            <th className="px-4 py-3">ID / Hazard</th>
            <th className="px-4 py-3">Feedback Type</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Lineage / Evidence</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {feedbacks.map((f) => {
            const isSelf = f.submitted_by_id === currentUserId;
            const isApproved = f.review_status === "approved_ground_truth";
            const canUnderReview = f.review_status === "submitted";
            const canAcceptReject = f.review_status === "under_review";
            const canApproveGT = f.review_status === "accepted";
            
            return (
              <tr key={f.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">#{f.id}</div>
                  <div className="text-xs text-muted-foreground uppercase">{f.hazard_type}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{f.feedback_type.replace(/_/g, ' ')}</Badge>
                  {f.observed_outcome && <div className="text-xs mt-1 max-w-[200px] truncate" title={f.observed_outcome}>{f.observed_outcome}</div>}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={
                    f.review_status === 'approved_ground_truth' ? 'default' :
                    f.review_status === 'rejected' ? 'danger' : 'secondary'
                  } className={f.review_status === 'approved_ground_truth' ? 'bg-success text-success-foreground' : ''}>
                    {f.review_status.replace(/_/g, ' ')}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="truncate max-w-[200px] font-mono text-xs text-muted-foreground" title={f.provenance || ""}>
                    SRC: {f.provenance || "Unknown"}
                  </div>
                  {f.evidence_type && (
                    <div className="text-xs mt-1">
                      <span className="font-semibold">Evidence:</span> {f.evidence_type} ({f.evidence_reference})
                    </div>
                  )}
                  {f.exclusion_reason && (
                    <div className="text-xs mt-1 text-danger">
                      <span className="font-semibold">Excluded:</span> {f.exclusion_reason}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2 space-y-1">
                  {canUnderReview && (
                    <Button 
                      variant="secondary" size="sm" 
                      disabled={processingId === f.id} 
                      onClick={() => handleReview(f.id, "under_review")}
                    >
                      Start Review
                    </Button>
                  )}
                  
                  {canAcceptReject && (
                    <>
                      <Button 
                        variant="outline" size="sm" 
                        disabled={processingId === f.id} 
                        onClick={() => handleReview(f.id, "accepted")}
                      >
                        Accept
                      </Button>
                      <Button 
                        variant="destructive" size="sm" 
                        disabled={processingId === f.id} 
                        onClick={() => handleReview(f.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  
                  {canApproveGT && (
                    <Button 
                      variant="default" size="sm"
                      disabled={processingId === f.id || isSelf}
                      title={isSelf ? "Self-approval is forbidden" : ""}
                      onClick={() => handleApproveGT(f.id)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Approve GT
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
