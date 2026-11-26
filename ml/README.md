# E-IDX academic risk model

Local OULAD training pipeline for the E-IDX mentor-support risk score.

The model predicts `at_risk = final_result in {Fail, Withdrawn}` for a student-module
enrolment at **day 60** of the presentation. It is trained and evaluated entirely on this
machine; no Colab or external compute service is required.

## Model contract

| Item | Value |
| --- | --- |
| Dataset | OULAD (Kuzilek et al., 2017), CC BY 4.0 |
| Unit of prediction | Student-module enrolment |
| Prediction cutoff | Day 60 |
| Cohort | Students not unregistered on or before day 60 |
| Target | Fail or Withdrawn |
| Training rows | 26,361 |
| Unique students | 23,985 |
| At-risk rate | 41.64% |
| Features | 45 |
| Excluded early withdrawals | 6,232 enrolments |
| Missing VLE at cutoff | 563 enrolments |
| Missing assessment score at cutoff | 3,982 enrolments |

The model never uses `final_result`, `date_unregistration`, post-cutoff assessment scores,
post-cutoff VLE activity, gender, region, highest education, IMD band, age band or
disability as inputs. Demographic fields are kept only in `cohort_meta.parquet` for the
fairness audit.

## Model performance

### Five-fold student-group validation

| Metric | CatBoost | Logistic baseline |
| --- | ---: | ---: |
| ROC-AUC | 0.8345 | 0.8316 |
| PR-AUC | 0.8151 | 0.8101 |
| Brier score | 0.1579 | 0.1594 |
| Recall at top 20% | 0.4323 | 0.4290 |
| Precision at top 20% | 0.9000 | 0.8932 |
| Recall at top 10% | 0.2343 | 0.2324 |
| Precision at top 10% | 0.9757 | 0.9678 |

The folds are grouped by `id_student`, so a student cannot appear in both training and
validation.

### Temporal holdout: 2014J

The temporal model is trained on the earlier presentations, with all students who appear in
2014J removed from the training set.

| Metric | CatBoost | Logistic baseline |
| --- | ---: | ---: |
| ROC-AUC | 0.8030 | 0.8065 |
| PR-AUC | 0.7561 | 0.7592 |
| Brier score | 0.1691 | 0.1663 |
| Recall at top 20% | 0.4273 | 0.4326 |
| Precision at top 20% | 0.8141 | 0.8243 |

The later-presentation result is the more honest estimate of how the model will behave on a
new cohort. CatBoost and the logistic baseline are close; CatBoost is used as the deployed
artifact because it also provides the SHAP explanations and slightly better grouped-CV
metrics.

## Capacity-based risk tiers

Tiers are set from out-of-fold CatBoost probabilities, not from a fixed 0.5 threshold:

- `needs-support`: top 10% (`probability >= 0.9122`)
- `watch`: next 20% (`0.5402 <= probability < 0.9122`)
- `on-track`: remaining 70%

Final scored counts: 2,652 needs-support, 5,306 watch, 18,403 on-track.

## What drives the model

Mean absolute SHAP grouped into product-facing groups:

| Group | Share |
| --- | ---: |
| Assessment scores | 28.3% |
| Recent VLE activity | 21.3% |
| Module context | 15.5% |
| Submission timing | 12.0% |
| Missed assessments | 10.5% |
| VLE breadth | 5.8% |
| Total VLE engagement | 3.5% |
| Prior attempts | 1.9% |
| Credits and registration | 1.0% |
| Banked credit | 0.2% |

Top individual features include `n_missing_60`, `weighted_score_60`, `n_ontime_60`,
`avg_score_60`, `vle_active_days_last_14_days_60`, `last_score_60`, `weight_due_60`,
`vle_active_days_31_60` and `days_since_last_vle_60`.

Campus attendance is not an OULAD field and is **not** used by this model.

## Fairness audit

Protected attributes are used only for evaluation. The audit computes selection-rate and
recall gaps at the global top-20% threshold. The largest selection-rate gap in this validation
run is by highest education (0.205), followed by IMD band (0.132) and age band (0.117). These
gaps need review before any production deployment; they are not hidden from the model card.

Full subgroup results are in `artifacts/fairness.json`.

## Reproduce locally

From the project root:

```bash
uv venv ml/.venv --python 3.12
uv pip install --python ml/.venv/bin/python -r ml/requirements.txt

# Import the seven OULAD CSVs into DuckDB, build the cutoff-60 table and export Parquet.
ml/.venv/bin/python -m ml.build_features --rebuild-db

# Train, evaluate, explain and export artifacts.
ml/.venv/bin/python -m ml.train
```

The feature build uses DuckDB with a 1.8GB memory limit and a disk temporary directory. It
never loads the 10.6M-row VLE CSV into pandas.

## Outputs

| File | Purpose |
| --- | --- |
| `data/features_cutoff60.parquet` | One row per active student-module at day 60 |
| `data/cohort_meta.parquet` | Demographics and outcome fields for the fairness audit only |
| `data/feature_meta.json` | Feature contract, source hashes and build statistics |
| `artifacts/catboost_model.cbm` | Final CatBoost model |
| `artifacts/logistic_model.joblib` | Logistic baseline model |
| `artifacts/metrics.json` | CV, temporal, fairness, SHAP and tier metrics |
| `artifacts/model_meta.json` | Deployment-facing model contract and thresholds |
| `artifacts/predictions.parquet` | OOF and final probabilities and tiers |
| `artifacts/temporal_predictions.parquet` | Held-out 2014J probabilities |
| `artifacts/feature_importance.csv` | CatBoost feature importance |
| `artifacts/shap_values.parquet` | Sampled SHAP values |
| `artifacts/shap_importance.csv` | Mean absolute SHAP by feature |
| `artifacts/shap_group_importance.csv` | Product-facing grouped SHAP shares |
| `artifacts/shap_summary.png` | SHAP beeswarm plot |
| `artifacts/shap_importance_bar.png` | SHAP bar plot |
| `artifacts/calibration.png` | OOF calibration curve |
| `artifacts/fairness.json` | Subgroup fairness audit |

## Next step

The prediction contract is now frozen. The backend should store the aggregated feature
snapshot and the latest risk probability/tier, not raw VLE clicks. The student card and
student-facing responses must never include risk, its drivers or its probability.
