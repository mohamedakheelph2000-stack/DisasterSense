from pydantic import BaseModel, Field
from typing import Optional

class MLModelStatus(BaseModel):
    loaded: bool = Field(..., description="Whether the model is currently loaded in memory")
    model_name: Optional[str] = Field(None, description="The name of the loaded model")
    model_version: Optional[str] = Field(None, description="The version of the loaded model")
    is_real: bool = Field(False, description="Whether this is a real (empirical) model or a synthetic/heuristic one")

class MLStatus(BaseModel):
    flood: MLModelStatus
    landslide: MLModelStatus

class ProviderStatus(BaseModel):
    configured: bool = Field(..., description="Whether the provider has necessary configuration/credentials set")
    enabled: bool = Field(..., description="Whether the provider is enabled by system policy")

class NotificationStatus(BaseModel):
    email: ProviderStatus
    sms: ProviderStatus
    total_deliveries_24h: int
    successful_deliveries_24h: int
    failed_deliveries_24h: int
    email_deliveries_24h: int
    sms_deliveries_24h: int

class SystemTelemetry(BaseModel):
    core_api: str = Field(..., description="OPERATIONAL, DEGRADED, or UNAVAILABLE")
    database: str = Field(..., description="OPERATIONAL, DEGRADED, or UNAVAILABLE")
    ml_models: MLStatus
    notifications: NotificationStatus
