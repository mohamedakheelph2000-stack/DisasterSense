import pytest
import os
import joblib
import pandas as pd
import json

EXPERIMENTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models', 'experiments'))

@pytest.mark.parametrize("hazard, expected_best", [
    ("flood", "logisticregression"),
    ("landslide", "randomforest")
])
def test_best_model_artifact_exists_and_loads(hazard, expected_best):
    model_path = os.path.join(EXPERIMENTS_DIR, f"{hazard}_{expected_best}_real_v1.joblib")
    assert os.path.exists(model_path)
    
    model = joblib.load(model_path)
    assert hasattr(model, "predict")
    assert hasattr(model, "predict_proba")

@pytest.mark.parametrize("hazard, expected_best", [
    ("flood", "logisticregression"),
    ("landslide", "randomforest")
])
def test_metadata_exists_and_is_valid(hazard, expected_best):
    meta_path = os.path.join(EXPERIMENTS_DIR, f"{hazard}_{expected_best}_real_v1_metadata.json")
    assert os.path.exists(meta_path)
    
    with open(meta_path, "r") as f:
        meta = json.load(f)
        
    assert meta["hazard"] == hazard
    assert meta["dataset_version"] == "real-v1"
    assert meta["is_best_model"] is True
    assert "accuracy" in meta["test_metrics"]
    
def test_model_predicts_expected_shape():
    model_path = os.path.join(EXPERIMENTS_DIR, "flood_logisticregression_real_v1.joblib")
    if not os.path.exists(model_path):
        pytest.skip("Model not yet generated")
        
    model = joblib.load(model_path)
    
    # 6 features as defined in schema
    mock_data = pd.DataFrame([{
        'rainfall_mm_24h': 100.0, 
        'rainfall_intensity_mm_h': 20.0, 
        'antecedent_rainfall_7d_mm': 300.0, 
        'temperature_c': 25.0, 
        'humidity_pct': 80.0, 
        'elevation_m': 10.0
    }])
    
    pred = model.predict(mock_data)
    prob = model.predict_proba(mock_data)
    
    assert len(pred) == 1
    assert pred[0] in [0, 1]
    assert prob.shape == (1, 2)
