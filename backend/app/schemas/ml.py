from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

class MLModelSummary(BaseModel):
    hazard: str = Field(..., description="Hazard type (flood or landslide)")
    loaded: bool = Field(..., description="Is any model currently loaded?")
    model_name: Optional[str] = Field(None, description="Name of the model algorithm")
    model_version: Optional[str] = Field(None, description="Model version tag")
    dataset_version: Optional[str] = Field(None, description="Dataset version tag")
    inference_source: Optional[str] = Field(None, description="'real_model', 'synthetic_model', or 'heuristic'")
    is_real: bool = Field(..., description="Is the model trained on real empirical data?")
    feature_count: Optional[int] = Field(None, description="Number of input features")
    feature_names: Optional[List[str]] = Field(None, description="List of input features")

class MLStatusResponse(BaseModel):
    flood: MLModelSummary
    landslide: MLModelSummary

class MLConfusionMatrix(BaseModel):
    matrix: List[List[int]] = Field(..., description="2x2 Confusion matrix: [[TN, FP], [FN, TP]]")
    labels: List[str] = Field(["Negative", "Positive"], description="Class labels")

class MLFeatureImportance(BaseModel):
    feature: str
    importance: float

class MLEvaluationMetrics(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    roc_auc: float
    confusion_matrix: Optional[MLConfusionMatrix] = None
    dataset_size: Optional[int] = None
    timestamp: Optional[str] = None

class MLHazardEvaluation(BaseModel):
    hazard: str
    model_name: str
    model_version: str
    dataset_version: Optional[str]
    metrics: Optional[MLEvaluationMetrics] = None
    feature_importance: List[MLFeatureImportance] = []
    limitations: Optional[str] = None

class MLModelComparison(BaseModel):
    model_name: str
    is_best_model: bool
    metrics: MLEvaluationMetrics

class MLHazardComparisonResponse(BaseModel):
    hazard: str
    dataset_version: str
    models: List[MLModelComparison]
