# Incident Management v1

## Overview
The DisasterSense Incident Management layer builds upon the `Alert` system to provide an actionable, end-to-end response workflow for high-risk disaster events (flood and landslide).

## Incident Lifecycle
Incidents in DisasterSense follow a defined state machine represented by the `AlertStatus` enum:
- `ACTIVE` (Also referred to as DETECTED internally/in RiskEngine).
- `ACKNOWLEDGED`
- `RESPONSE_IN_PROGRESS`
- `RESOLVED`
- `DISMISSED`

**Allowed Transitions (Strictly Enforced):**
- `ACTIVE` → `ACKNOWLEDGED` (Acknowledge)
- `ACKNOWLEDGED` → `RESPONSE_IN_PROGRESS` (Begin Response)
- `ACTIVE` | `ACKNOWLEDGED` | `RESPONSE_IN_PROGRESS` → `RESOLVED` (Resolve)
- `ACTIVE` | `ACKNOWLEDGED` | `RESPONSE_IN_PROGRESS` → `DISMISSED` (Dismiss)

*Invalid transitions (e.g., `RESOLVED` → `RESPONSE_IN_PROGRESS`) return HTTP 400 Bad Request.*

## API Endpoints
- `POST /api/v1/alerts/{id}/acknowledge` (Moves to `ACKNOWLEDGED`)
- `POST /api/v1/alerts/{id}/respond` (Moves to `RESPONSE_IN_PROGRESS`)
- `POST /api/v1/alerts/{id}/resolve` (Moves to `RESOLVED`)
- `POST /api/v1/alerts/{id}/dismiss` (Moves to `DISMISSED`)
- `POST /api/v1/alerts/{id}/notes` (Adds a note without moving state; requires `ACKNOWLEDGED` or `RESPONSE_IN_PROGRESS`)

## Security & RBAC
- **Citizen (`citizen`)**: Read-only access to regional alerts and safety playbooks. Cannot mutate incident state or append notes.
- **Responder (`responder`) & Admin (`admin`)**: Can acknowledge, respond, resolve, dismiss, and add notes to incidents. Attempting unauthorized access yields HTTP 403.

## Idempotency / Duplicate Protection
To prevent duplicate alerts for an ongoing event, the `RiskEngine` will not generate a new alert if an `ACTIVE`, `ACKNOWLEDGED`, or `RESPONSE_IN_PROGRESS` alert already exists for the same location and hazard type.
If a risk assessment occurs *after* an alert is `RESOLVED`, it is considered a new emergency event and a *new* alert is legitimately created.

## Audit Trail and Response Notes
Every state transition is immutably logged in the `alert_audits` table.
Response notes are not stored in a separate table; they are appended to the `alert_audits` ledger via the `/notes` endpoint.
Audit records capture: `alert_id`, `actor`, `action`, `timestamp`, and `note`.
Audit records are strictly appended; they cannot be arbitrarily edited or deleted through public APIs.

## Historical / Predictive / Demo Separation
- **Historical Events**: Historical data resides in `DisasterEvent` with `alert_triggered=False` or already `RESOLVED`. They do not enter the active incident workflow.
- **Predictive Risk/Alerts**: Live assessments from the ML model generate active incidents.
- **Demo Data**: Demo mode is separated from real data via environment variables.

## Emergency Resource Data
As an academic prototype, DisasterSense does not currently interface with real-world shelter or hospital capacity APIs. Active incidents explicitly state that emergency resource data is unavailable.

## Testing & Verification
- **Alembic**: Migration `38ab9ca98b87` tracked correctly and clean.
- **Backend Tests**: 87/87 passed.
- **ML Tests**: 31/31 passed.
- **Combined Suite**: 118/118 passed.
- **Frontend Build**: Linter passed, production build passed.
- **Browser Automation**: No automated browser verification performed due to environment limitations. Validation relies on comprehensive API, Schema, and React build tests.
