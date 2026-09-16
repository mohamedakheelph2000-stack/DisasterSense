# Weather Provider & Real Data Hydration (Phase 20)

This document describes the `EnvironmentalProvider` module, which automatically hydrates API requests with real-time and historical weather/elevation data to fuel the `RiskEngine`'s real machine learning models.

## 1. Provider Architecture
The provider abstraction sits in `backend/app/services/weather_provider/`. It is decoupled from the `RiskEngine`.
- **`EnvironmentalProvider`**: The main facade used by the API endpoints. It manages caching and fallback logic.
- **`fetch_open_meteo_data`**: Handles data retrieval from the Open-Meteo API.
- **`get_elevation`**: Retrieves exact elevation from the Open-Elevation API.
- **`EnvironmentalData`**: The internal schema used to normalize provider responses (`LIVE`, `CACHED`, `ERROR`).

## 2. Open-Meteo Integration & Calculations
We use the Open-Meteo `/v1/forecast` endpoint with `past_days` logic to retrieve hourly data for exactly the 8 days preceding the `reference_timestamp`.

Features are calculated exactly as follows:
- `rainfall_mm_24h`: Sum of `precipitation` for the 24 hours strictly prior to and including the reference hour.
- `rainfall_intensity_mm_h`: Max hourly `precipitation` within the 24-hour window.
- `antecedent_rainfall_7d_mm`: Sum of `precipitation` for the 168 hours (7 days) strictly prior to the 24-hour window.
- `temperature_c`: Air temperature at the exact reference hour.
- `humidity_pct`: Relative humidity at the exact reference hour.

*Note: Future observations relative to the reference timestamp are strictly ignored to prevent data leakage.*

## 3. Open-Elevation Integration
We use `api.open-elevation.com`. Because elevation is geographically static, coordinates are rounded to 4 decimal places (roughly 11m resolution) to maximize caching. If elevation cannot be retrieved, it is gracefully omitted, causing the `RiskEngine` to safely fall back.

## 4. Caching Behavior
To prevent aggressive rate-limiting and unnecessary external requests, an in-memory thread-safe `SimpleTTLMemoryCache` is employed.
- **Weather Cache TTL**: 1 Hour (Weather state is valid for an hour).
- **Elevation Cache TTL**: 30 Days (Elevation rarely changes).
- **Cache Key**: A deterministic string of `lat,lon_timestamp` (excluding microseconds).

## 5. Fallback & Error Handling
If an external API times out (5.0s), returns a malformed response, or returns invalid physical values (e.g., negative rainfall), the `EnvironmentalData` status is set to `ERROR`. 
The RiskEngine detects the missing features in the `ml_input` payload and gracefully falls back down the hierarchy:
1. Real Model
2. Synthetic Model (if real model features are missing)
3. Heuristic Rules (if synthetic model fails)

## 6. Manual vs Automatic Mode
- **Manual Mode**: The user submits custom `rainfall_mm_24h` etc. via the API. The engine trusts the payload and executes inference.
- **Automatic Mode**: The user submits `latitude` and `longitude` (or an existing `location_id`). The API actively requests the `EnvironmentalProvider` to overwrite the default Pydantic feature values with genuine observations before handing the payload to the `RiskEngine`.

## 7. Security Protections
- Coordinates are validated before reaching external providers (`-90` to `90` for Lat, `-180` to `180` for Lon).
- Hardcoded Base URLs prevent SSRF / arbitrary URL fetching.
- Strict 5.0 second HTTP timeouts prevent request starvation.

## 8. API Compatibility
The integration introduces zero breaking changes.
`POST /api/v1/risk-assessments/flood` and `POST /api/v1/risk-assessments/landslide` remain identical, but now natively accept `latitude`, `longitude`, and a `?mode=automatic` query parameter.

## 9. Known Limitations
- The Open-Meteo API resolution is ~11km. Highly localized micro-climates might require physical IoT rain gauges for ultimate precision.
- Open-Elevation may occasionally timeout under heavy global load. The system falls back correctly, but real-model inference is bypassed when elevation is missing.
