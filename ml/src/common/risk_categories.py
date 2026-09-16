"""
Configurable Risk Score to Category Mapper.

Maps numeric risk scores (0–100) to standard disaster severity categories:
- Very Low  (0 - 20)
- Low       (21 - 40)
- Moderate  (41 - 60)
- High      (61 - 80)
- Critical  (81 - 100)
"""

from enum import Enum
from typing import Dict, Tuple
from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    VERY_LOW = "Very Low"
    LOW = "Low"
    MODERATE = "Moderate"
    HIGH = "High"
    CRITICAL = "Critical"


class RiskThresholdConfig(BaseModel):
    """Configurable threshold boundary settings."""
    very_low_max: float = Field(default=20.0, ge=0.0, le=100.0)
    low_max: float = Field(default=40.0, ge=0.0, le=100.0)
    moderate_max: float = Field(default=60.0, ge=0.0, le=100.0)
    high_max: float = Field(default=80.0, ge=0.0, le=100.0)


# Default shared threshold configuration
DEFAULT_THRESHOLDS = RiskThresholdConfig()


def score_to_risk_level(
    score: float,
    thresholds: RiskThresholdConfig = DEFAULT_THRESHOLDS,
) -> RiskLevel:
    """
    Convert a numeric risk score (0.0 to 100.0) into a RiskLevel enum.

    Args:
        score: Numeric risk score between 0.0 and 100.0.
        thresholds: Configurable threshold configuration.

    Returns:
        RiskLevel enum instance.
    """
    # Clamp score to [0, 100]
    clamped_score = max(0.0, min(100.0, float(score)))

    if clamped_score <= thresholds.very_low_max:
        return RiskLevel.VERY_LOW
    elif clamped_score <= thresholds.low_max:
        return RiskLevel.LOW
    elif clamped_score <= thresholds.moderate_max:
        return RiskLevel.MODERATE
    elif clamped_score <= thresholds.high_max:
        return RiskLevel.HIGH
    else:
        return RiskLevel.CRITICAL


def risk_level_to_severity(level: RiskLevel) -> str:
    """
    Map RiskLevel enum to backend SeverityLevel string representation ('low', 'moderate', 'high', 'critical').
    """
    if level in (RiskLevel.VERY_LOW, RiskLevel.LOW):
        return "low"
    elif level == RiskLevel.MODERATE:
        return "moderate"
    elif level == RiskLevel.HIGH:
        return "high"
    else:
        return "critical"
