"""
Data Acquisition Pipeline Prototype (End-to-End)

Proves the architecture by tying together event acquisition, negative sampling, 
weather feature extraction, terrain extraction, and validation into a normalized dataset.
"""

import pandas as pd
import os
import sys

# Add root directory to python path for local imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

from ml.src.data.acquisition.flood_prototype import GlobalFloodDatabaseAdapter
from ml.src.data.acquisition.landslide_prototype import NASALandslideCatalogAdapter
from ml.src.data.acquisition.weather_prototype import HistoricalWeatherAdapter
from ml.src.data.acquisition.terrain_prototype import TerrainAdapter
from ml.src.data.features.negative_sampling import generate_negative_samples
from ml.src.data.validation import validate_dataframe

def build_features_for_events(df_events: pd.DataFrame, label: int) -> pd.DataFrame:
    """Hydrates events with weather and terrain data."""
    weather_adapter = HistoricalWeatherAdapter(use_mock=False)
    terrain_adapter = TerrainAdapter(use_mock=False)
    
    rows = []
    
    for _, row in df_events.iterrows():
        # Fetch weather
        weather = weather_adapter.fetch_weather_features(
            latitude=row['latitude'], 
            longitude=row['longitude'], 
            event_time_utc=row['event_time']
        )
        
        # Fetch terrain
        terrain = terrain_adapter.fetch_terrain_features(
            latitude=row['latitude'], 
            longitude=row['longitude']
        )
        
        # Combine all provenance and feature data
        feature_row = {
            "event_id": row['event_id'],
            "source": row['source'],
            "event_time": row['event_time'],
            "latitude": row['latitude'],
            "longitude": row['longitude'],
            "event_type": row['event_type'],
            "label": label,
            "data_status": "REAL",
            **weather,
            **terrain
        }
        rows.append(feature_row)
        
    return pd.DataFrame(rows)

def run_pipeline():
    print("Starting Data Acquisition Pipeline Prototype...")
    
    # 1. Fetch positive flood events
    print("Fetching Flood events...")
    flood_adapter = GlobalFloodDatabaseAdapter(use_mock=False)
    df_flood_pos = flood_adapter.fetch_events()
    
    # 2. Fetch positive landslide events
    print("Fetching Landslide events...")
    landslide_adapter = NASALandslideCatalogAdapter(use_mock=False)
    df_landslide_pos = landslide_adapter.fetch_events()
    
    # Combine positive events
    df_pos_raw = pd.concat([df_flood_pos, df_landslide_pos], ignore_index=True)
    
    # 3. Generate negative samples
    print("Generating negative spatiotemporal samples...")
    df_neg_raw = generate_negative_samples(df_pos_raw, num_negatives_per_positive=2)
    
    # 4. Extract features for positives
    print("Extracting features for positive events...")
    df_pos_features = build_features_for_events(df_pos_raw, label=1)
    
    # 5. Extract features for negatives
    print("Extracting features for negative events...")
    df_neg_features = build_features_for_events(df_neg_raw, label=0)
    
    # 6. Combine and validate
    df_final = pd.concat([df_pos_features, df_neg_features], ignore_index=True)
    
    print("Validating combined dataset...")
    validate_dataframe(df_final)
    
    # 7. Save output
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'processed'))
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'real_sample_events.csv')
    
    df_final.to_csv(output_path, index=False)
    
    print(f"\nPipeline completed successfully! Wrote {len(df_final)} rows to {output_path}")
    print("\nSample Output:")
    print(df_final.head())

if __name__ == "__main__":
    run_pipeline()
