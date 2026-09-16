"""
Unified Disaster Risk Engine Inference Service.

Provides a standardized interface for Flood and Landslide risk prediction:
- `predict_flood(...)`
- `predict_landslide(...)`

Handles model loading, feature scaling, inference, risk score calculation (0–100),
risk level mapping, feature importance explanations, and dual input modes (Manual vs Automatic).
"""

import json
import os
import numpy as np
import logging
from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, Field

from ml.src.flood.flood_features import FloodInputSchema
from ml.src.landslide.landslide_features import LandslideInputSchema
from ml.src.flood.flood_pipeline import compute_heuristic_flood_score
from ml.src.landslide.landslide_pipeline import compute_heuristic_landslide_score
from ml.src.common.risk_categories import (
    RiskLevel,
    score_to_risk_level,
    risk_level_to_severity,
)

logger = logging.getLogger(__name__)


class FeatureExplanationItem(BaseModel):
    """Container for individual feature impact explanation."""
    feature: str = Field(..., description="Feature variable name")
    value: float = Field(..., description="Observed input feature value")
    importance: float = Field(..., description="Model feature importance weight [0, 1]")
    impact_level: str = Field(..., description="Qualitative impact ('High', 'Moderate', 'Low')")


class RiskAssessmentResult(BaseModel):
    """
    Standardized inference response schema for both Flood and Landslide risk predictions.
    """
    model_config = {"protected_namespaces": ()}

    hazard_type: str = Field(..., description="Hazard type ('flood' or 'landslide')")
    risk_score: float = Field(..., description="Normalized risk score [0.0, 100.0]")
    risk_level: RiskLevel = Field(..., description="Categorical risk level enum")
    severity: str = Field(..., description="Database severity level ('low', 'moderate', 'high', 'critical')")
    probability: float = Field(..., description="Calculated risk probability [0.0, 1.0]")
    model_name: str = Field(..., description="Model architecture identifier")
    model_version: str = Field(..., description="Model version tag")
    dataset_version: Optional[str] = Field(None, description="Dataset version")
    inference_source: str = Field(..., description="'real_model', 'synthetic_model', or 'heuristic'")
    mode: str = Field(..., description="Execution mode ('manual' or 'automatic')")
    features_used: Dict[str, float] = Field(..., description="Dictionary of input features evaluated")
    explanation: List[FeatureExplanationItem] = Field(..., description="Ranked feature impact explanations")


class RiskEngine:
    """
    Core Risk Engine service with tiered inference hierarchy:
    1. Real Models (experimental, empirical data)
    2. Synthetic Models (legacy)
    3. Heuristic Models (fallback rules)
    """

    def __init__(self, models_dir: str = "ml/models"):
        self.models_dir = models_dir
        self.experiments_dir = os.path.join(models_dir, "experiments")
        
        self._real_flood_model = None
        self._real_flood_meta = None
        self._real_landslide_model = None
        self._real_landslide_meta = None
        
        self._flood_model = None
        self._flood_meta = None
        self._landslide_model = None
        self._landslide_meta = None
        
        self._load_artifacts()

    def _load_artifacts(self) -> None:
        """Attempt to load real and synthetic models safely."""
        import joblib
        
        # Load Real Models (Tier 1)
        try:
            r_flood_path = os.path.join(self.experiments_dir, "flood_logisticregression_real_v1.joblib")
            r_flood_meta_path = os.path.join(self.experiments_dir, "flood_logisticregression_real_v1_metadata.json")
            if os.path.exists(r_flood_path) and os.path.exists(r_flood_meta_path):
                self._real_flood_model = joblib.load(r_flood_path)
                with open(r_flood_meta_path, "r", encoding="utf-8") as f:
                    self._real_flood_meta = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load real flood model: {e}")

        try:
            r_landslide_path = os.path.join(self.experiments_dir, "landslide_randomforest_real_v1.joblib")
            r_landslide_meta_path = os.path.join(self.experiments_dir, "landslide_randomforest_real_v1_metadata.json")
            if os.path.exists(r_landslide_path) and os.path.exists(r_landslide_meta_path):
                self._real_landslide_model = joblib.load(r_landslide_path)
                with open(r_landslide_meta_path, "r", encoding="utf-8") as f:
                    self._real_landslide_meta = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load real landslide model: {e}")
            
        # Load Synthetic Models (Tier 2)
        try:
            flood_path = os.path.join(self.models_dir, "flood_v1.joblib")
            flood_meta_path = os.path.join(self.models_dir, "flood_v1_meta.json")
            if os.path.exists(flood_path) and os.path.exists(flood_meta_path):
                self._flood_model = joblib.load(flood_path)
                with open(flood_meta_path, "r", encoding="utf-8") as f:
                    self._flood_meta = json.load(f)

            landslide_path = os.path.join(self.models_dir, "landslide_v1.joblib")
            landslide_meta_path = os.path.join(self.models_dir, "landslide_v1_meta.json")
            if os.path.exists(landslide_path) and os.path.exists(landslide_meta_path):
                self._landslide_model = joblib.load(landslide_path)
                with open(landslide_meta_path, "r", encoding="utf-8") as f:
                    self._landslide_meta = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load synthetic models: {e}")

    def _has_required_features(self, input_dict: dict, required_features: list) -> bool:
        """Check if all required real-model features are present and not None."""
        return all(f in input_dict and input_dict[f] is not None for f in required_features)

    def predict_flood(
        self,
        input_data: Optional[FloodInputSchema] = None,
        mode: str = "manual",
    ) -> RiskAssessmentResult:
        if input_data is None:
            input_data = FloodInputSchema()
            mode = "automatic"

        features_dict = input_data.model_dump()
        
        # 1. Try Real Model
        if self._real_flood_model and self._real_flood_meta:
            req_features = self._real_flood_meta.get("feature_list", [])
            if self._has_required_features(features_dict, req_features):
                X_in = np.array([[features_dict[f] for f in req_features]])
                prob = float(self._real_flood_model.predict_proba(X_in)[0, 1])
                score = round(prob * 100.0, 2)
                return self._build_result("flood", score, prob, self._real_flood_meta, "real_model", mode, features_dict, req_features)
        
        # 2. Try Synthetic Model
        if self._flood_model and self._flood_meta:
            req_features = FloodInputSchema.feature_names()
            feature_vector = input_data.to_feature_vector()
            X_in = np.array([feature_vector])
            prob = float(self._flood_model.predict_proba(X_in)[0, 1])
            score = round(prob * 100.0, 2)
            return self._build_result("flood", score, prob, self._flood_meta, "synthetic_model", mode, features_dict, req_features)
            
        # 3. Fallback Heuristic
        score = round(compute_heuristic_flood_score(input_data), 2)
        prob = round(score / 100.0, 4)
        meta = {
            "model_name": "flood_risk_heuristic_fallback",
            "model_version": "v1.0.0-heuristic",
            "feature_importance": {
                "rainfall_mm_24h": 0.35, "elevation_m": 0.20, "drainage_capacity_score": 0.15,
                "rainfall_intensity_mm_h": 0.15, "soil_saturation_pct": 0.15
            }
        }
        return self._build_result("flood", score, prob, meta, "heuristic", mode, features_dict, FloodInputSchema.feature_names())

    def predict_landslide(
        self,
        input_data: Optional[LandslideInputSchema] = None,
        mode: str = "manual",
    ) -> RiskAssessmentResult:
        if input_data is None:
            input_data = LandslideInputSchema()
            mode = "automatic"

        features_dict = input_data.model_dump()
        
        # 1. Try Real Model (Random Forest)
        if self._real_landslide_model and self._real_landslide_meta:
            req_features = self._real_landslide_meta.get("feature_list", [])
            if self._has_required_features(features_dict, req_features):
                X_in = np.array([[features_dict[f] for f in req_features]])
                prob = float(self._real_landslide_model.predict_proba(X_in)[0, 1])
                score = round(prob * 100.0, 2)
                return self._build_result("landslide", score, prob, self._real_landslide_meta, "real_model", mode, features_dict, req_features)

        # 2. Try Synthetic Model
        if self._landslide_model and self._landslide_meta:
            req_features = LandslideInputSchema.feature_names()
            feature_vector = input_data.to_feature_vector()
            X_in = np.array([feature_vector])
            prob = float(self._landslide_model.predict_proba(X_in)[0, 1])
            score = round(prob * 100.0, 2)
            return self._build_result("landslide", score, prob, self._landslide_meta, "synthetic_model", mode, features_dict, req_features)

        # 3. Fallback Heuristic
        score = round(compute_heuristic_landslide_score(input_data), 2)
        prob = round(score / 100.0, 4)
        meta = {
            "model_name": "landslide_risk_heuristic_fallback",
            "model_version": "v1.0.0-heuristic",
            "feature_importance": {
                "slope_deg": 0.30, "rainfall_mm_24h": 0.25, "soil_moisture_pct": 0.15,
                "geological_stability_index": 0.15, "vegetation_cover_pct": 0.15
            }
        }
        return self._build_result("landslide", score, prob, meta, "heuristic", mode, features_dict, LandslideInputSchema.feature_names())

    def _build_result(self, hazard_type: str, score: float, prob: float, meta: dict, inf_source: str, mode: str, features_dict: dict, feature_names: list) -> RiskAssessmentResult:
        risk_lvl = score_to_risk_level(score)
        sev = risk_level_to_severity(risk_lvl)
        
        importances = meta.get("feature_importance", {})
        if not importances:
            importances = meta.get("feature_importances", {}) # Legacy support
            
        explanations: List[FeatureExplanationItem] = []
        for name in feature_names:
            val = float(features_dict.get(name, 0.0))
            weight = float(importances.get(name, 0.05))
            # Normalize impact text
            impact = "High" if weight >= 0.15 else "Moderate" if weight >= 0.08 else "Low"
            explanations.append(FeatureExplanationItem(feature=name, value=val, importance=round(weight, 4), impact_level=impact))

        explanations.sort(key=lambda x: x.importance, reverse=True)

        return RiskAssessmentResult(
            hazard_type=hazard_type,
            risk_score=score,
            risk_level=risk_lvl,
            severity=sev,
            probability=prob,
            model_name=meta.get("model_name", "unknown"),
            model_version=meta.get("model_version", "unknown"),
            dataset_version=meta.get("dataset_version", None),
            inference_source=inf_source,
            mode=mode,
            features_used={name: features_dict.get(name, 0.0) for name in feature_names},
            explanation=explanations,
        )

# Module-level singleton engine
risk_engine = RiskEngine()
