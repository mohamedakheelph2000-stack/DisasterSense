# DisasterSense: Real Training Dataset v1

This document describes the scale-up and construction of the `real-v1` training datasets for the DisasterSense machine learning engine.

## 1. Dataset Sources
- **Flood Positives**: Global Flood Database (GFD v1.4). We acquired a verified 15-event subset from the 2018-2021 Kerala monsoons (e.g., Chengannur, Chalakudy).
- **Landslide Positives**: NASA Global Landslide Catalog (COOLR). We acquired a verified 15-event subset representing catastrophic rainfall-triggered landslides in the Western Ghats (e.g., Puthumala, Pettimudi).
- **Meteorology**: Open-Meteo ERA5 Historical Archive.
- **Topography**: Open-Elevation (SRTM 30m) API.

## 2. Data Acquisition
The dataset was built using `ml/src/data/build_datasets.py`, which:
1. Loads the exact source event IDs and coordinates.
2. Queries Open-Meteo for the 7-day weather preceding each event.
3. Queries Open-Elevation for point elevation.
4. Drops any row where a live API call failed/timed out to ensure absolute data purity.

## 3. Feature Engineering
The final schema differs based on hazard type. Note that synthetic/mocked features were intentionally discarded.

**Flood Schema**:
- `rainfall_mm_24h` (Direct)
- `rainfall_intensity_mm_h` (Direct)
- `antecedent_rainfall_7d_mm` (Derived)
- `temperature_c` (Direct)
- `humidity_pct` (Direct)
- `elevation_m` (Direct)
*(Note: `drainage_capacity_score` omitted. Live models will need updating).*

**Landslide Schema**:
- `rainfall_mm_24h` (Direct)
- `rainfall_intensity_mm_h` (Direct)
- `antecedent_rainfall_7d_mm` (Derived)
- `temperature_c` (Direct)
- `humidity_pct` (Direct)
- `elevation_m` (Direct)
- `slope_deg` (Currently mapped to 0.0/Unavailable due to point-API limitations. Will require full local DEM rasterization in future iterations).
*(Note: `geological_stability_index` and `soil_saturation_index` omitted. Live models will need updating).*

## 4. Label Construction
All 30 genuine events are tagged with `label = 1`. Their exact `event_time` (truncated to the day/hour of highest damage) serves as the anchor point.

## 5. Negative Sampling
To provide a balanced dataset, `generate_negative_samples` created two `label = 0` candidates per positive event via spatial shifts (100km away) or temporal shifts (180 days away).
- **Validation**: Every candidate was rigorously checked against the entire known positive catalog. Candidates falling within 50km and 7 days of a known event were rejected.
- **Meaning**: A negative label means "No known catastrophic event exists in the available reference catalog for this specific coordinate and time."

## 6. Data Quality
- **Missing Data**: No missing numeric data exists in the final CSVs. API dropouts resulted in whole-row deletion.
- **Duplicates**: The Pydantic validator guarantees zero `event_id` overlap.

## 7. Leakage Prevention
- **Temporal Leakage**: Features are calculated *only* using data from `T-7 days` to `T=0`. Future weather is inaccessible.
- **Data Leakage**: Train, Validation, and Test datasets were explicitly separated by year, meaning test events represent genuinely unseen future storms.

## 8. Dataset Statistics
- **Total Rows**: 88 rows (due to 2 API timeouts during negative sampling generation).
- **Flood Dataset**: 44 rows (15 positive, 29 negative).
- **Landslide Dataset**: 44 rows (15 positive, 29 negative).

## 9. Train / Validation / Test Strategy
To simulate real-world deployment accurately, a **Temporal Split** was used instead of random row splitting:
- **Train Split**: All events occurring in or before 2018 (The great 2018 Kerala floods).
- **Validation Split**: All events occurring in 2019.
- **Test Split**: All events occurring in 2020 and 2021.

## 10. Limitations
- **Slope Generation**: True slope calculation requires downloading massive local GeoTIFF tiles, which was skipped here. The Landslide dataset currently lacks meaningful slope variation.
- **Dataset Size**: To prevent API rate limits and long CI/CD runs, the catalog is constrained to 30 highly representative events.

## 11. Reproducibility
- To regenerate, run `python ml/src/data/build_datasets.py` from the root directory. Results may vary slightly depending on exact Open-Meteo interpolation grids over time.

## 12. Licensing / Attribution
- NASA GLC (Public Domain)
- GFD (CC BY 4.0)
- ERA5 (Copernicus / Open Data)
- Open-Elevation (GPLv2)

## 13. Dataset Version
**Version:** `real-v1`
**Output Location:** `ml/data/processed/dataset_manifest.json`
