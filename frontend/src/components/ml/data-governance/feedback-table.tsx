import { useState, Fragment } from "react";
import { MLGovernanceApi, FeedbackResponse } from "@/lib/api/ml-governance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function FeedbackTable({ feedbacks, onRefresh, currentUserId }: { feedbacks: FeedbackResponse[], onRefresh: () => void, currentUserId: number }) {
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [evidenceType, setEvidenceType] = useState("verified_field_report");
  const [evidenceRef, setEvidenceRef] = useState("");

  const handleReview = async (id: number, action: string) => {
    setProcessingId(id);
    setActionError(null);
    try {
      await MLGovernanceApi.reviewFeedback(id, action, `Transitioned to ${action} from UI`);
      onRefresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveGT = async (id: number) => {
    if (!evidenceRef.trim()) {
      setActionError("Evidence reference is required before approving ground truth.");
      return;
    }
    setProcessingId(id);
    setActionError(null);
    try {
      await MLGovernanceApi.approveGroundTruth(id, {
        evidence_type: evidenceType,
        evidence_reference: evidenceRef.trim(),
        notes: "Approved from UI"
      });
      setApprovingId(null);
      setEvidenceRef("");
      onRefresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessingId(null);
    }
  };

  if (!feedbacks || feedbacks.length === 0) {
    return <p className="text-sm text-muted-foreground">No feedback records found.</p>;
  }

  return (
    <div className="space-y-3">
    {actionError && (
      <p role="alert" className="text-xs text-danger border border-danger/30 bg-danger/10 rounded-md p-2 break-words">
        {actionError}
      </p>
    )}
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
            const canUnderReview = f.review_status === "submitted";
            const canAcceptReject = f.review_status === "under_review";
            const canApproveGT = f.review_status === "accepted";
            const isApproving = approvingId === f.id;
            
            return (
              <Fragment key={f.id}>
              <tr className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">#{f.id}</div>
                  <div className="text-xs text-muted-foreground uppercase">{f.hazard_type}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline">{String(f.feedback_type ?? '').replace(/_/g, ' ')}</Badge>
                  {f.observed_outcome && <div className="text-xs mt-1 max-w-[200px] truncate" title={f.observed_outcome}>{f.observed_outcome}</div>}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={
                    f.review_status === 'approved_ground_truth' ? 'default' :
                    f.review_status === 'rejected' ? 'danger' : 'secondary'
                  } className={f.review_status === 'approved_ground_truth' ? 'bg-success text-success-foreground' : ''}>
                    {String(f.review_status ?? '').replace(/_/g, ' ')}
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
                  
                  {canApproveGT && !isApproving && (
                    <Button 
                      variant="default" size="sm"
                      disabled={processingId === f.id || isSelf}
                      title={isSelf ? "Self-approval is forbidden" : ""}
                      onClick={() => {
                        setActionError(null);
                        setApprovingId(f.id);
                        setEvidenceType("verified_field_report");
                        setEvidenceRef("");
                      }}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Approve GT
                    </Button>
                  )}
                </td>
              </tr>

              {isApproving && (
                <tr className="border-b last:border-0 bg-primary/5">
                  <td colSpan={5} className="px-4 py-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1 text-xs">
                        <span className="uppercase text-muted-foreground">Evidence type</span>
                        <select
                          value={evidenceType}
                          onChange={(e) => setEvidenceType(e.target.value)}
                          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="verified_field_report">verified_field_report</option>
                          <option value="official_government_bulletin">official_government_bulletin</option>
                          <option value="usgs_data">usgs_data</option>
                          <option value="agency_station_reading">agency_station_reading</option>
                          <option value="news_report">news_report</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs grow min-w-[16rem]">
                        <span className="uppercase text-muted-foreground">Evidence reference</span>
                        <input
                          value={evidenceRef}
                          onChange={(e) => setEvidenceRef(e.target.value)}
                          placeholder="URL or incident ID"
                          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
                        />
                      </label>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={processingId === f.id || !evidenceRef.trim()}
                          onClick={() => handleApproveGT(f.id)}
                        >
                          Confirm
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setApprovingId(null)} disabled={processingId === f.id}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
    </div>
  );
}
