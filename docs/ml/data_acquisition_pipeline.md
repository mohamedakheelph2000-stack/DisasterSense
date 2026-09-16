# DisasterSense: Data Acquisition Pipeline Prototype

This document outlines the end-to-end data acquisition and feature engineering prototype, built to ingest real-world disaster catalogs and produce normalized tabular datasets for ML training.

## 1. Sources

The pipeline integrates the following authoritative datasets (defined in `ml/src/data/dataset_contracts.json`):
1. **Global Flood Database** (DFO / Cloud to Street) - for historical flood event centroids and dates.
2. **NASA Global Landslide Catalog (GLC/COOLR)** - for historical rainfall-triggered landslide events.
3. **ERA5 (Copernicus / Open-Meteo)** - for historical daily/hourly meteorological parameters.
4. **SRTM 30m DEM** - for topographical features (elevation, slope).

## 2. Acquisition Process

Since pulling multi-gigabyte raster and global CSV catalogs is impractical for rapid prototyping and academic iteration, the current pipeline utilizes an **Adapter Pattern**:
- `GlobalFloodDatabaseAdapter`: Yields a representative fixture of 2018/2019 Kerala floods.
- `NASALandslideCatalogAdapter`: Yields a representative fixture of Western Ghats landslides.
- `HistoricalWeatherAdapter`: Proxies queries to ERA5 by providing simulated monsoon/dry-season meteorological reads for given coordinates and timestamps.
- `TerrainAdapter`: Simulates SRTM extraction based on Kerala's high/lowland bounding boxes.

## 3. Normalized Event Schema

Regardless of source, all events are coerced into the following schema before feature hydration:
- `event_id` (str)
- `source` (str)
- `event_time` (datetime UTC)
- `latitude` (float)
- `longitude` (float)
- `event_type` (str)
- `severity_if_available` (Optional[str])
- `affected_area_if_available` (Optional[float])
- `source_reference` (str)

## 4. Feature Extraction & Engineering

### Weather Extraction (`weather_prototype.py`)
For every event, the following features are extracted for the exact date/coordinate:
- `rainfall_mm_24h`
- `rainfall_intensity_mm_h`
- `rainfall_duration_h`
- `antecedent_rainfall_7d_mm` (Proxy for soil saturation)
- `temperature_c`
- `humidity_pct`

### Terrain Extraction (`terrain_prototype.py`)
For every event, geospatial lookups yield:
- `elevation_m`
- `slope_deg`

## 5. Negative Sampling (`negative_sampling.py`)

A robust Random Forest requires negative examples. We employ **Spatiotemporal Negative Sampling**:
- For every positive disaster event, 2 negative events are generated.
- **Temporal Shift (50% chance):** Same coordinate, shifted by 180 days (into the dry season).
- **Spatial Shift (50% chance):** Same storm date, shifted by 0.5 - 1.5 degrees (~50-150 km) away from the disaster epicenter.

## 6. Provenance and Validation

### Validation (`validation.py`)
Pydantic is used to strictly enforce:
- Coordinate bounds (Lat -90 to 90, Lon -180 to 180).
- Impossible meteorological values (e.g., negative rainfall).
- Duplication checks (ensuring no `event_id` leakage).

### Provenance
Every row in the final `sample_events.csv` retains:
`event_id`, `source`, `event_time`, `latitude`, `longitude`.
This ensures full traceability back to the NASA GLC or Global Flood Database.

## 7. Licensing & Attribution
- NASA GLC: Open Data / Public Domain.
- GFD: CC BY 4.0 (Attribution required).
- ERA5: Copernicus Free & Open.
- SRTM: Public Domain.

*All data sources have been confirmed to be safe and legally permissible for this academic project.*

## 8. Known Limitations & Scaling Plan

### Limitations
1. **API Rate Limiting**: Fetching 10 years of daily ERA5 weather data point-by-point will trigger rate limits. 
2. **Missing Severity Labels**: GFD does not explicitly categorize "Severity" (it maps extent). We may need to infer severity based on affected area.

### Scaling Plan
To scale this prototype for actual model retraining:
1. Replace the mock fixtures in the Adapters with `pandas.read_csv()` pointing to the full downloaded GLC/GFD datasets.
2. Implement caching (SQLite or JSON files) in the `HistoricalWeatherAdapter` so that if multiple landslides happen near the same coordinates on the same day, we do not query the Open-Meteo API twice.
3. Download the localized SRTM DEM GeoTIFF for Southern India and use `rasterio` in the `TerrainAdapter` to do local pixel lookups (drastically faster than API calls).
