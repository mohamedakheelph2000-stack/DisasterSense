"""
Landslide Risk Prediction Model Training & Preprocessing Pipeline.

Generates realistic terrain/slope/geological training data (Wayanad/Western Ghats context),
trains a Scikit-Learn Random Forest / XGBoost model, computes evaluation metrics,
and exports model artifacts to `ml/models/landslide_v1.joblib`.
"""

import json
import os
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, List, Optional
import numpy as np

from ml.src.landslide.landslide_features import LandslideInputSchema
from ml.src.evaluation.metrics import EvaluationMetrics, calculate_binary_metrics


def generate_synthetic_landslide_data(
    num_samples: int = 1200, random_seed: int = 42
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate realistic synthetic training dataset for Landslide Risk prediction.

    Geological & Terrain relationships:
    - Steep slope (>25 deg) + high rainfall (>100mm) -> major landslide trigger.
    - Low geological stability index (<4.0) + high soil moisture (>70%) -> slope failure.
    - Sparse vegetation (<30%) removes root cohesion.
    - Road cut proximity (<200m) increases slope instability.
    """
    np.random.seed(random_seed)

    # 1. Feature distributions
    rainfall_24h = np.random.exponential(scale=60.0, size=num_samples)
    rainfall_intensity = rainfall_24h / np.random.uniform(2.0, 10.0, size=num_samples)
    slope = np.random.uniform(5.0, 55.0, size=num_samples)
    elevation = np.random.uniform(100.0, 2200.0, size=num_samples)
    soil_type = np.random.choice([1.0, 2.0, 3.0, 4.0, 5.0], size=num_samples, p=[0.3, 0.25, 0.2, 0.15, 0.1])
    soil_moisture = np.random.uniform(25.0, 99.0, size=num_samples)
    geo_stability = np.random.uniform(1.0, 9.5, size=num_samples)
    vegetation = np.random.uniform(10.0, 95.0, size=num_samples)
    hist_landslides = np.random.poisson(lam=1.2, size=num_samples)
    road_cut_dist = np.random.exponential(scale=500.0, size=num_samples)

    # Clamp values to valid domain bounds
    rainfall_24h = np.clip(rainfall_24h, 0.0, 800.0)
    rainfall_intensity = np.clip(rainfall_intensity, 0.0, 150.0)
    soil_moisture = np.clip(soil_moisture, 10.0, 100.0)
    road_cut_dist = np.clip(road_cut_dist, 10.0, 10000.0)

    # 2. Physics-based logit risk function
    logits = (
        (slope / 15.0)
        + (rainfall_24h / 70.0)
        + (soil_moisture / 40.0)
        - (geo_stability / 2.0)
        - (vegetation / 45.0)
        + (hist_landslides * 0.5)
        - (np.log1p(road_cut_dist) * 0.35)
        - 1.5
    )

    probs = 1.0 / (1.0 + np.exp(-logits))
    labels = (probs >= 0.5).astype(int)

    X = np.column_stack([
        rainfall_24h,
        rainfall_intensity,
        slope,
        elevation,
        soil_type,
        soil_moisture,
        geo_stability,
        vegetation,
        hist_landslides,
        road_cut_dist,
    ])

    return X, labels


def compute_heuristic_landslide_score(input_data: LandslideInputSchema) -> float:
    """
    Physics-based heuristic fallback algorithm for Landslide Risk Score [0, 100].

    Used when ML model artifacts are absent or during cold-start.
    """
    slope_factor = (input_data.slope_deg / 60.0) * 30.0
    rf_factor = min(1.0, input_data.rainfall_mm_24h / 250.0) * 25.0
    moisture_factor = (input_data.soil_moisture_pct / 100.0) * 15.0
    geo_factor = (10.0 - input_data.geological_stability_index) * 2.0
    veg_factor = (100.0 - input_data.vegetation_cover_pct) * 0.10
    road_factor = max(0.0, (1000.0 - input_data.road_cut_proximity_m) / 1000.0) * 10.0

    raw_score = slope_factor + rf_factor + moisture_factor + geo_factor + veg_factor + road_factor
    return float(np.clip(raw_score, 0.0, 100.0))


def train_landslide_model(
    output_dir: str = "ml/models",
    num_samples: int = 1200,
) -> Tuple[Any, EvaluationMetrics, Dict[str, Any]]:
    """
    Train and export Landslide risk prediction model.

    Saves:
    - {output_dir}/landslide_v1.joblib
    - {output_dir}/landslide_v1_meta.json
    """
    os.makedirs(output_dir, exist_ok=True)
    import joblib
    from sklearn.ensemble import RandomForestClassifier

    X, y = generate_synthetic_landslide_data(num_samples=num_samples)

    # Train/Test Split (80/20)
    split_idx = int(0.8 * len(X))
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        random_state=42,
    )
    model.fit(X_train, y_train)

    # Predict test probabilities and classes
    y_probs = model.predict_proba(X_test)[:, 1]
    y_preds = (y_probs >= 0.5).astype(int)

    timestamp_str = datetime.now(timezone.utc).isoformat()
    metrics = calculate_binary_metrics(
        y_true=y_test.tolist(),
        y_pred=y_preds.tolist(),
        y_prob=y_probs.tolist(),
        timestamp_str=timestamp_str,
    )

    feature_names = LandslideInputSchema.feature_names()
    feature_importances = dict(zip(feature_names, [round(float(fi), 4) for fi in model.feature_importances_]))

    metadata = {
        "model_name": "landslide_risk_random_forest",
        "model_version": "v1.0.0",
        "trained_at": timestamp_str,
        "feature_names": feature_names,
        "feature_importances": feature_importances,
        "evaluation_metrics": metrics.model_dump(),
    }

    model_path = os.path.join(output_dir, "landslide_v1.joblib")
    meta_path = os.path.join(output_dir, "landslide_v1_meta.json")

    joblib.dump(model, model_path)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return model, metrics, metadata
