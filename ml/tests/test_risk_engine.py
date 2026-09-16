"""
Unit tests for unified RiskEngine inference service, dual input modes, and fallback handling.
"""

import pytest

from ml.src.inference.risk_engine import RiskEngine, RiskAssessmentResult
from ml.src.flood.flood_features import FloodInputSchema
from ml.src.landslide.landslide_features import LandslideInputSchema
from ml.src.common.risk_categories import (
    RiskLevel,
    score_to_risk_level,
    DEFAULT_THRESHOLDS,
    RiskThresholdConfig,
)


class TestRiskCategories:
    """Test suite for risk thresholds and category mappings."""

    def test_score_to_risk_level_mapping(self):
        assert score_to_risk_level(10.0) == RiskLevel.VERY_LOW
        assert score_to_risk_level(30.0) == RiskLevel.LOW
        assert score_to_risk_level(50.0) == RiskLevel.MODERATE
        assert score_to_risk_level(70.0) == RiskLevel.HIGH
        assert score_to_risk_level(90.0) == RiskLevel.CRITICAL

    def test_custom_threshold_config(self):
        custom = RiskThresholdConfig(very_low_max=10.0, low_max=30.0, moderate_max=50.0, high_max=70.0)
        assert score_to_risk_level(25.0, thresholds=custom) == RiskLevel.LOW
        assert score_to_risk_level(75.0, thresholds=custom) == RiskLevel.CRITICAL


class TestRiskEngineInference:
    """Test suite for RiskEngine unified inference."""

    @pytest.fixture
    def engine(self):
        return RiskEngine(models_dir="ml/models")

    def test_predict_flood_manual_mode(self, engine):
        inp = FloodInputSchema(rainfall_mm_24h=120.0, elevation_m=20.0)
        res = engine.predict_flood(input_data=inp, mode="manual")

        assert isinstance(res, RiskAssessmentResult)
        assert res.hazard_type == "flood"
        assert 0.0 <= res.risk_score <= 100.0
        assert 0.0 <= res.probability <= 1.0
        assert res.mode == "manual"
        assert len(res.explanation) > 0
        assert res.severity in ("low", "moderate", "high", "critical")
        assert res.inference_source in ["real_model", "synthetic_model", "heuristic"]

    def test_predict_flood_automatic_mode(self, engine):
        res = engine.predict_flood(input_data=None, mode="automatic")

        assert isinstance(res, RiskAssessmentResult)
        assert res.hazard_type == "flood"
        assert res.mode == "automatic"
        assert res.inference_source in ["real_model", "synthetic_model", "heuristic"]

    def test_predict_landslide_manual_mode(self, engine):
        inp = LandslideInputSchema(slope_deg=40.0, rainfall_mm_24h=150.0)
        res = engine.predict_landslide(input_data=inp, mode="manual")

        assert isinstance(res, RiskAssessmentResult)
        assert res.hazard_type == "landslide"
        assert 0.0 <= res.risk_score <= 100.0
        assert 0.0 <= res.probability <= 1.0
        assert res.mode == "manual"
        assert len(res.explanation) > 0
        assert res.inference_source in ["real_model", "synthetic_model", "heuristic"]

    def test_predict_landslide_automatic_mode(self, engine):
        res = engine.predict_landslide(input_data=None, mode="automatic")

        assert isinstance(res, RiskAssessmentResult)
        assert res.hazard_type == "landslide"
        assert res.mode == "automatic"
        assert res.inference_source in ["real_model", "synthetic_model", "heuristic"]

    def test_missing_models_dir_fallback(self):
        fallback_engine = RiskEngine(models_dir="ml/non_existent_directory")
        res = fallback_engine.predict_flood(mode="manual")

        assert isinstance(res, RiskAssessmentResult)
        assert "heuristic" in res.model_version
        assert 0.0 <= res.risk_score <= 100.0
