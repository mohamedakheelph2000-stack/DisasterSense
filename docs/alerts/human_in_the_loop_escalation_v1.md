# Human-in-the-Loop Alert Escalation (v1)

## Overview

The Human-in-the-Loop (HITL) Alert Escalation workflow allows authorized operators (Responders, Admins) to manually review AI-generated spatial-temporal clusters and formally escalate them into operational Regional Risk Alerts.

This mechanism ensures that no automated emergency declarations are made solely on the basis of algorithmic clustering, maintaining human authority over critical notification channels.

## Key Principles

1. **No Automatic Escalation**: The ML system identifies clusters; human operators declare emergencies.
2. **Stable Cluster Identity**: Clusters are assigned deterministic hashes based on their member events to prevent duplicate alert creation.
3. **Role-Based Access Control**:
   - `Citizen`: Cannot view or trigger escalations.
   - `Responder`: Can escalate clusters.
   - `Admin`: Can escalate clusters.
4. **Provenance Preservation**: When escalated, the resulting Alert stores the snapshot of the cluster metrics (member count, average risk, duration).
5. **Audit Trail**: Every escalation creates a permanent `AlertAudit` record detailing the actor, time, assigned severity, and operational note.

## Technical Architecture

### 1. Deterministic Cluster Identification
Instead of transient index-based IDs, the clustering algorithm generates a stable MD5 hash of the sorted array of member `DisasterEvent` IDs. This hash serves as the `cluster_id` and is passed to the backend during escalation.

### 2. Alert Data Model Additions
The `Alert` SQLAlchemy model supports two additional fields:
- `source_cluster_id (String)`: The deterministic hash.
- `cluster_metadata (JSON)`: A snapshot of the cluster's metrics at the moment of escalation.

The Alert still fulfills its foreign key requirement for `disaster_event_id` by anchoring to the highest-risk member event of the cluster.

### 3. Escalation API (`POST /api/v1/spatial-risk/clusters/{cluster_id}/escalate`)
- Validates that no active or in-progress alert already exists for the given `cluster_id` (returns `409 Conflict` if duplicate).
- Prevents escalation of `DEMO` clusters entirely (returns `400 Bad Request`).
- Independently recreates and validates the cluster using the requested hazard type, record type, and time window. The client's member IDs are ignored for security.
- Re-fetches all matching member events from the authoritative backend data.
- Enforces an explicit operator-selected severity (e.g., HIGH, CRITICAL). It does not blindly inherit the underlying event's severity.
- Creates the `Alert`, with `severity` overriding the event severity for notification dispatching.
- Creates an `AlertAudit` with the explicit user actor, preserving privacy by using `user_id` instead of raw email/PII.
- Triggers the `notification_dispatcher` using the operator's severity. Handles internal exceptions gracefully without exposing sensitive system errors to the client.

## Frontend Integration

The `SelectedLocationPanel` in the map interface detects when a cluster is selected and, if the user has appropriate permissions, renders an escalation confirmation UI. Operators must explicitly provide a `Severity` rating and an optional `Operational Note` before confirming the escalation.

A distinct warning is shown if the operator is attempting to escalate a `PREDICTIVE` cluster, advising that corroborating evidence is required before declaring a confirmed emergency.

The `IncidentQueue` and `AlertDetailPanel` read the actual `severity` from the alert and fall back to the `cluster_metadata` to display the source cluster context alongside standard alert properties. Automated cluster detection alone never triggers an emergency alert; it solely cues the operator.
