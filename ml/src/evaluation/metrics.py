"""
Evaluation Metrics calculation and serialization.

Provides standard classification evaluation metrics:
- Accuracy
- Precision
- Recall
- F1 Score
- ROC-AUC
- Confusion Matrix
"""

from typing import Dict, Any, List
from pydantic import BaseModel, Field


class EvaluationMetrics(BaseModel):
    """Structured container for model evaluation metrics."""
    accuracy: float = Field(..., description="Overall model accuracy [0, 1]")
    precision: float = Field(..., description="Weighted/Macro precision score [0, 1]")
    recall: float = Field(..., description="Weighted/Macro recall score [0, 1]")
    f1_score: float = Field(..., description="Weighted/Macro F1 score [0, 1]")
    roc_auc: float = Field(..., description="Area Under ROC Curve [0, 1]")
    confusion_matrix: List[List[int]] = Field(..., description="2x2 confusion matrix [[TN, FP], [FN, TP]]")
    dataset_size: int = Field(..., description="Number of evaluation samples")
    timestamp: str = Field(..., description="ISO 8601 evaluation timestamp")


def calculate_binary_metrics(
    y_true: List[int],
    y_pred: List[int],
    y_prob: List[float],
    timestamp_str: str,
) -> EvaluationMetrics:
    """
    Compute binary classification evaluation metrics using pure Python or scikit-learn.

    Args:
        y_true: Ground truth binary labels (0 or 1).
        y_pred: Predicted binary labels (0 or 1).
        y_prob: Predicted positive class probabilities [0.0, 1.0].
        timestamp_str: ISO format timestamp string.

    Returns:
        EvaluationMetrics instance.
    """
    total = len(y_true)
    if total == 0:
        raise ValueError("y_true cannot be empty.")

    tn = fp = fn = tp = 0
    for yt, yp in zip(y_true, y_pred):
        if yt == 0 and yp == 0:
            tn += 1
        elif yt == 0 and yp == 1:
            fp += 1
        elif yt == 1 and yp == 0:
            fn += 1
        elif yt == 1 and yp == 1:
            tp += 1

    accuracy = (tp + tn) / total
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1_score = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    # Approximate ROC-AUC calculation
    positives = sum(y_true)
    negatives = total - positives
    if positives > 0 and negatives > 0:
        # Sort by probability
        sorted_pairs = sorted(zip(y_prob, y_true), key=lambda x: x[0], reverse=True)
        rank_sum = 0
        for idx, (prob, yt) in enumerate(sorted_pairs):
            if yt == 1:
                rank_sum += (total - idx)
        roc_auc = (rank_sum - (positives * (positives + 1) / 2)) / (positives * negatives)
        roc_auc = max(0.0, min(1.0, roc_auc))
    else:
        roc_auc = 0.5

    return EvaluationMetrics(
        accuracy=round(accuracy, 4),
        precision=round(precision, 4),
        recall=round(recall, 4),
        f1_score=round(f1_score, 4),
        roc_auc=round(roc_auc, 4),
        confusion_matrix=[[tn, fp], [fn, tp]],
        dataset_size=total,
        timestamp=timestamp_str,
    )
