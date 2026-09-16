import json
import os
import glob
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError

from app.api.deps import RequireRole
from app.models.user import User, UserRole
from app.schemas.ml import (
    MLStatusResponse,
    MLModelSummary,
    MLHazardEvaluation,
    MLEvaluationMetrics,
    MLConfusionMatrix,
    MLFeatureImportance,
    MLHazardComparisonResponse,
    MLModelComparison,
)
from ml.src.inference.risk_engine import risk_engine

router = APIRouter(tags=["ml"])

def get_base_dir() -> str:
    # Get the project root assuming backend/app/api/v1/ml.py structure
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))

def build_model_summary(hazard: str) -> MLModelSummary:
    """Helper to build model summary directly from risk_engine state."""
    
    # Try real model first
    meta = None
    is_real = False
    source = None
    
    if hazard == "flood":
        if risk_engine._real_flood_meta:
            meta = risk_engine._real_flood_meta
            is_real = True
            source = "real_model"
        elif risk_engine._flood_meta:
            meta = risk_engine._flood_meta
            source = "synthetic_model"
    elif hazard == "landslide":
        if risk_engine._real_landslide_meta:
            meta = risk_engine._real_landslide_meta
            is_real = True
            source = "real_model"
        elif risk_engine._landslide_meta:
            meta = risk_engine._landslide_meta
            source = "synthetic_model"

    if meta:
        features = meta.get("feature_names") or meta.get("feature_list") or []
        return MLModelSummary(
            hazard=hazard,
            loaded=True,
            model_name=meta.get("model_name"),
            model_version=meta.get("model_version", "unknown"),
            dataset_version=meta.get("dataset_version"),
            inference_source=source,
            is_real=is_real,
            feature_count=len(features) if features else None,
            feature_names=features
        )
    
    # Fallback to heuristic
    return MLModelSummary(
        hazard=hazard,
        loaded=True,
        model_name=f"{hazard}_heuristic_fallback",
        inference_source="heuristic",
        is_real=False
    )


@router.get(
    "/status",
    response_model=MLStatusResponse,
    summary="Get ML System Status",
    description="Returns high-level metadata about currently loaded models."
)
def get_ml_status(current_user: User = Depends(RequireRole([UserRole.ADMIN, UserRole.RESPONDER]))):
    return MLStatusResponse(
        flood=build_model_summary("flood"),
        landslide=build_model_summary("landslide")
    )


def load_meta_file(path: str) -> Optional[Dict]:
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return None

def parse_metrics(metrics_dict: dict, dataset_size: Optional[int] = None, timestamp: Optional[str] = None) -> Optional[MLEvaluationMetrics]:
    if not isinstance(metrics_dict, dict):
        return None
        
    cm = metrics_dict.get("confusion_matrix")
    matrix_obj = None
    if cm and len(cm) == 2 and len(cm[0]) == 2:
        matrix_obj = MLConfusionMatrix(matrix=cm)
        
    return MLEvaluationMetrics(
        accuracy=metrics_dict.get("accuracy", 0.0),
        precision=metrics_dict.get("precision", 0.0),
        recall=metrics_dict.get("recall", 0.0),
        f1_score=metrics_dict.get("f1_score", metrics_dict.get("f1", 0.0)),
        roc_auc=metrics_dict.get("roc_auc", 0.0),
        confusion_matrix=matrix_obj,
        dataset_size=dataset_size,
        timestamp=timestamp
    )


@router.get(
    "/evaluation/{hazard}",
    response_model=MLHazardEvaluation,
    summary="Get Evaluation Metrics for a Hazard",
)
def get_evaluation(hazard: str, current_user: User = Depends(RequireRole([UserRole.ADMIN, UserRole.RESPONDER]))):
    if hazard not in ("flood", "landslide"):
        raise HTTPException(status_code=400, detail="Invalid hazard type")

    summary = build_model_summary(hazard)
    if not summary.loaded or summary.inference_source == "heuristic":
        raise HTTPException(status_code=404, detail="No evaluation metadata available for heuristic fallback")

    # Determine which file to load based on what's active
    models_dir = os.path.join(get_base_dir(), "ml", "models")
    exp_dir = os.path.join(models_dir, "experiments")
    
    meta_path = None
    if summary.is_real:
        # e.g., flood_logisticregression_real_v1_metadata.json
        files = glob.glob(os.path.join(exp_dir, f"{hazard}_*_real_v*_metadata.json"))
        for f in files:
            d = load_meta_file(f)
            if d and d.get("is_best_model"):
                meta_path = f
                break
    else:
        meta_path = os.path.join(models_dir, f"{hazard}_v1_meta.json")

    if not meta_path or not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Evaluation metadata not found")

    meta = load_meta_file(meta_path)
    if not meta:
        raise HTTPException(status_code=500, detail="Failed to parse metadata")

    # Extract metrics
    metrics = None
    if "evaluation_metrics" in meta:
        metrics = parse_metrics(
            meta["evaluation_metrics"],
            dataset_size=meta["evaluation_metrics"].get("dataset_size"),
            timestamp=meta["evaluation_metrics"].get("timestamp")
        )
    elif "test_metrics" in meta:
        metrics = parse_metrics(
            meta["test_metrics"],
            dataset_size=meta.get("test_row_count"),
            timestamp=meta.get("training_timestamp")
        )

    # Extract feature importance
    fi_dict = meta.get("feature_importance") or meta.get("feature_importances") or {}
    fi_list = [MLFeatureImportance(feature=k, importance=v) for k, v in fi_dict.items()]
    fi_list.sort(key=lambda x: x.importance, reverse=True)

    return MLHazardEvaluation(
        hazard=hazard,
        model_name=meta.get("model_name", summary.model_name or "unknown"),
        model_version=meta.get("model_version", summary.model_version or "unknown"),
        dataset_version=meta.get("dataset_version", summary.dataset_version),
        metrics=metrics,
        feature_importance=fi_list,
        limitations=meta.get("known_limitations")
    )

@router.get(
    "/experiments/{hazard}",
    response_model=MLHazardComparisonResponse,
    summary="Get Algorithm Comparisons"
)
def get_experiments(hazard: str, current_user: User = Depends(RequireRole([UserRole.ADMIN, UserRole.RESPONDER]))):
    if hazard not in ("flood", "landslide"):
        raise HTTPException(status_code=400, detail="Invalid hazard type")

    exp_dir = os.path.join(get_base_dir(), "ml", "models", "experiments")
    if not os.path.exists(exp_dir):
        return MLHazardComparisonResponse(hazard=hazard, dataset_version="unknown", models=[])

    files = glob.glob(os.path.join(exp_dir, f"{hazard}_*_real_v*_metadata.json"))
    models_cmp = []
    dataset_ver = "unknown"

    for f in files:
        meta = load_meta_file(f)
        if not meta:
            continue
        
        dataset_ver = meta.get("dataset_version", dataset_ver)
        metrics = None
        if "test_metrics" in meta:
            metrics = parse_metrics(
                meta["test_metrics"],
                dataset_size=meta.get("test_row_count"),
                timestamp=meta.get("training_timestamp")
            )
        elif "evaluation_metrics" in meta:
            metrics = parse_metrics(
                meta["evaluation_metrics"],
                dataset_size=meta["evaluation_metrics"].get("dataset_size"),
                timestamp=meta["evaluation_metrics"].get("timestamp")
            )
            
        if metrics:
            models_cmp.append(MLModelComparison(
                model_name=meta.get("model_name", "unknown"),
                is_best_model=meta.get("is_best_model", False),
                metrics=metrics
            ))
            
    models_cmp.sort(key=lambda x: x.metrics.f1_score, reverse=True)

    return MLHazardComparisonResponse(
        hazard=hazard,
        dataset_version=dataset_ver,
        models=models_cmp
    )
