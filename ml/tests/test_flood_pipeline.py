"""
Unit tests for Flood Risk Prediction feature schema, synthetic data, and training pipeline.
"""

import pytest
from pydantic import ValidationError

from ml.src.flood.flood_features import FloodInputSchema
from ml.src.flood.flood_pipeline import (
    generate_synthetic_flood_data,
    compute_heuristic_flood_score,
    train_flood_model,
)
from ml.src.common.risk_categories import score_to_risk_level, RiskLevel


class TestFloodFeatures:
    """Test suite for FloodInputSchema validation."""

    def test_default_flood_input_is_valid(self):
        schema = FloodInputSchema()
        assert schema.rainfall_mm_24h == 45.0
        assert schema.elevation_m == 35.0
        assert len(schema.to_feature_vector()) == 11

    def test_rainfall_out_of_bounds_raises(self):
        with pytest.raises(ValidationError):
            FloodInputSchema(rainfall_mm_24h=-10.0)

    def test_drainage_score_out_of_bounds_raises(self):
        with pytest.raises(ValidationError):
            FloodInputSchema(drainage_capacity_score=15.0)

    def test_elevation_out_of_bounds_raises(self):
        with pytest.raises(ValidationError):
            FloodInputSchema(elevation_m=-500.0)


class TestFloodPipeline:
    """Test suite for synthetic data generation, heuristic fallback, and training."""

    def test_synthetic_data_shape_and_labels(self):
        X, y = generate_synthetic_flood_data(num_samples=100)
        assert X.shape == (100, 11)
        assert len(y) == 100
        assert set(y).issubset({0, 1})

    def test_heuristic_flood_score_range(self):
        inp = FloodInputSchema(
            rainfall_mm_24h=300.0,
            rainfall_intensity_mm_h=90.0,
            elevation_m=5.0,
            drainage_capacity_score=1.0,
            soil_saturation_pct=95.0,
            distance_to_river_m=100.0,
        )
        score = compute_heuristic_flood_score(inp)
        assert 0.0 <= score <= 100.0
        assert score > 60.0  # Should be high risk for severe inputs
        level = score_to_risk_level(score)
        assert level in (RiskLevel.HIGH, RiskLevel.CRITICAL)

    def test_train_flood_model_returns_metrics(self, tmp_path):
        model, metrics, metadata = train_flood_model(
            output_dir=str(tmp_path),
            num_samples=500,
        )
        assert model is not None
        assert metrics.accuracy > 0.70
        assert metrics.roc_auc > 0.70
        assert "feature_importances" in metadata
        assert (tmp_path / "flood_v1.joblib").exists()
        assert (tmp_path / "flood_v1_meta.json").exists()
