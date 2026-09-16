# ML Intelligence Center v1

## Overview
The ML Intelligence Center provides a transparent, read-only interface for evaluating the operational status, accuracy, and logic of the Machine Learning models deployed in DisasterSense. It aims to demystify "black box" algorithms for administrators and responders.

## Integrated Models
DisasterSense utilizes a tiered inference hierarchy:
1. **Real Models**: Trained on empirical (but currently small) datasets.
2. **Synthetic Models**: Baseline algorithms trained on synthetic, larger-scale generated data.
3. **Heuristic Fallback**: Deterministic rule-based scoring if all ML models fail or if input data is severely truncated.

### Flood Risk Engine
- **Algorithm**: Logistic Regression (currently selected)
- **Dataset**: `real-v1`
- **Feature Set**: `rainfall_mm_24h`, `rainfall_intensity_mm_h`, `antecedent_rainfall_7d_mm`, `temperature_c`, `humidity_pct`, `elevation_m`
- **Inference Source**: `real_model`

### Landslide Risk Engine
- **Algorithm**: Random Forest (currently selected)
- **Dataset**: `real-v1`
- **Feature Set**: `rainfall_mm_24h`, `rainfall_intensity_mm_h`, `antecedent_rainfall_7d_mm`, `temperature_c`, `humidity_pct`, `elevation_m`
- **Important Note**: `slope_deg` is explicitly omitted from the `real-v1` landslide model feature contract due to data unreliability/availability during training.
- **Inference Source**: `real_model`

## Evaluation Methodology
Models are evaluated against a holdout test split. 
- **Metrics Tracked**: Accuracy, Precision, Recall, F1 Score, ROC-AUC, Confusion Matrix.
- **Algorithm Comparison**: Multiple algorithms (Random Forest, XGBoost, Logistic Regression) are evaluated concurrently. The "best" model is flagged in metadata and selected for production inference.
- **Metrics Sourcing**: Metrics are read statically from `ml/models/experiments/*_metadata.json` or `ml/models/*_meta.json`. 

## Feature Importance Methodology
- Tree-based algorithms (Random Forest) use Gini impurity/information gain (`feature_importances_`).
- Linear models (Logistic Regression) use normalized absolute coefficients.
- The UI exposes these as percentage impacts on a horizontal bar chart. **Important**: These represent internal model feature weights, and MUST NOT be construed as true causal effects or real-world physical attributions.

## Dataset Limitations
- **Size**: The current `real-v1` dataset is extremely small (academic prototype scope, ~45 rows total per hazard).
- **Quality**: Derived negative samples are used, which are not strictly equivalent to confirmed non-disaster observations.
- **Coverage**: Geographic scope is currently limited to Wayanad District, Kerala.
- **Metrics Warning**: Perfect or near-perfect metrics (e.g., 1.0 F1 Score) on this small holdout set indicate severe dataset limitations (high variance, small sample bias) rather than production-ready generalization.

## Role Visibility & Security
- **Citizen**: Receives simplified explanations during risk assessments (e.g., Model Name, Dataset Version). Internal metrics are abstracted. The `/ml-intelligence` dashboard is entirely restricted.
- **Responder / Admin**: Granted full access to the `/ml-intelligence` dashboard via backend API role enforcement (`RequireRole([UserRole.ADMIN, UserRole.RESPONDER])`).

## API Endpoints
All endpoints are secured via JWT authentication.
- `GET /api/v1/ml/status`: High-level summary of currently loaded models and fallback states.
- `GET /api/v1/ml/evaluation/{hazard}`: Detailed evaluation metrics and feature importance.
- `GET /api/v1/ml/experiments/{hazard}`: Comparison metrics across evaluated algorithms.

*Note: No APIs exist to upload, replace, or directly interface with the raw `.joblib` model binaries. File paths are strictly redacted.*
