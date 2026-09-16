"""
Flood Risk Prediction Model Training & Preprocessing Pipeline.

Generates realistic environmental training data (Kerala/Wayanad context),
trains a Scikit-Learn Random Forest / XGBoost model, computes evaluation metrics,
and exports model artifacts to `ml/models/flood_v1.joblib`.
"""

import json
import os
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, List, Optional
import numpy as np

from ml.src.flood.flood_features import FloodInputSchema
from ml.src.evaluation.metrics import EvaluationMetrics, calculate_binary_metrics


def generate_synthetic_flood_data(
    num_samples: int = 1200, random_seed: int = 42
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate realistic synthetic training dataset for Flood Risk prediction.

    Physics-grounded relationships:
    - High rainfall (>100mm) + low elevation (<50m) + poor drainage -> high flood probability.
    - Steep slope (>15 deg) accelerates runoff into lowlands.
    - Soil saturation (>75%) reduces absorption.
    - Close river proximity (<300m) multiplies flood risk.
    """
    np.random.seed(random_seed)

    # 1. Feature distributions
    rainfall_24h = np.random.exponential(scale=50.0, size=num_samples)
    rainfall_intensity = rainfall_24h / np.random.uniform(2.0, 12.0, size=num_samples)
    duration = np.random.uniform(1.0, 48.0, size=num_samples)
    temp = np.random.normal(loc=27.0, scale=4.0, size=num_samples)
    humidity = np.random.uniform(50.0, 98.0, size=num_samples)
    elevation = np.random.exponential(scale=80.0, size=num_samples)
    slope = np.random.exponential(scale=8.0, size=num_samples)
    drainage = np.random.uniform(1.0, 10.0, size=num_samples)
    soil_sat = np.random.uniform(20.0, 99.0, size=num_samples)
    hist_floods = np.random.poisson(lam=1.5, size=num_samples)
    river_dist = np.random.exponential(scale=800.0, size=num_samples)

    # Clamp values to valid domain bounds
    rainfall_24h = np.clip(rainfall_24h, 0.0, 800.0)
    rainfall_intensity = np.clip(rainfall_intensity, 0.0, 150.0)
    elevation = np.clip(elevation, 1.0, 3000.0)
    slope = np.clip(slope, 0.1, 60.0)
    soil_sat = np.clip(soil_sat, 10.0, 100.0)
    river_dist = np.clip(river_dist, 10.0, 20000.0)

    # 2. Physics-based logit risk function
    logits = (
        (rainfall_24h / 60.0)
        + (rainfall_intensity / 20.0)
        + (soil_sat / 35.0)
        - (elevation / 60.0)
        - (drainage / 2.5)
        + (hist_floods * 0.4)
        - (np.log1p(river_dist) * 0.4)
        - 1.2
    )

    probs = 1.0 / (1.0 + np.exp(-logits))
    labels = (probs >= 0.5).astype(int)

    X = np.column_stack([
        rainfall_24h,
        rainfall_intensity,
        duration,
        temp,
        humidity,
        elevation,
        slope,
        drainage,
        soil_sat,
        hist_floods,
        river_dist,
    ])

    return X, labels


def compute_heuristic_flood_score(input_data: FloodInputSchema) -> float:
    """
    Physics-based heuristic fallback algorithm for Flood Risk Score [0, 100].

    Used when ML model artifacts are absent or during cold-start.
    """
    rf_factor = min(1.0, input_data.rainfall_mm_24h / 250.0) * 35.0
    intensity_factor = min(1.0, input_data.rainfall_intensity_mm_h / 80.0) * 15.0
    elevation_factor = max(0.0, (100.0 - input_data.elevation_m) / 100.0) * 20.0
    drainage_factor = (10.0 - input_data.drainage_capacity_score) * 1.5
    soil_factor = (input_data.soil_saturation_pct / 100.0) * 15.0
    river_factor = max(0.0, (2000.0 - input_data.distance_to_river_m) / 2000.0) * 10.0

    raw_score = rf_factor + intensity_factor + elevation_factor + drainage_factor + soil_factor + river_factor
    return float(np.clip(raw_score, 0.0, 100.0))


def train_flood_model(
    output_dir: str = "ml/models",
    num_samples: int = 1200,
) -> Tuple[Any, EvaluationMetrics, Dict[str, Any]]:
    """
    Train and export Flood risk prediction model.

    Saves:
    - {output_dir}/flood_v1.joblib
    - {output_dir}/flood_v1_meta.json
    """
    os.makedirs(output_dir, exist_ok=True)
    import joblib
    from sklearn.ensemble import RandomForestClassifier

    X, y = generate_synthetic_flood_data(num_samples=num_samples)

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

    feature_names = FloodInputSchema.feature_names()
    feature_importances = dict(zip(feature_names, [round(float(fi), 4) for fi in model.feature_importances_]))

    metadata = {
        "model_name": "flood_risk_random_forest",
        "model_version": "v1.0.0",
        "trained_at": timestamp_str,
        "feature_names": feature_names,
        "feature_importances": feature_importances,
        "evaluation_metrics": metrics.model_dump(),
    }

    model_path = os.path.join(output_dir, "flood_v1.joblib")
    meta_path = os.path.join(output_dir, "flood_v1_meta.json")

    joblib.dump(model, model_path)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return model, metrics, metadata
