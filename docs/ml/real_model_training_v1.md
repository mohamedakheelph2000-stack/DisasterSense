# DisasterSense: Real Model Training (Phase 18)

This document explains the training, evaluation, and selection of models trained on the verified `real-v1` dataset (Kerala historical data, 2018-2021).

## 1. Dataset
- **Version**: `real-v1`
- **Flood Size**: 44 rows (Train: 17, Val: 12, Test: 15)
- **Landslide Size**: 44 rows (Train: 15, Val: 11, Test: 18)

## 2. Feature Selection
Both models were trained using strictly real-world empirical features:
- `rainfall_mm_24h`
- `rainfall_intensity_mm_h`
- `antecedent_rainfall_7d_mm`
- `temperature_c`
- `humidity_pct`
- `elevation_m`

**Omissions**: `slope_deg` was omitted entirely from the landslide training features because point-APIs were unable to provide localized gradients (reporting exactly 0.0), which would poison the decision boundaries.

## 3. Candidate Models
Three fundamentally different algorithms were compared to establish the best empirical fit:
- **Logistic Regression**: Serves as a highly interpretable linear baseline.
- **Random Forest**: The legacy architecture, highly resistant to overfitting on small datasets.
- **XGBoost**: A powerful gradient-boosting alternative.

## 4. Preprocessing
- A `StandardScaler` was applied via an `sklearn.pipeline.Pipeline` to ensure Logistic Regression coefficients were interpretable and converged optimally.
- Tree-based models also received scaling solely for architectural uniformity, though not mathematically strictly necessary.

## 5. Training Procedure
Models were fit on the `train.csv` (<=2018 events) and evaluated against the `val.csv` (2019 events).
To counteract class imbalance, `class_weight='balanced'` (or `scale_pos_weight=2.0` for XGBoost) was utilized. 

## 6. Selection Strategy (Validation Phase)
Disaster prediction models prioritize **Recall** (minimizing False Negatives) because missing a disaster is catastrophic, whereas a False Positive is merely inconvenient.
The model with the highest Validation Recall, followed by F1, was selected as the champion.

## 7. Test Strategy
The champion model was evaluated exactly once against the untouchable `test.csv` (>=2020 events) to produce the final confusion matrix.

## 8. Model Comparison (Flood)
| Model | Val Acc | Val Recall | Val F1 |
| :--- | :--- | :--- | :--- |
| **Logistic Regression** | 1.00 | 1.00 | 1.00 |
| Random Forest | 1.00 | 1.00 | 1.00 |
| XGBoost | 0.92 | 0.75 | 0.86 |

**Best Model**: Logistic Regression. Given identical perfect validation performance to Random Forest, Logistic Regression is preferred for its lower complexity, perfect explainability, and speed.

## 9. Model Comparison (Landslide)
| Model | Val Acc | Val Recall | Val F1 |
| :--- | :--- | :--- | :--- |
| Logistic Regression | 0.91 | 0.75 | 0.86 |
| **Random Forest** | 1.00 | 1.00 | 1.00 |
| XGBoost | 1.00 | 1.00 | 1.00 |

**Best Model**: Random Forest. Outperformed the linear baseline on the validation set.

## 10. Feature Importance
- **Flood (Logistic Regression Coefficients)**: Due to the tiny sample size, the linear model heavily optimized on `antecedent_rainfall_7d_mm` and `elevation_m` as key discriminators.
- **Landslide (Random Forest Importances)**: `antecedent_rainfall_7d_mm` and `rainfall_mm_24h` served as primary triggers, effectively acting as proxies for soil saturation since empirical `slope_deg` was unavailable.

## 11. Limitations & Statistical Caution
> [!WARNING]
> **Perfect metrics are an artifact of small sample sizes.** The 1.00 Accuracy/Recall scores on the test set are statistically fragile due to the dataset containing only 15 true positive events. This model will likely degrade when exposed to larger, noisier national datasets.

## 12. Conclusion
The **Logistic Regression (Flood)** and **Random Forest (Landslide)** models have been saved to `ml/models/experiments/`. They represent a massive leap in data provenance over the `v1` synthetic models, but require the `RiskEngine` schemas to be refactored before they can be integrated into production.
