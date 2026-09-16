# DisasterSense: Real Model Integration (Phase 19)

This document explains how the experimental `real-v1` Machine Learning models were integrated into the `RiskEngine` architecture.

## 1. Model Registry
The RiskEngine now manages three distinct tiers of logic. Artifacts are safely decoupled from the codebase logic to allow zero-downtime swaps.
- **Tier 1 (Real Models)**: Located in `ml/models/experiments/`. Trained on genuine empirical weather/elevation data from the `real-v1` Kerala dataset.
- **Tier 2 (Synthetic Models)**: Located in `ml/models/`. Trained on `v1` synthetic data.
- **Tier 3 (Heuristic Models)**: Baked directly into code. Basic physics rules used when ML artifacts are missing.

### Selected Models
- **Flood**: `flood_logisticregression_real_v1.joblib` (Chosen for high recall and perfect linear explainability).
- **Landslide**: `landslide_randomforest_real_v1.joblib` (Chosen for identifying complex non-linear boundaries where linear models failed).

## 2. Feature Contracts
The Real Models enforce a strict feature requirement contract. They will ONLY execute if every required feature is provided in the input payload.

- **Flood**: `rainfall_mm_24h`, `rainfall_intensity_mm_h`, `antecedent_rainfall_7d_mm`, `temperature_c`, `humidity_pct`, `elevation_m`
- **Landslide**: `rainfall_mm_24h`, `rainfall_intensity_mm_h`, `antecedent_rainfall_7d_mm`, `temperature_c`, `humidity_pct`, `elevation_m`

> [!IMPORTANT]  
> The Real Landslide model deliberately excludes `slope_deg` because current external point-APIs fail to provide localized steepness (returning 0.0), which would poison the decision boundary. The legacy synthetic model still requires `slope_deg`.

## 3. Inference Hierarchy (Fallback Strategy)
The `RiskEngine` operates a strict safety hierarchy:
1. Try Real Model. If missing features or missing artifact -> Fallback.
2. Try Synthetic Model. If missing artifact -> Fallback.
3. Execute Heuristic Rules.

At no point will the engine invent missing required features or substitute them. If the user doesn't provide `antecedent_rainfall_7d_mm`, the Real Model is bypassed.

## 4. Probability to Risk Score Conversion
Both real and synthetic models output a calibrated physical probability between `[0.0, 1.0]`. 
This is converted to the public-facing `Risk Score` (0-100) using a deterministic linear mapping:
`Risk Score = probability * 100`

## 5. Missing Data Behavior
If an API consumer hits `POST /api/v1/risk-assessments/flood` and omits a field required by the Real Model, the response will transparently indicate the fallback mechanism via the newly exposed `inference_source` metadata:
```json
{
  "hazard_type": "flood",
  "risk_score": 75.0,
  "inference_source": "synthetic_model",
  "model_version": "v1.0.0"
}
```

## 6. Explainability
Feature Impacts are derived sequentially:
1. Real Logistic Regression utilizes absolute coefficient weights.
2. Real Random Forest utilizes Gini impurity feature importances.
3. Fallback Heuristics utilize hardcoded static expert weights.

## 7. Known Limitations
> [!WARNING]  
> The Real Models are highly experimental and derived from a severely constrained dataset (`real-v1` Kerala Historical Events, N=~45). They must not be considered production-grade early warning systems for regions outside the Western Ghats topology until Phase 20 scales the dataset nationally.

## 8. Dataset Version
The `dataset_version` field has been added to the API response metadata to explicitly track which model generation handled the request (e.g., `real-v1`).
