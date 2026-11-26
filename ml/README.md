# E-IDX academic risk model

Local OULAD training pipeline for the E-IDX mentor-support risk score.

The model predicts `at_risk = final_result in {Fail, Withdrawn}` for a student-module
enrolment at **day 60** of the presentation. It is trained, validated, explained and served
entirely on this machine; no Colab or external compute service is required.

## Status: complete

| Area | State |
| --- | --- |
| Data audit and leakage design | Done |
| Feature pipeline (DuckDB, local) | Done |
| Logistic baseline + CatBoost | Done |
| Student-grouped cross-validation | Done |
| Temporal holdout (2014J) | Done |
| Calibration and fairness audit | Done |
| Out-of-fold SHAP explanations | Done |
| Frozen prediction payload + JSON schema | Done |
| Scoring/inference path (`ml/predict.py`) | Done |
| Automated verification (`ml/verify.py`) | Done |
| Model card | Done (`artifacts/model_card.md`) |

`python -m ml.verify` runs 25 automated checks over the contract, the leakage guards and
every artifact. All of them pass.

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
| ROC-AUC | 0.8344 | 0.8316 |
| PR-AUC | 0.8151 | 0.8101 |
| Brier score | 0.1579 | 0.1594 |
| Calibration error (10 bins) | 0.0090 | 0.0042 |
| Accuracy at 0.5 threshold | 0.7721 | - |
| Macro F1 at 0.5 threshold | 0.7560 | - |
| Recall at top 10% | 0.2343 | 0.2324 |
| Precision at top 10% | 0.9757 | 0.9678 |
| Recall at top 20% | 0.4314 | 0.4290 |
| Precision at top 20% | 0.8981 | 0.8932 |
| Recall at top 30% | 0.5830 | 0.5813 |

The folds are grouped by `id_student`, so a student cannot appear in both training and
validation.

### Temporal holdout: 2014J

The temporal model is trained on the earlier presentations, with all students who appear in
2014J removed from the training set.

| Metric | CatBoost | Logistic baseline |
| --- | ---: | ---: |
| ROC-AUC | 0.8044 | 0.8065 |
| PR-AUC | 0.7577 | 0.7592 |
| Brier score | 0.1683 | 0.1663 |
| Calibration error (10 bins) | 0.0258 | - |
| Recall at top 10% | 0.2475 | - |
| Precision at top 10% | 0.9433 | - |
| Recall at top 20% | 0.4290 | 0.4326 |
| Precision at top 20% | 0.8175 | 0.8243 |

The later-presentation result is the more honest estimate of how the model will behave on a
new cohort. CatBoost and the logistic baseline are within 0.002 ROC-AUC of each other;
CatBoost is the deployed artifact because it also provides the SHAP explanations and the
slightly better grouped-CV metrics. The logistic model is kept as a benchmark and a
fallback.

Training is deterministic: CatBoost runs single-threaded (`thread_count=1`) because
multi-threaded fitting changes the floating-point summation order and silently moves the
reported metrics between runs. Two independent training runs produce identical metrics.

## Capacity-based risk tiers

Tiers are set from out-of-fold CatBoost probabilities, not from a fixed 0.5 threshold:

- `support`: top 10% (`probability >= 0.9134`)
- `watch`: next 20% (`0.5409 <= probability < 0.9134`)
- `on-track`: remaining 70%

Out-of-fold counts: 2,637 support, 5,272 watch, 18,452 on-track.
Final scored counts: 2,659 support, 5,232 watch, 18,470 on-track.

The tier vocabulary (`support | watch | on-track`) is frozen and matches the frontend
`RiskLevel` type.

## What drives the model

Global drivers are computed from **out-of-fold** explanations, so no row is explained by a
model that trained on it.

| Group | Share of mean absolute SHAP |
| --- | ---: |
| Assessment scores | 27.0% |
| Recent VLE activity | 21.2% |
| Module context | 15.2% |
| Submission timing | 11.5% |
| Missed assessments | 10.7% |
| VLE breadth | 6.9% |
| Total VLE engagement | 4.5% |
| Prior attempts | 1.8% |
| Credits and registration | 1.0% |
| Banked credit | 0.2% |

Top individual features: `n_missing_60`, `weighted_score_60`, `n_ontime_60`, `avg_score_60`,
`vle_active_days_last_14_days_60`, `weight_due_60`, `last_score_60`,
`vle_active_days_31_60`, `code_module`, `vle_clicks_31_60`, `days_since_last_vle_60`,
`min_score_60`.

Campus attendance is not an OULAD field and is **not** used by this model.

## Fairness audit

Protected attributes are used only for evaluation. The audit computes selection-rate and
recall gaps at the global top-20% threshold.

| Attribute | Selection-rate gap | Recall gap |
| --- | ---: | ---: |
| highest education | 0.221 | 0.213 |
| IMD band | 0.132 | 0.071 |
| age band | 0.112 | 0.156 |
| region | 0.098 | 0.105 |
| disability | 0.063 | 0.025 |
| gender | 0.057 | 0.100 |

The largest gap is a known limitation of this validation run and must be reviewed before
any production deployment. Full subgroup results are in `artifacts/fairness.json`.

## Prediction payload (frozen)

`ml/predict.py` is the serving entry point. It validates the incoming feature frame,
scores it and returns the risk tier plus the top explanation drivers.

```bash
# Score a feature table and write a flat result table
ml/.venv/bin/python -m ml.predict \
    --input ml/data/features_cutoff60.parquet \
    --output ml/data/scored_predictions.parquet

# Emit the JSON payload the API will return
ml/.venv/bin/python -m ml.predict \
    --input ml/data/features_cutoff60.parquet \
    --json /tmp/eidx_payload.json --limit 5

# Regenerate the published schema
ml/.venv/bin/python -m ml.predict --write-schema
```

Payload shape (schema: `artifacts/prediction_payload.schema.json`):

```json
{
  "model_version": "catboost-cutoff60-...",
  "cutoff_day": 60,
  "generated_at": "2026-11-26T06:53:22.062321+00:00",
  "student_ref": "684184",
  "module_ref": "BBB",
  "risk_probability": 0.0877,
  "risk_tier": "on-track",
  "drivers": [
    {
      "feature": "avg_score_60",
      "label": "Average assessment score",
      "group": "Assessment scores",
      "value": 92.0,
      "display": "92.0",
      "shap_value": -0.2956,
      "direction": "reduces-risk"
    }
  ]
}
```

Rules for whoever implements the API:

- `risk_tier` is one of `support`, `watch`, `on-track`.
- `drivers` contains at most five entries, ordered by absolute SHAP value.
- `direction` is `increases-risk` when the SHAP value is positive, otherwise
  `reduces-risk`.
- The payload is **staff-only**. It must never appear in `/me/*` responses, card passes or
  card-update payloads.

## Reproduce locally

From the project root:

```bash
uv venv ml/.venv --python 3.12
uv pip install --python ml/.venv/bin/python -r ml/requirements.txt
# or, for an exact match to the committed run:
uv pip install --python ml/.venv/bin/python -r ml/requirements-lock.txt

# Import the seven OULAD CSVs into DuckDB, build the cutoff-60 table and export Parquet.
ml/.venv/bin/python -m ml.build_features --rebuild-db

# Train, evaluate, explain and export artifacts.
ml/.venv/bin/python -m ml.train

# Check the contract, leakage guards and artifacts.
ml/.venv/bin/python -m ml.verify
```

The feature build uses DuckDB with a 1.8GB memory limit and a disk temporary directory. It
never loads the 10.6M-row VLE CSV into pandas, and it aggregates only students who are
still enrolled at the cutoff.

## Outputs

| File | Purpose |
| --- | --- |
| `data/features_cutoff60.parquet` | One row per active student-module at day 60 (generated) |
| `data/oof_shap_values.parquet` | Full out-of-fold explanation matrix (generated) |
| `data/cohort_meta.parquet` | Demographics and outcome fields for the fairness audit only (generated) |
| `data/feature_meta.json` | Feature contract, source hashes and build statistics |
| `artifacts/catboost_model.cbm` | Final CatBoost model |
| `artifacts/logistic_model.joblib` | Logistic baseline model |
| `artifacts/metrics.json` | CV, temporal, fairness, SHAP and tier metrics |
| `artifacts/model_meta.json` | Deployment-facing model contract and thresholds |
| `artifacts/model_card.md` | Human-readable model card |
| `artifacts/prediction_payload.schema.json` | Frozen JSON schema for the prediction payload |
| `artifacts/predictions.parquet` | OOF and final probabilities and tiers (generated) |
| `artifacts/temporal_predictions.parquet` | Held-out 2014J probabilities (generated) |
| `artifacts/feature_importance.csv` | CatBoost feature importance |
| `artifacts/shap_values.parquet` | Sampled out-of-fold SHAP values |
| `artifacts/shap_importance.csv` | Mean absolute SHAP by feature |
| `artifacts/shap_group_importance.csv` | Product-facing grouped SHAP shares |
| `artifacts/shap_summary.png` | SHAP beeswarm plot |
| `artifacts/shap_importance_bar.png` | SHAP bar plot |
| `artifacts/calibration.png` | OOF calibration curve |
| `artifacts/fairness.json` | Subgroup fairness audit |

## Next step

The prediction contract is frozen. The backend should store the aggregated feature snapshot
and the latest risk probability/tier, not raw VLE clicks. The student card and
student-facing responses must never include risk, its drivers or its probability.
