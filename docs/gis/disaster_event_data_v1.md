# DisasterSense GIS & Event Data Management v1

## Overview
DisasterSense handles geographic event data representing both AI-generated predictive disaster events and curated historical disaster events (e.g., past floods and landslides in the Western Ghats). This document outlines the schema, API capabilities, and rendering behavior for the GIS data layer.

## Disaster Event Model

The `DisasterEvent` model (in `backend/app/models/disaster_event.py`) is the central entity for mapping and alert generation.

### Core Fields
- `location_id`: Foreign key to `locations` (which contains precise `latitude` and `longitude`).
- `hazard_type`: (`HazardType`) Either `flood` or `landslide`.
- `severity`: (`SeverityLevel`) Determines the radius of impact and alert urgency (`low`, `moderate`, `high`, `critical`).
- `event_time`: The timestamp of the event or prediction.

### Provenance & Data Separation
To ensure clean data boundaries between real data, simulated data, and predictive models, the `record_type` field explicitly categorizes the event:

- `PREDICTIVE`: Output from the ML RiskEngine.
- `HISTORICAL`: A real-world event manually curated or imported from an authoritative source (e.g., NASA COOLR, Global Flood Database).
- `DEMO`: Mock data generated for UI demonstrations and test accounts.

Additionally, two fields provide deep traceability:
- `data_source`: A human-readable identifier for where the event originated (e.g., "NASA COOLR (Global Landslide Catalog)").
- `source_reference`: A URL or strict reference pointer to the original authoritative record.

## Database Optimization

The following composite indices optimize GIS and dashboard queries in PostgreSQL:
1. `ix_disaster_events_location_hazard_time`: Optimizes time-series analytics and dashboard aggregations.
2. `ix_disaster_events_severity`: Optimizes emergency alert routing logic.
3. `ix_disaster_events_record_type`: Optimizes mapping queries that explicitly filter out `DEMO` or `PREDICTIVE` events to visualize only `HISTORICAL` overlays.

## Historical Seeding
A reproducible Python script (`backend/scripts/seed_historical_events.py`) inserts a curated baseline dataset of major disasters for demonstration and mapping accuracy. The current dataset includes:
- 2024 Wayanad (Chooralmala-Mundakkai) Landslides
- 2018 Chengannur Floods
- 2020 Idukki (Pettimudi) Debris flow

## Frontend Integration
The frontend GIS interface (`frontend/src/app/map/page.tsx` and Leaflet components) dynamically filters map layers by hazard and record type. 
Historical events are rendered using a distinct purple marker scheme (`#9c27b0`) to visually separate them from active, real-time predictions. The `SelectedLocationPanel` automatically detects the provenance fields and displays an explicit **HISTORICAL** badge alongside the authoritative source link.
