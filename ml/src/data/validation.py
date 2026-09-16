"""
Data Validation Schemas

Ensures that processed ML rows contain valid coordinates, timestamps, and realistic feature values.
Fails loudly on invalid data to prevent silently creating bad training data.
"""

import pandas as pd
from pydantic import BaseModel, Field, ValidationError

class MLRowValidator(BaseModel):
    """Validator for a single processed row of data."""
    event_id: str = Field(..., min_length=1)
    source: str = Field(..., min_length=1)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    event_type: str = Field(...)
    label: int = Field(..., ge=0, le=1)
    data_status: str = Field(..., pattern="^(REAL|MOCK)$")

    
    # Weather
    rainfall_mm_24h: float = Field(..., ge=0.0)
    temperature_c: float = Field(..., ge=-50.0, le=60.0)
    
    # Terrain
    elevation_m: float = Field(..., ge=-500.0, le=9000.0)
    slope_deg: float = Field(..., ge=0.0, le=90.0)

def validate_dataframe(df: pd.DataFrame) -> bool:
    """
    Iterates through a DataFrame and validates each row against the MLRowValidator.
    Raises ValueError if any row fails validation.
    """
    for index, row in df.iterrows():
        try:
            MLRowValidator(**row.to_dict())
        except ValidationError as e:
            raise ValueError(f"Data validation failed at row {index} (Event ID: {row.get('event_id')}): {e}")
            
    # Leakage Checks
    if df.duplicated(subset=['event_id']).any():
        raise ValueError("Data leakage risk: Duplicate event_ids found.")
        
    return True
