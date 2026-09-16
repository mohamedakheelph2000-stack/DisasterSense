"""
Spatiotemporal Negative Sampling Logic

Generates negative samples for binary classification by:
1. Shifting the date of a known event into the dry season (Temporal Shift).
2. Shifting the location of a known event to a safe location during the same storm (Spatial Shift).
"""

import pandas as pd
import numpy as np
from datetime import timedelta
from typing import List, Dict, Any

def _is_safe_negative(candidate_lat: float, candidate_lon: float, candidate_time: pd.Timestamp, positive_events: pd.DataFrame) -> bool:
    """
    Validates that a negative candidate does not accidentally overlap with a known positive event.
    Spatial exclusion: ~50km (approx 0.5 degrees)
    Temporal exclusion: 7 days
    """
    for _, pos in positive_events.iterrows():
        lat_diff = abs(pos['latitude'] - candidate_lat)
        lon_diff = abs(pos['longitude'] - candidate_lon)
        time_diff = abs(pos['event_time'] - candidate_time)
        
        # If it's within 0.5 degrees AND within 7 days of ANY known event, reject it.
        if lat_diff < 0.5 and lon_diff < 0.5 and time_diff.days <= 7:
            return False
            
    return True

def generate_negative_samples(positive_events: pd.DataFrame, num_negatives_per_positive: int = 1) -> pd.DataFrame:
    """
    Given a DataFrame of positive events (source, event_time, latitude, longitude),
    returns a DataFrame of negative events with the same columns, validated against leakage.
    """
    np.random.seed(42) # Ensure reproducibility
    
    negatives: List[Dict[str, Any]] = []
    
    for idx, row in positive_events.iterrows():
        generated = 0
        attempts = 0
        
        while generated < num_negatives_per_positive and attempts < 10:
            attempts += 1
            
            # 50% chance for spatial shift, 50% for temporal shift
            if np.random.rand() > 0.5:
                # Temporal Shift: Same location, shifted by 180 days (opposite season)
                candidate_time = row['event_time'] - timedelta(days=180)
                candidate_lat = row['latitude']
                candidate_lon = row['longitude']
                shift_type = "TSHIFT"
            else:
                # Spatial Shift: Same time, shifted randomly by 0.5 to 1.5 degrees (~50 to 150 km)
                candidate_time = row['event_time']
                candidate_lat = row['latitude'] + np.random.uniform(0.5, 1.5) * np.random.choice([-1, 1])
                candidate_lon = row['longitude'] + np.random.uniform(0.5, 1.5) * np.random.choice([-1, 1])
                shift_type = "SSHIFT"
                
            if _is_safe_negative(candidate_lat, candidate_lon, candidate_time, positive_events):
                negatives.append({
                    "event_id": f"NEG_{shift_type}_{row['event_id']}_{generated}",
                    "source": "negative_sampling",
                    "event_time": candidate_time,
                    "latitude": candidate_lat,
                    "longitude": candidate_lon,
                    "event_type": row['event_type'],
                    "label": 0
                })
                generated += 1
                
    df_neg = pd.DataFrame(negatives)
    if not df_neg.empty:
        df_neg['event_time'] = pd.to_datetime(df_neg['event_time'], utc=True)
    return df_neg

if __name__ == "__main__":
    # Test
    sample_pos = pd.DataFrame([{
        "event_id": "POS_1",
        "source": "test",
        "event_time": pd.to_datetime("2018-08-15T00:00:00Z", utc=True),
        "latitude": 10.0,
        "longitude": 76.0,
        "event_type": "flood",
        "label": 1
    }])
    
    print("Positive Event:")
    print(sample_pos)
    
    neg = generate_negative_samples(sample_pos, num_negatives_per_positive=2)
    print("\nNegative Events:")
    print(neg)
