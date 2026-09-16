## Analytics & Historical Intelligence (v1)

## Overview

The **Analytics & Historical Intelligence** module provides an aggregated, academic view of disaster risk patterns over time for the DisasterSense prototype. It exposes key insights into historical disaster events, predictive risk assessments, and active alerts.

## RBAC Decision

**Policy:** All authenticated users (including standard citizens) can view aggregate analytics. Unauthenticated users are strictly blocked.

**Reasoning:**
- Analytics are read-only and contain no personal identifying information (PII).
- Historical disaster intelligence is highly useful to citizens for awareness.
- Responder/admin users do not require exclusive access to high-level aggregate statistics.
- Responder/admin specific controls do NOT appear in analytics dashboards.

## Architectural Guidelines

- **Real Data Only**: No fabricated statistics. All KPIs and trends are directly calculated from database records using SQLAlchemy aggregations.
- **Separation of Concerns**: The analytics module strictly differentiates between `HISTORICAL`, `PREDICTIVE`, and `DEMO` records to maintain data provenance.
- **Read-Only**: This module does not modify models or trigger alerts. It simply provides observational intelligence on existing records.

## Key APIs & Time Range Filtering

All endpoints (except `/data-quality`) accept an optional `days` query parameter to filter data dynamically. The `days` parameter sets the timeframe to the last `N` days (e.g., 7, 14, 30, 90, 365). Passing no parameter or `0` will aggregate all-time records.

The endpoints are located under `/api/v1/analytics/`:

1. **`GET /summary`**  
   Provides high-level system KPIs. Time filter applies to `event_time` (Historical/Predictive) and `created_at` (Active Alerts).

2. **`GET /hazard-comparison`**  
   Offers a comparison between Flood and Landslide risks, breaking down historical events and active alerts, alongside the average risk score of predictive assessments.

3. **`GET /severity-distribution`**  
   Groups events by severity level (`LOW`, `MODERATE`, `HIGH`, `CRITICAL`), segmented strictly by historical vs predictive records.

4. **`GET /geographic`**  
   Returns a ranked list of locations based on total incident count (combining both historical events and predictive alerts). It relies on *persisted valid coordinates*. Missing coordinates (0.0, 0.0) are safely skipped or recorded in data quality metrics.

5. **`GET /data-quality`**  
   Provides provenance metadata globally. Calculates total records, time coverage (oldest/newest), missing coordinates (for spatial accuracy validation), and the number of demo-seeded records natively from the database.

6. **`GET /trends`**  
   A time-series API returning daily data points for a given lookback period (default 14 days). Tracks historical event volume, predictive assessment volume, active alerts, and maximum daily risk scores per hazard.

## Empty / Insufficient Data Behavior

- If the database is empty or a specific time range yields no records, endpoints return gracefully with zeroes (`0`), null values, or empty arrays (`[]`).
- The frontend will explicitly display "No data available for this selection" instead of rendering fake statistics or throwing an error.
- There are no hardcoded production statistics.

## Demo Mode Behavior

- Demo records (`RecordType.DEMO`) are explicitly excluded from predictive and historical statistics. They are only quantified in the `/data-quality` endpoint for provenance tracking.
- The frontend `.env.local` runs with `NEXT_PUBLIC_DEMO_MODE=false`.
- If an API request fails, the frontend displays an error state; it *never* silently substitutes mock/fake values.

## Frontend Implementation

The `/analytics` premium dashboard utilizes `Recharts` for interactive visualizations:
- **Line Charts**: For overlaying historical and predictive time-series trends.
- **Bar Charts**: For comparative hazard analysis (Flood vs Landslide).
- **Pie Charts**: For severity distributions.
- **Data Quality Panel**: For academic transparency and data provenance tracking.

The dashboard integrates gracefully into the existing React architecture using the `Card` component framework and Tailwind styling. The `RiskTrendChart` in the Command Center accurately consumes `flood_max_risk`, `landslide_max_risk`, and `active_alerts`.

## Known Limitations & Future Work

- **Forecast Horizon**: The predictive trend relies on the `event_time` of ML assessments. It currently does not extrapolate beyond the models' native forecasting horizon (typically 7-14 days).
