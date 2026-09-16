# Spatial Risk Aggregation v1

**Last Updated:** September 2026
**Architecture Level:** Application / GIS

## Overview
The Spatial Risk Aggregation layer is responsible for translating individual backend `RiskAssessment` records into verifiable, regional spatial intelligence. 

Instead of using arbitrary interpolations (such as standard blurred heatmaps or radius circles), this system uses a deterministic geographic grid. This ensures scientific honesty: every colored cell directly correlates with actual, underlying predictive assessments.

## Geographic Grid System
We implement a robust, lightweight fixed grid without requiring heavy spatial extensions (like PostGIS) for prototype simplicity and performance.

- **Cell Size (Resolution)**: 0.05° x 0.05° Latitude/Longitude
- **Approximate Dimensions**: ~5.5 km x 5.5 km per cell (varies slightly by latitude)

### Cell Calculation
Grid boundaries are deterministic, mapped from any coordinate:
```python
# Round down to the nearest 0.05 increment
cell_lat = math.floor((latitude / 0.05) + 1e-9) * 0.05 + (0.05 / 2.0)
cell_lon = math.floor((longitude / 0.05) + 1e-9) * 0.05 + (0.05 / 2.0)
```
*(An epsilon of `1e-9` is added prior to flooring to prevent floating-point precision anomalies, e.g., `12.20 / 0.05` computing as `243.99999999999997`).*

## Endpoint Interface
`GET /api/v1/spatial-risk/aggregation`

### Query Parameters
- `time_range`: Defines the lookback window (`24h`, `7d`, `30d`, `90d`, `all`). Only events with an `event_time` greater than the cutoff are included.
- `hazard_type`: Filters by `flood` or `landslide`.
- `record_type`: Strict segregation of `PREDICTIVE`, `HISTORICAL`, or `DEMO` records.
- `min_lat`, `max_lat`, `min_lon`, `max_lon`: Bounding box limits to optimize performance.

### Cell Statistics
For each grid cell, the following statistics are derived from all valid events within its bounds:
1. **Average Risk**: Mean `risk_score` across all valid assessments.
2. **Maximum / Minimum Risk**: Absolute bounds of the scores.
3. **Latest Risk**: The `risk_score` of the assessment with the most recent `event_time`.
4. **Severity Counts**: Distinct counts of assessments categorized as `High` (≥ 0.70) and `Critical` (≥ 0.90).
5. **Provenance Set**: A unique list of `data_source` and `source_reference` strings to guarantee traceability of the predictions.

## Strict Scientific Safeguards
1. **No "Probability of Disaster" Claims**: The API and UI explicitly use the term "Risk Score" or "Risk Category". Unless underlying models are formally calibrated to probability distributions (which is mathematically difficult to assert generally), we do not conflate score with probability.
2. **Strict Record Type Isolation**: By default, spatial grids only aggregate `PREDICTIVE` records. `DEMO` and `HISTORICAL` records are treated as distinct overlays and never merge into the predictive score.
3. **Minimum Data Threshold**: A cell must contain at least 1 valid predictive assessment within the time window to exist. Empty interpolations are strictly prohibited.
