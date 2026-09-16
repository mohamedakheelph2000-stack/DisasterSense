# Dashboard Analytics API v1

## 1. Risk Trends

**Endpoint**: `GET /api/v1/analytics/trends`

Provides a time-series aggregation of historical risk assessments suitable for charting.

### Request Parameters
- `days` (integer, optional): Number of days to include in the time series. Default is 14. Must be between 1 and 365.

### Response
Returns an array of daily data points sorted chronologically. Each point contains the maximum flood and landslide risk scores evaluated on that day, scaled from 0.0 to 100.0. Empty days are included with zero scores.

```json
{
  "items": [
    {
      "date": "2026-09-14",
      "flood": 85.0,
      "landslide": 95.0,
      "overall": 95.0,
      "count": 2
    },
    ...
  ]
}
```

### Authorization
Requires a valid JWT Bearer token (any role).

---

## 2. Environment Current

**Endpoint**: `GET /api/v1/environment/current`

Provides the latest environmental telemetry used by the automatic ML pipelines.

### Request Parameters
- `latitude` (float, optional): Defaults to `11.605` (Wayanad).
- `longitude` (float, optional): Defaults to `76.083` (Wayanad).

### Response
Returns normalized features dynamically retrieved (or cached) from the upstream provider.

```json
{
  "rainfall_24h": 120.5,
  "rainfall_intensity": 15.0,
  "antecedent_rainfall_7d": 450.0,
  "temperature": 25.5,
  "humidity": 88.0,
  "elevation": 850.0,
  "reference_timestamp": "2026-09-15T12:00:00Z",
  "provider": "open-meteo",
  "status": "LIVE"
}
```

- `status` can be `LIVE`, `CACHED`, `UNAVAILABLE`, or `ERROR`.
- If data is completely unavailable, fields may be `null`.

### Authorization
Requires a valid JWT Bearer token (any role).
