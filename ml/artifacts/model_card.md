# E-IDX academic risk model card

**Model:** CatBoost binary classifier
**Version:** `catboost-cutoff60-20261126065719`
**Trained:** 2026-11-26T06:57:19.914277+00:00
**Status:** research / capstone validation model, not a production deployment

## Intended use

Rank active students by the likelihood of failing or withdrawing from a module, so a
mentor can offer support earlier. The output is decision support for staff. It is never
an automatic sanction and never reaches the student card or the student-facing app.

## Out-of-scope use

- Predicting a sanction, detention, grade, fee decision or attendance verdict.
- Scoring students who already left the module before the cutoff.
- Ranking staff, departments or institutions.
- Any use of protected attributes as model inputs.

## Data and target

| Item | Value |
| --- | --- |
| Dataset | OULAD (Kuzilek et al., 2017), CC BY 4.0 |
| Unit of prediction | Student-module enrolment |
| Target | `at_risk = final_result in {Fail, Withdrawn}` |
| Cutoff | Day 60 of the presentation |
| Cohort | Still enrolled at the cutoff; 6,232 earlier withdrawals excluded |
| Training rows | 26,361 |
| Unique students | 23,985 |
| At-risk rate | 41.64% |
| Features | 45 |

## Validation

Five-fold validation grouped by student, so no student appears in both training and
validation. The temporal holdout trains on earlier presentations and tests on 2014J with
every overlapping student removed from training.

| Metric | CatBoost (grouped CV) | Logistic baseline | CatBoost (2014J holdout) |
| --- | ---: | ---: | ---: |
| ROC-AUC | 0.8344 | 0.8316 | 0.8044 |
| PR-AUC | 0.8151 | 0.8101 | 0.7577 |
| Brier score | 0.1579 | 0.1594 | 0.1683 |
| Calibration error (10 bins) | 0.0090 | 0.0042 | 0.0258 |
| Recall at top 10% | 0.2343 | 0.2324 | 0.2475 |
| Precision at top 10% | 0.9757 | 0.9678 | 0.9433 |
| Recall at top 20% | 0.4314 | 0.4290 | 0.4290 |
| Precision at top 20% | 0.8981 | 0.8932 | 0.8175 |

## Risk tiers

Tiers are capacity-based quantiles of the out-of-fold probability, not a fixed 0.5 cut.

| Tier | Rule | Threshold | Share |
| --- | --- | ---: | ---: |
| support | top 10% | >= 0.9134 | 2,637 |
| watch | next 20% | >= 0.5409 | 5,272 |
| on-track | remainder | below 0.5409 | 18,452 |

## What drives the model

Global drivers are computed from out-of-fold explanations, so no row is explained by a
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

| Label | Feature | Mean absolute SHAP |
| --- | --- | ---: |
| Missed assessments | `n_missing_60` | 0.2724 |
| Weighted assessment score | `weighted_score_60` | 0.2512 |
| On-time submissions | `n_ontime_60` | 0.2334 |
| Average assessment score | `avg_score_60` | 0.2183 |
| VLE active days in the last 14 days | `vle_active_days_last_14_days_60` | 0.1959 |
| Assessment weight due by day 60 | `weight_due_60` | 0.1907 |
| Most recent assessment score | `last_score_60` | 0.1867 |
| VLE active days in days 31-60 | `vle_active_days_31_60` | 0.1562 |
| Module | `code_module` | 0.1320 |
| VLE clicks in days 31-60 | `vle_clicks_31_60` | 0.1140 |
| Days since last VLE activity | `days_since_last_vle_60` | 0.1059 |
| Lowest assessment score | `min_score_60` | 0.0731 |

## Fairness audit

Protected attributes are excluded from the model and used only for this audit. The table
reports the gap between the best and worst subgroup at the global top-20% selection rate.

| Attribute | Selection-rate gap | Recall gap |
| --- | ---: | ---: |
| gender | 0.057 | 0.098 |
| disability | 0.063 | 0.032 |
| age_band | 0.112 | 0.130 |
| imd_band | 0.132 | 0.072 |
| region | 0.098 | 0.110 |
| highest_education | 0.221 | 0.237 |

The largest observed gap is a known limitation of this validation run and must be
reviewed before any production deployment.

## Known limitations

- The 2014J temporal holdout is the honest estimate; performance drops by roughly
  0.030 ROC-AUC against grouped CV.
- OULAD has no physical attendance, SGPA trend, fee status or campus-card tap data, so
  none of those appear as model drivers.
- At-risk combines two different outcomes, fail and withdrawal. A later model should
  separate them.
- Around 3,975 active enrolments
  have no scored assessment at the cutoff and rely mainly on VLE engagement.
- Risk is a module-level signal; a student enrolled in several modules needs an explicit
  aggregation rule at serving time.

## Privacy invariants

1. Risk probability, tier and drivers never appear on the student card, in a signed pass,
   in `/me/*` responses or in card-update payloads.
2. Raw VLE click rows are never stored in the application database; only aggregated
   feature snapshots and the latest prediction are.
3. Staff access to risk explanations is role-scoped and auditable.

## Reproduction

```bash
uv venv ml/.venv --python 3.12
uv pip install --python ml/.venv/bin/python -r ml/requirements.txt
ml/.venv/bin/python -m ml.build_features --rebuild-db
ml/.venv/bin/python -m ml.train
ml/.venv/bin/python -m ml.verify
```

## Citation

Kuzilek, J., Hachimaru, M. and Brophy, J. (2017). Open University Learning Analytics
Dataset. *Scientific Data*, 4, 170171. https://doi.org/10.1038/sdata.2017.171
