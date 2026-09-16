# Role-Based Operational Command Center (v1)

## Overview
The Role-Based Operational Command Center provides tailored experiences for CITIZEN, RESPONDER, and ADMIN users, strictly enforcing data boundaries and backend RBAC. The system preserves the separation of actual vs. demo data and does not silently fall back to fake data in production mode.

## Role Experiences

### Citizen
- **Primary Goal**: Situational awareness and safety.
- **Navigation**: Dashboard, Live Map, Risk Assessment, Active Alerts, Disaster Events, Settings.
- **Experience**: The `CitizenDashboard` offers a simplified, read-only view focused on Overall Risk, Environmental conditions, Map Preview, and Active Alerts.
- **Constraints**: Citizens cannot see operational controls, incident response workflows, or admin settings.

### Responder
- **Primary Goal**: Incident management and emergency response.
- **Navigation**: Command Center, Live Map, Incidents, Risk Intelligence, Analytics, Settings.
- **Experience**: The `ResponderCommandCenter` provides a dense, operational dashboard featuring key KPIs (Active Incidents, High/Critical Alerts, Awaiting Ack, In Response), an `IncidentQueue` optimized for severity-based triage, and an integrated map.
- **Incident Workflow**: Responders can view incidents, acknowledge them, add meaningful response notes (minimum length enforced), and resolve incidents.

### Admin
- **Primary Goal**: Full operational visibility and system health monitoring.
- **Navigation**: Command Center, Incidents, Live Map, Risk Intelligence, Analytics, System, Settings.
- **Experience**: Admins have access to the Responder Command Center and an exclusive `SystemStatus` dashboard.
- **System View**: The `SystemStatus` page queries backend health APIs to display exact states (OPERATIONAL, DEGRADED, UNAVAILABLE) for the Core API Server, Database Persistence, and Notification Providers.

## Authorization Model
- **Frontend Routing**: The frontend uses `useAuth()` to dynamically render navigation links and route the root `/` path to the appropriate dashboard component.
- **Backend Enforcement**: JWT and backend identity remain authoritative. A citizen manually calling a responder API endpoint will be rejected by the backend. The frontend UI simply hides inappropriate actions to improve UX.

## Operational Metrics
All metrics in the Command Center are derived from actual API responses:
- **Active Incidents**: Alerts with `status === 'active'`.
- **High/Critical Alerts**: Alerts filtered by `severity === 'critical'` or `severity === 'high'`.
- **Awaiting Ack**: Alerts awaiting responder acknowledgement.
- **In Response**: Alerts with `status === 'response_in_progress'`.

## System Status
The System Status page uses explicit states based on backend telemetry:
- `OPERATIONAL`: Service is fully functional (e.g., `db_reachable === true`).
- `DEGRADED`: Service is experiencing issues but still partially functional.
- `UNAVAILABLE`: Service cannot be reached or is offline.

## Security
- **No Secrets Exposed**: Passwords, JWT secrets, API keys, and notification credentials are never displayed on the frontend.
- **Role Enforcement**: The UI verifies role enforcement by restricting navigation paths and action buttons based on the user's role.

## Responsive Design
- **Desktop**: Dense operational dashboard with multi-column layouts (Grid system).
- **Tablet**: Adaptive cards and columns.
- **Mobile**: Prioritized incident lists, scrollable content, and bottom sheets for incident details.

## Limitations
- **Notification Configuration**: The system status page currently displays Notification Providers as "Disabled (Dev Mode)" as the backend does not yet expose a dedicated configuration endpoint for these providers.
- **Incident Real-time Sync**: The Command Center relies on periodic polling or manual refresh; WebSockets are not yet implemented for real-time incident updates.
