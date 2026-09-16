"""
Real Model Training & Evaluation (Phase 18)
Trains and compares Logistic Regression, Random Forest, and XGBoost on the real-v1 dataset.
Selects the best based on validation recall/F1, and evaluates on the untouched test set.
Outputs artifacts to ml/models/experiments/ to avoid overwriting production synthetic models.
"""
import os
import json
import pandas as pd
import numpy as np
import joblib
from datetime import datetime

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

SEED = 42
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'processed'))
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'models', 'experiments'))
os.makedirs(OUTPUT_DIR, exist_ok=True)

def load_hazard_data(hazard: str):
    train = pd.read_csv(os.path.join(DATA_DIR, f"{hazard}_train.csv"))
    val = pd.read_csv(os.path.join(DATA_DIR, f"{hazard}_val.csv"))
    test = pd.read_csv(os.path.join(DATA_DIR, f"{hazard}_test.csv"))
    
    # Feature Selection (Drop slope_deg from everything because it is 0.0 in real-v1 due to API limits)
    features = ['rainfall_mm_24h', 'rainfall_intensity_mm_h', 'antecedent_rainfall_7d_mm', 'temperature_c', 'humidity_pct', 'elevation_m']
    
    X_train, y_train = train[features], train['label']
    X_val, y_val = val[features], val['label']
    X_test, y_test = test[features], test['label']
    
    return X_train, y_train, X_val, y_val, X_test, y_test, features, len(train), len(val), len(test)

def evaluate_model(model, X, y):
    preds = model.predict(X)
    probs = model.predict_proba(X)[:, 1] if hasattr(model, "predict_proba") else None
    
    metrics = {
        "accuracy": accuracy_score(y, preds),
        "precision": precision_score(y, preds, zero_division=0),
        "recall": recall_score(y, preds, zero_division=0),
        "f1": f1_score(y, preds, zero_division=0),
        "confusion_matrix": confusion_matrix(y, preds).tolist()
    }
    
    if probs is not None and len(np.unique(y)) > 1:
        metrics["roc_auc"] = roc_auc_score(y, probs)
    else:
        metrics["roc_auc"] = None
        
    return metrics

def build_candidates():
    candidates = {
        "LogisticRegression": Pipeline([
            ('scaler', StandardScaler()),
            ('clf', LogisticRegression(random_state=SEED, class_weight='balanced'))
        ]),
        "RandomForest": Pipeline([
            ('scaler', StandardScaler()), # Not strictly necessary for RF, but good for pipeline uniformity
            ('clf', RandomForestClassifier(n_estimators=100, max_depth=5, random_state=SEED, class_weight='balanced'))
        ]),
        "XGBoost": Pipeline([
            ('scaler', StandardScaler()),
            ('clf', XGBClassifier(n_estimators=100, max_depth=4, scale_pos_weight=2.0, random_state=SEED, use_label_encoder=False, eval_metric='logloss'))
        ])
    }
    return candidates

def feature_importance(model_pipeline, feature_names):
    clf = model_pipeline.named_steps['clf']
    if hasattr(clf, 'feature_importances_'):
        importances = clf.feature_importances_
    elif hasattr(clf, 'coef_'):
        importances = np.abs(clf.coef_[0])
    else:
        return {}
    
    return {f: float(imp) for f, imp in zip(feature_names, importances)}

def train_and_compare(hazard: str):
    print(f"\n{'='*50}\nTraining {hazard.upper()} Models\n{'='*50}")
    
    X_train, y_train, X_val, y_val, X_test, y_test, features, n_train, n_val, n_test = load_hazard_data(hazard)
    
    candidates = build_candidates()
    best_model_name = None
    best_val_recall = -1
    best_val_f1 = -1
    
    results = {}
    
    for name, pipeline in candidates.items():
        print(f"Training {name}...")
        pipeline.fit(X_train, y_train)
        
        val_metrics = evaluate_model(pipeline, X_val, y_val)
        results[name] = {
            "model": pipeline,
            "val_metrics": val_metrics
        }
        
        print(f"  Val Recall: {val_metrics['recall']:.2f} | Val F1: {val_metrics['f1']:.2f} | Val Acc: {val_metrics['accuracy']:.2f}")
        
        # Select best model based on Recall (minimize false negatives), then F1
        if val_metrics['recall'] > best_val_recall or (val_metrics['recall'] == best_val_recall and val_metrics['f1'] > best_val_f1):
            best_val_recall = val_metrics['recall']
            best_val_f1 = val_metrics['f1']
            best_model_name = name
            
    print(f"\nSelected Best Model: {best_model_name}")
    
    # Evaluate best model on untouched TEST set
    best_pipeline = results[best_model_name]["model"]
    test_metrics = evaluate_model(best_pipeline, X_test, y_test)
    
    print("\n--- Final Test Set Evaluation ---")
    print(f"Accuracy: {test_metrics['accuracy']:.2f}")
    print(f"Precision: {test_metrics['precision']:.2f}")
    print(f"Recall: {test_metrics['recall']:.2f}")
    print(f"F1: {test_metrics['f1']:.2f}")
    print(f"ROC-AUC: {test_metrics['roc_auc']}")
    print(f"Confusion Matrix: {test_metrics['confusion_matrix']}")
    
    # Save the models and metadata
    for name, data in results.items():
        # Only saving the models to experiments folder, NOT modifying production models
        # Naming format: ml/models/experiments/<hazard>_<model>_real_v1.joblib
        model_filename = f"{hazard}_{name.lower()}_real_v1.joblib"
        model_path = os.path.join(OUTPUT_DIR, model_filename)
        joblib.dump(data["model"], model_path)
        
        metadata = {
            "model_name": name,
            "hazard": hazard,
            "dataset_version": "real-v1",
            "feature_list": features,
            "training_row_count": n_train,
            "validation_row_count": n_val,
            "test_row_count": n_test,
            "random_seed": SEED,
            "hyperparameters": "class_weight=balanced" if name != "XGBoost" else "scale_pos_weight=2.0",
            "validation_metrics": data["val_metrics"],
            "test_metrics": test_metrics if name == best_model_name else "Not evaluated on test set",
            "training_timestamp": datetime.utcnow().isoformat() + "Z",
            "is_best_model": (name == best_model_name),
            "feature_importance": feature_importance(data["model"], features),
            "known_limitations": "Small dataset (Kerala). Highly volatile metrics. slope_deg omitted for landslide."
        }
        
        meta_filename = f"{hazard}_{name.lower()}_real_v1_metadata.json"
        with open(os.path.join(OUTPUT_DIR, meta_filename), "w") as f:
            json.dump(metadata, f, indent=4)
            
    print(f"\nSaved models and metadata to {OUTPUT_DIR}")

if __name__ == "__main__":
    train_and_compare("flood")
    train_and_compare("landslide")
