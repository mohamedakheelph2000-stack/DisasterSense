"""
Unit tests for Landslide Risk Prediction feature schema, synthetic data, and training pipeline.
"""

import pytest
from pydantic import ValidationError

from ml.src.landslide.landslide_features import LandslideInputSchema
from ml.src.landslide.landslide_pipeline import (
    generate_synthetic_landslide_data,
    compute_heuristic_landslide_score,
    train_landslide_model,
)
from ml.src.common.risk_categories import score_to_risk_level, RiskLevel


class TestLandslideFeatures:
    """Test suite for LandslideInputSchema validation."""

    def test_default_landslide_input_is_valid(self):
        schema = LandslideInputSchema()
        assert schema.slope_deg == 32.0
        assert schema.rainfall_mm_24h == 85.0
        assert len(schema.to_feature_vector()) == 10

    def test_slope_out_of_bounds_raises(self):
        with pytest.raises(ValidationError):
            LandslideInputSchema(slope_deg=95.0)

    def test_soil_moisture_out_of_bounds_raises(self):
        with pytest.raises(ValidationError):
            LandslideInputSchema(soil_moisture_pct=150.0)


class TestLandslidePipeline:
    """Test suite for synthetic data generation, heuristic fallback, and training."""

    def test_synthetic_data_shape_and_labels(self):
        X, y = generate_synthetic_landslide_data(num_samples=100)
        assert X.shape == (100, 10)
        assert len(y) == 100
        assert set(y).issubset({0, 1})

    def test_heuristic_landslide_score_range(self):
        inp = LandslideInputSchema(
            slope_deg=48.0,
            rainfall_mm_24h=250.0,
            soil_moisture_pct=90.0,
            geological_stability_index=1.5,
            vegetation_cover_pct=10.0,
            road_cut_proximity_m=50.0,
        )
        score = compute_heuristic_landslide_score(inp)
        assert 0.0 <= score <= 100.0
        assert score > 60.0
        level = score_to_risk_level(score)
        assert level in (RiskLevel.HIGH, RiskLevel.CRITICAL)

    def test_train_landslide_model_returns_metrics(self, tmp_path):
        model, metrics, metadata = train_landslide_model(
            output_dir=str(tmp_path),
            num_samples=200,
        )
        assert model is not None
        assert metrics.accuracy > 0.70
        assert metrics.roc_auc > 0.70
        assert "feature_importances" in metadata
        assert (tmp_path / "landslide_v1.joblib").exists()
        assert (tmp_path / "landslide_v1_meta.json").exists()
