# DisasterSense: Real-World Dataset Strategy & ML Data Architecture

## 1. Executive Summary
This report outlines the strategy for transitioning the DisasterSense machine learning models from synthetic training data to authoritative real-world datasets. The primary focus is on the Western Ghats and Kerala regions of India, which face high susceptibility to both floods and landslides. The transition requires adopting geospatial and meteorological data sources, establishing a rigorous spatial-temporal labeling strategy, and addressing inevitable gaps between theoretical synthetic features and obtainable real-world observations.

## 2. Existing DisasterSense Feature Audit
Based on the current ML schemas (`ml/src/flood/flood_features.py` and `ml/src/landslide/landslide_features.py`), the models expect the following tabular features:

**Flood Features (11):**
- `rainfall_mm_24h`
- `rainfall_intensity_mm_h`
- `rainfall_duration_h`
- `temperature_c`
- `humidity_pct`
- `elevation_m`
- `slope_deg`
- `drainage_capacity_score`
- `soil_saturation_pct`
- `historical_flood_count`
- `distance_to_river_m`

**Landslide Features (10):**
- `rainfall_mm_24h`
- `rainfall_intensity_mm_h`
- `slope_deg`
- `elevation_m`
- `soil_type_code`
- `soil_moisture_pct`
- `geological_stability_index`
- `vegetation_cover_pct`
- `historical_landslide_count`
- `road_cut_proximity_m`

*Observation:* Several of these features (e.g., `geological_stability_index`, `drainage_capacity_score`) are abstract synthetic indices that do not directly exist in raw authoritative datasets and will require proxy derivations.

## 3. Flood Dataset Candidates
1. **Global Flood Database (Cloud to Street / DFO)**
   - *Source:* Google Earth Engine / GCS (`gfd_v1_4`)
   - *Coverage:* Global, 2000–2018 (includes major Indian flood events).
   - *Pros:* Authoritative inundation maps, reliable positive labels.
   - *Cons:* Focuses on major events; might miss localized urban flooding.
2. **IMD Gridded Rainfall Data + CWC Reports**
   - *Source:* India Meteorological Department / Central Water Commission.
   - *Coverage:* India, daily resolution.
   - *Pros:* Highly accurate, localized meteorological data (rainfall, temperature).
   - *Cons:* Requires joining with separate flood event records to generate labels.
3. **Kerala 2018 Floods Dataset (Kaggle/Open Data)**
   - *Source:* Kaggle (compiled from Kerala Govt/IMD).
   - *Coverage:* Kerala specific, 2018.
   - *Pros:* Extremely relevant to the project's target geography.
   - *Cons:* Temporal limitation (single year/event bias).

## 4. Landslide Dataset Candidates
1. **NASA Global Landslide Catalog (GLC) / COOLR**
   - *Source:* NASA Earthdata / COOLR.
   - *Coverage:* Global, rainfall-triggered landslides, extensive Western Ghats entries.
   - *Pros:* Open access, includes event dates, coordinates, and trigger information.
   - *Cons:* Location accuracy can vary (some reported via news articles).
2. **Bhukosh Landslide Inventory (Geological Survey of India)**
   - *Source:* GSI portal.
   - *Coverage:* India-specific.
   - *Pros:* Highly authoritative, precise geological coordinates.
   - *Cons:* Access may require registration; API extraction can be complex.
3. **ISRO Landslide Atlas of India**
   - *Source:* NRSC / ISRO.
   - *Coverage:* India.
   - *Pros:* Exceptional spatial resolution.
   - *Cons:* Primarily spatial susceptibility maps rather than temporal occurrence logs.

## 5. Feature Mapping Tables

### Flood Feature Mapping
| Existing Feature | Source / Proxy Recommendation | Action |
| :--- | :--- | :--- |
| `rainfall_mm_24h` | IMD Gridded Data / CHIRPS | Keep (Directly available) |
| `rainfall_intensity_mm_h` | ERA5 / IMD hourly (if available) | Keep or derive from 24h data |
| `rainfall_duration_h` | ERA5 / IMD hourly | Keep or proxy with antecedent rain (3-day) |
| `temperature_c` | IMD / ERA5 | Keep (Directly available) |
| `humidity_pct` | IMD / ERA5 | Keep (Directly available) |
| `elevation_m` | SRTM 30m DEM | Keep (GIS extraction) |
| `slope_deg` | SRTM 30m DEM (Derived) | Keep (GIS extraction) |
| `drainage_capacity_score` | Topographic Wetness Index (TWI) + LULC | **Replace** with TWI and LULC classes |
| `soil_saturation_pct` | NASA SMAP / Antecedent Rainfall Index (API) | **Proxy** using 7-day cumulative rainfall |
| `historical_flood_count` | DFO / Historical records aggregation | Keep (Pre-calculate for grid cells) |
| `distance_to_river_m` | OpenStreetMap / HydroRIVERS | Keep (GIS distance calculation) |

### Landslide Feature Mapping
| Existing Feature | Source / Proxy Recommendation | Action |
| :--- | :--- | :--- |
| `rainfall_mm_24h` | IMD Gridded Data / CHIRPS | Keep (Directly available) |
| `rainfall_intensity_mm_h` | ERA5 / IMD | Keep or proxy with antecedent rain |
| `slope_deg` | SRTM 30m DEM | Keep (GIS extraction) |
| `elevation_m` | SRTM 30m DEM | Keep (GIS extraction) |
| `soil_type_code` | FAO Soil Map / NBSS&LUP | Keep (Map to categorical codes) |
| `soil_moisture_pct` | NASA SMAP / Antecedent Rainfall | **Proxy** using API (Antecedent Precipitation) |
| `geological_stability_index`| Lithology maps (Bhukosh) | **Replace** with Lithology categorical feature |
| `vegetation_cover_pct` | NDVI (Landsat/Sentinel-2) | **Replace** with NDVI continuous value |
| `historical_landslide_count`| NASA GLC / GSI Bhukosh | Keep (Pre-calculate for grid cells) |
| `road_cut_proximity_m` | OpenStreetMap Roads | Keep (GIS distance calculation) |

## 6. Ground-Truth / Label Strategy
We require a binary classification target: `1` (Event Occurred) or `0` (No Event).
- **Positive Labels (1):** Defined by specific Date + Lat/Lon coordinates found in catalogs (e.g., NASA GLC for landslides, DFO for floods).
- **Negative Labels (0):** Generated via **Spatiotemporal Negative Sampling**:
  - Sample the exact same locations on dates where no event occurred (e.g., during the dry season, or non-anomalous monsoon days).
  - Sample nearby safe locations on the exact date of known events.
- **Data Joining:** Labels will be joined with meteorological data (ERA5/IMD) based on the Date/Location, and with static geospatial data (DEM, OSM) based on Location.

## 7. Kerala / Western Ghats Strategy
**Recommendation: Hybrid Approach (Western Ghats + Broader India)**
- *Why not just Kerala?* A Kerala-only dataset for the past 10 years may not yield enough distinct positive landslide/flood data points to train a robust Random Forest without severe overfitting.
- *Strategy:* Train on the broader Western Ghats region (which shares similar topography, laterite soils, and monsoon patterns) and potentially all of India to ensure sufficient sample size. Evaluation/Test sets should heavily over-index on Kerala to ensure regional performance.

## 8. Model Comparison Strategy
While Random Forest is the current baseline, tabular environmental data often benefits from gradient boosting.
1. **Logistic Regression (Baseline):** Highly interpretable, essential to prove that complex models are actually learning non-linear relationships.
2. **Random Forest (Current):** Low tendency to overfit, handles categorical data well, robust to outliers.
3. **XGBoost / LightGBM (Proposed Challenger):** Generally yields higher ROC-AUC on tabular geospatial data. Fast inference.

*Decision:* Retain Random Forest as the primary architecture to minimize engineering churn, but compare locally with XGBoost during validation.

## 9. Train / Validation / Test Strategy
Blind `train_test_split` is strictly prohibited to prevent data leakage.
- **Spatial Separation:** Ensure that points in the test set are geographically separated from the training set (e.g., train on northern/central Western Ghats, test on Kerala).
- **Temporal Separation:** Train on events from 2000–2017. Test on events from 2018–2023 (evaluating the model's ability to predict the 2018 Kerala floods using past knowledge).
- **Metrics:** 
  - *Primary:* **F1-Score** and **PR-AUC** (Precision-Recall Area Under Curve), due to extreme class imbalance (non-events vastly outnumber events).
  - *Secondary:* Recall (crucial for early warning systems to avoid false negatives) while keeping False Alarm Rate (FAR) manageable.

## 10. Data Leakage Risks
1. **Spatiotemporal Auto-correlation:** Rainfall events span multiple days and large areas. If Day 1 is in the train set and Day 2 (same storm) is in the test set, the model will cheat. *Mitigation:* Split data temporally by whole storm events or years.
2. **Target Leakage:** Using post-event satellite imagery (e.g., measuring NDVI *after* a landslide wiped out the forest) to predict the landslide. *Mitigation:* Ensure dynamic features (NDVI, SMAP) are lagged (e.g., measured 7 days *before* the event).

## 11. Dataset Licensing / Accessibility
- **NASA GLC / COOLR:** Open Data, free for academic/commercial use. Attribution required.
- **IMD / GSI:** Government data. Academic use is generally permitted, but bulk programmatic access may require API registration or manual scraping.
- **SRTM DEM / Sentinel (Copernicus):** Open and free.
*Conclusion:* The proposed datasets are entirely safe for a final-year academic project.

## 12. Recommended Datasets (Ranked)
**PRIMARY FLOOD DATA STRATEGY:**
1. **Global Flood Database (DFO/Cloud to Street)** for positive event labels.
2. **ERA5 Reanalysis (Copernicus)** for historical daily rainfall/temperature (global, easy API access, avoids IMD access hurdles).
3. **SRTM 30m DEM** for elevation and slope.

**PRIMARY LANDSLIDE DATA STRATEGY:**
1. **NASA Global Landslide Catalog (GLC)** for event coordinates and dates.
2. **ERA5 Reanalysis** for antecedent rainfall.
3. **SRTM 30m DEM** + **OpenStreetMap** (Roads/Rivers).

## 13. Proposed ML Data Pipeline
```text
[NASA GLC] + [DFO Floods]
         ↓
Extract Lat/Lon + Date (Positive Labels)
         ↓
Spatiotemporal Negative Sampling (Generate 0s)
         ↓
Coordinate Batching
         ↓
[Google Earth Engine API] -> Extract DEM, NDVI, TWI
[ERA5 / Open-Meteo API]   -> Extract Rainfall (Day 0 to Day -7)
         ↓
Feature Engineering (e.g., 7-day cumulative rainfall)
         ↓
Temporal Train/Test Split (e.g., Train < 2018, Test >= 2018)
         ↓
Model Training (Random Forest vs XGBoost)
         ↓
Threshold Calibration (Maximize Recall)
         ↓
Export .joblib replacing existing ml/models/ artifacts
```

## 14. Exact Next Recommended Implementation Steps
1. **Data Acquisition Script:** Write a standalone Python script (using `pandas` and potentially `geopandas`) to download the NASA GLC CSV and filter for India/Western Ghats.
2. **Negative Sampling Logic:** Implement the script to generate safe negative points.
3. **Feature Hydration:** Write an integration with the Open-Meteo Historical Weather API or Google Earth Engine to pull rainfall and DEM data for the labeled coordinates.
4. **Offline Training:** Train the new models locally without touching the live FastAPI integration yet.
