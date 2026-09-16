# DisasterSense Machine Learning Engine

The ML subsystem powers DisasterSense's AI-assisted disaster risk assessment for **Flood Risk** and **Landslide Risk**.

---

## 🏗️ ML Architecture

```
ml/
├── data/                  # Raw & Processed ML dataset store
│   ├── raw/
│   └── processed/
├── models/                # Serialized model artifacts (.joblib, _meta.json)
│   ├── flood_v1.joblib
│   ├── flood_v1_meta.json
│   ├── landslide_v1.joblib
│   └── landslide_v1_meta.json
├── notebooks/             # Exploratory Data Analysis & experiments
├── src/                   # Production Python ML modules
│   ├── common/            # Configurable risk thresholds & categories
│   │   ├── config.py
│   │   └── risk_categories.py
│   ├── evaluation/        # Classification evaluation metrics (Accuracy, F1, ROC-AUC)
│   │   └── metrics.py
│   ├── flood/             # Flood risk feature schema & training pipeline
│   │   ├── flood_features.py
│   │   └── flood_pipeline.py
│   ├── landslide/         # Landslide risk feature schema & training pipeline
│   │   ├── landslide_features.py
│   │   └── landslide_pipeline.py
│   └── inference/         # Unified RiskEngine service
│       └── risk_engine.py
└── tests/                 # Comprehensive ML unit tests
    ├── test_flood_pipeline.py
    ├── test_landslide_pipeline.py
    └── test_risk_engine.py
```

---

## 🌊 1. Flood Risk Model

### Environmental Input Features (`FloodInputSchema`)
- `rainfall_mm_24h`: 24-hour accumulated rainfall (mm)
- `rainfall_intensity_mm_h`: Peak hourly rainfall intensity (mm/h)
- `rainfall_duration_h`: Continuous rainfall duration (hours)
- `temperature_c`: Ambient air temperature (°C)
- `humidity_pct`: Relative air humidity (%)
- `elevation_m`: Ground elevation above sea level (m)
- `slope_deg`: Terrain slope angle (degrees)
- `drainage_capacity_score`: Drainage infrastructure rating (0–10)
- `soil_saturation_pct`: Soil moisture / saturation percentage (%)
- `historical_flood_count`: Recorded past flood events
- `distance_to_river_m`: Proximity to nearest river/waterbody (m)

### Performance Metrics (V1 Random Forest)
- **Accuracy**: `95.83%`
- **ROC-AUC**: `0.9552`
- **Precision / Recall / F1**: > `0.94`

---

## ⛰️ 2. Landslide Risk Model

### Terrain & Geological Features (`LandslideInputSchema`)
- `rainfall_mm_24h`: 24-hour accumulated rainfall (mm)
- `rainfall_intensity_mm_h`: Peak hourly rainfall intensity (mm/h)
- `slope_deg`: Terrain slope angle (degrees)
- `elevation_m`: Ground elevation above sea level (m)
- `soil_type_code`: Soil type classification (1=Clay, 2=Silt, 3=Sand, 4=Gravel, 5=Bedrock)
- `soil_moisture_pct`: Soil moisture percentage (%)
- `geological_stability_index`: Terrain stability index (0=Unstable, 10=Stable)
- `vegetation_cover_pct`: Forest/vegetation cover (%)
- `historical_landslide_count`: Recorded past landslides
- `road_cut_proximity_m`: Proximity to road excavation (m)

### Performance Metrics (V1 Random Forest)
- **Accuracy**: `93.75%`
- **ROC-AUC**: `0.9720`

---

## 🎯 3. Shared Risk Engine Interface

Inference is invoked via the `RiskEngine` singleton:

```python
from ml.src.inference.risk_engine import risk_engine
from ml.src.flood.flood_features import FloodInputSchema

# Manual Input Mode
input_data = FloodInputSchema(rainfall_mm_24h=140.0, elevation_m=15.0)
result = risk_engine.predict_flood(input_data=input_data, mode="manual")

# Response Schema
print(result.risk_score)    # e.g., 78.4 (Scale 0 - 100)
print(result.risk_level)    # "High"
print(result.severity)      # "high"
print(result.explanation)   # Feature impact breakdown
```

### Risk Category Thresholds (Configurable)
- **0 – 20**: `Very Low`
- **21 – 40**: `Low`
- **41 – 60**: `Moderate`
- **61 – 80**: `High`
- **81 – 100**: `Critical`

---

## 🧪 4. Running ML Tests

```powershell
python -m pytest ml/tests/ -v
```
