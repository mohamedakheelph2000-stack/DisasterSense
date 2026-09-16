# Verified Emergency Resource Intelligence (v1)

## Architecture Overview

The Verified Emergency Resource Intelligence layer in DisasterSense provides an authoritative repository of critical emergency infrastructure (e.g., shelters, hospitals, fire stations, police stations, relief centers) mapped across the region.

This layer is designed to:
- Be read-only through the API for citizens and responders.
- Connect seamlessly with the incident management alerting system.
- Support accurate, real-time proximity matching without requiring heavy GIS extensions like PostGIS.

## The "Unavailable" State

**CRITICAL CONSTRAINT**: The DisasterSense platform requires that no physical emergency facility (e.g., a hospital or shelter) is claimed to be operational or safe without explicit verification from an authoritative data source (e.g., KSDMA - Kerala State Disaster Management Authority, or IDRN).

Since no open, machine-readable, and legally verifiable dataset with coordinate mapping was found available for automated import at the time of deployment, **the resource data import was intentionally halted.**

As a result, the application features an explicit **"Unavailable State"**:
- The API endpoints exist but return 0 records.
- The Map shows a "Resources (Unavailable)" layer toggle.
- The Incident Detail view explicitly notes: *"Emergency resource data (shelters, hospitals) unavailable. To integrate, an authoritative dataset must be supplied by the local disaster management authority."*

**Note on Incident-Detail Integration Status:** Resource integration currently exists only in the GIS/map layer and the underlying backend API. The incident-detail panel does NOT yet automatically pull nearby resources via the API; it only displays the hardcoded unavailable state. Dynamic integration into the incident details remains a future task.

This is not a bug; it is a strict adherence to the system's mandate against fabricating safety-critical data.

## Data Model

The `EmergencyResource` SQLAlchemy model includes:
- `id`, `name`, `resource_type` (Enum)
- `latitude`, `longitude` (indexed for spatial querying)
- `address`, `district`
- `source`, `source_reference` (For provenance tracking)
- `record_type` (HISTORICAL, PREDICTIVE, DEMO)
- `verification_status` (VERIFIED, UNVERIFIED)
- `capacity`, `contact_info`

## Proximity Search

To find nearby resources without PostGIS, we implemented the **Haversine Formula** directly in SQLAlchemy. This provides a highly accurate distance calculation (in kilometers) directly inside the database query.

**Endpoint**: `GET /api/v1/resources`
- `latitude` (float)
- `longitude` (float)
- `radius_km` (float)

When proximity parameters are supplied, the endpoint dynamically sorts by distance and calculates the precise `distance_km` returned in the response payload.

## Future Integration

To fully activate this feature, an authorized user or administrator must obtain the exact JSON/CSV from KSDMA or the local health department.

The dataset must contain:
- Facility Name
- Exact Latitude and Longitude
- Type (Hospital, Cyclone Shelter, etc.)
- Current Verification Status

Once imported into the `emergency_resources` table, the UI and proximity searches will instantly light up and function correctly.

## Security & Privacy
- **Read-Only Access**: Citizens and responders can view resources (`GET`), but currently, NO endpoints exist for creating (`POST`), updating (`PUT`), or deleting (`DELETE`) resources through the API. This ensures data immutability.
- **Authentication Required**: Access to the resources API requires a valid authenticated session.
- **No Private Data**: The search coordinates supplied to the `/resources` proximity search are used only for calculating distances dynamically and are not persisted to the database.

## Limitations
- **No Active Dataset**: Currently, there are 0 real resource records in the database.
- **Manual Import Required**: Populating the database requires direct DB access or future implementation of an admin-only import endpoint.
- **No Incident Detail Sync**: The Incident Detail panel on the frontend currently displays an unavailable state and does not yet query the backend for nearby resources.
