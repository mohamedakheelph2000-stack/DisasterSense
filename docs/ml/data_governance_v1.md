# DisasterSense ML Dataset Governance

## Overview

The ML Dataset Governance layer provides a secure, auditable pathway for improving future Machine Learning models. It allows stakeholders to submit operational feedback on ML predictions and provides administrators a dedicated pipeline to review and approve ground-truth records. 

Crucially, this system enforces **immutability of existing models**. Feedback is curated into **Explicit Candidate Datasets** offline, rather than silently mutating the production `real-v1` deployment.

## Feedback Lifecycle & State Machine

The review process strictly follows this state machine. Invalid transitions are rejected at the API level (e.g. `400 Bad Request`).

1. **SUBMITTED**: Feedback is created by a Citizen, Responder, or Admin.
2. **UNDER_REVIEW**: An Admin begins reviewing the submission. (`SUBMITTED` -> `UNDER_REVIEW`)
3. **ACCEPTED / REJECTED**: The operational feedback is deemed valid or invalid. (`UNDER_REVIEW` -> `ACCEPTED` | `REJECTED`)
4. **APPROVED_GROUND_TRUTH**: An Admin formally verifies the feedback against authoritative evidence. (`ACCEPTED` -> `APPROVED_GROUND_TRUTH`)

## Ground-Truth Evidence Rules

Admin approval alone is **NOT** sufficient to promote a record to ground truth. When transitioning from `ACCEPTED` to `APPROVED_GROUND_TRUTH`, the Admin **must** provide:
- `evidence_type`: (e.g. 'usgs_verified', 'field_report')
- `evidence_reference`: (e.g. 'incident-123', 'URL')

Ground Truth is never inferred from the absence of an alert or user disagreement alone.

## Dataset Candidate Generation & Leakage Safeguards

Candidates are generated explicitly by Administrators. A Candidate represents an offline snapshot of training data.
The system automatically prevents **Model Evaluation Contamination** and **Data Leakage**.

- **No Automatic Retraining**: Reviewing and approving feedback does NOT automatically retrain or deploy models. 
- **Candidate Generation**: Approved Ground Truth records are explicitly generated into a `DatasetCandidate` entity (e.g., `real-v2-candidate-flood-20260916`).
- **Offline ML Work**: Admins can export Candidate Datasets as JSON for offline ML scientists to train and rigorously evaluate `v2` models.

2. **Duplicate Deduplication**: The generation pipeline automatically detects if multiple feedbacks point to the same `event_id`. Duplicate records are flagged with an `exclusion_reason` and safely skipped, preventing spatial and temporal leakage in the training set.

## Data Lineage & Audit Trail

Every candidate record must be traceable.
- The `MLGovernanceAudit` table provides an immutable log of who took what action, their notes, the state transitions, and the timestamps. 
- No standard API allows deleting or modifying the `MLGovernanceAudit` history. 
- Lineage is exposed to Admins on the Frontend UI, directly answering "Why is this row present in this dataset?"

## Security and Role-Based Access Control (RBAC)

- **Citizens**: May submit feedback to improve the system. Forced to `UNCERTAIN` state. Cannot review or approve.
- **Responders**: May submit structured operational observations. Cannot review or approve.
- **Admins**: Can review, accept, reject, approve ground truth (with evidence), generate candidates, and export.
- **Self-Approval Prevention**: An Admin cannot approve their own submitted feedback as Ground Truth (`403 Forbidden`).
