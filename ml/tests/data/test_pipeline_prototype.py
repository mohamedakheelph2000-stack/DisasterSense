"""
Tests for the Real-World Data Acquisition Pipeline Prototype.
"""

import pytest
import pandas as pd
from ml.src.data.acquisition.flood_prototype import GlobalFloodDatabaseAdapter
from ml.src.data.acquisition.weather_prototype import HistoricalWeatherAdapter
from ml.src.data.features.negative_sampling import generate_negative_samples
from ml.src.data.validation import validate_dataframe

def test_flood_adapter_returns_normalized_fields():
    adapter = GlobalFloodDatabaseAdapter(use_mock=True)
    df = adapter.fetch_events()
    
    assert len(df) > 0
    assert "event_id" in df.columns
    assert "latitude" in df.columns
    assert "longitude" in df.columns
    
    # Check UTC datetime type
    assert pd.api.types.is_datetime64tz_dtype(df['event_time'])

def test_weather_adapter_returns_correct_fields():
    adapter = HistoricalWeatherAdapter(use_mock=True)
    time = pd.to_datetime("2018-08-15T00:00:00Z", utc=True)
    features = adapter.fetch_weather_features(10.0, 76.0, time)
    
    expected_keys = [
        "rainfall_mm_24h", "rainfall_intensity_mm_h", "rainfall_duration_h",
        "antecedent_rainfall_7d_mm", "temperature_c", "humidity_pct"
    ]
    for key in expected_keys:
        assert key in features
        assert isinstance(features[key], (float, int))

def test_negative_sampling_generates_correct_counts_and_labels():
    df_pos = pd.DataFrame([{
        "event_id": "POS_1",
        "source": "test",
        "event_time": pd.to_datetime("2018-08-15T00:00:00Z", utc=True),
        "latitude": 10.0,
        "longitude": 76.0,
        "event_type": "flood",
        "label": 1
    }])
    
    num_neg = 3
    df_neg = generate_negative_samples(df_pos, num_negatives_per_positive=num_neg)
    
    assert len(df_neg) == num_neg
    assert (df_neg['label'] == 0).all()
    assert (df_neg['source'] == 'negative_sampling').all()

def test_validation_fails_on_impossible_latitude():
    # Construct invalid df
    df_invalid = pd.DataFrame([{
        "event_id": "ERR_1",
        "source": "test",
        "event_time": pd.to_datetime("2018-08-15T00:00:00Z", utc=True),
        "latitude": 95.0, # invalid
        "longitude": 76.0,
        "event_type": "flood",
        "label": 1,
        "data_status": "REAL",
        "rainfall_mm_24h": 10.0,
        "temperature_c": 25.0,
        "elevation_m": 100.0,
        "slope_deg": 5.0
    }])
    
    with pytest.raises(ValueError, match="Data validation failed"):
        validate_dataframe(df_invalid)

def test_validation_fails_on_duplicate_ids():
    df_dup = pd.DataFrame([
        {
            "event_id": "DUP_1", "source": "test", "event_time": "2018-08-15T00:00:00Z",
            "latitude": 10.0, "longitude": 76.0, "event_type": "flood", "label": 1, "data_status": "REAL",
            "rainfall_mm_24h": 10.0, "temperature_c": 25.0, "elevation_m": 100.0, "slope_deg": 5.0
        },
        {
            "event_id": "DUP_1", "source": "test", "event_time": "2018-08-15T00:00:00Z",
            "latitude": 10.0, "longitude": 76.0, "event_type": "flood", "label": 1, "data_status": "REAL",
            "rainfall_mm_24h": 10.0, "temperature_c": 25.0, "elevation_m": 100.0, "slope_deg": 5.0
        }
    ])
    
    with pytest.raises(ValueError, match="Data leakage risk"):
        validate_dataframe(df_dup)

def test_temporal_split_logic_prevents_leakage():
    from ml.src.data.build_datasets import split_dataset
    
    # Create mock dataset with different years
    df = pd.DataFrame([
        {"event_id": "1", "event_time": pd.to_datetime("2018-05-01")},
        {"event_id": "2", "event_time": pd.to_datetime("2019-06-01")},
        {"event_id": "3", "event_time": pd.to_datetime("2020-07-01")},
        {"event_id": "4", "event_time": pd.to_datetime("2021-08-01")},
    ])
    
    train, val, test = split_dataset(df)
    
    assert len(train) == 1
    assert train.iloc[0]['event_id'] == "1"
    
    assert len(val) == 1
    assert val.iloc[0]['event_id'] == "2"
    
    assert len(test) == 2
    assert "3" in test['event_id'].values
    assert "4" in test['event_id'].values
    
    # Ensure year column was dropped
    assert "year" not in train.columns
