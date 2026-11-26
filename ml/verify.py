"""Verify the E-IDX ML pipeline: contract hygiene, leakage guards and artifacts.

Run this after `build_features` and `train`:

    ml/.venv/bin/python -m ml.verify

The script exits with status 0 when every executable check passes, 1 otherwise.
Checks that need a dataset which is not committed to Git are reported as SKIP
when the dataset is absent, so the script is still useful on a fresh clone.
"""

from __future__ import annotations

import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier

from ml.config import (
    ARTIFACTS_DIR,
    CATEGORICAL_FEATURES,
    COHORT_META_PATH,
    CUTOFF_DAY,
    DATA_DIR,
    DB_PATH,
    FEATURES_PATH,
    FEATURE_COLUMNS,
    FEATURE_GROUPS,
    FEATURE_LABELS,
    FEATURE_META_PATH,
    FORBIDDEN_FEATURE_TOKENS,
    ID_COLUMNS,
    MODEL_CARD_PATH,
    NUMERIC_FEATURES,
    OULAD_DIR,
    PREDICTION_SCHEMA_PATH,
    RISK_TIERS,
    TARGET,
)

from ml.train import CATBOOST_PARAMS

MODEL_PATH = ARTIFACTS_DIR / "catboost_model.cbm"
MODEL_META_PATH = ARTIFACTS_DIR / "model_meta.json"
METRICS_PATH = ARTIFACTS_DIR / "metrics.json"
PREDICTIONS_PATH = ARTIFACTS_DIR / "predictions.parquet"
SHAP_VALUES_PATH = ARTIFACTS_DIR / "shap_values.parquet"
FAIRNESS_PATH = ARTIFACTS_DIR / "fairness.json"

RAW_FILES = [
    "courses.csv",
    "assessments.csv",
    "studentInfo.csv",
    "studentRegistration.csv",
    "studentAssessment.csv",
    "vle.csv",
    "studentVle.csv",
]

# Features that are legitimately known before the module starts and therefore
# are not bound to a cutoff-day suffix.
CONTEXT_FEATURES = {
    "code_module",
    "num_of_prev_attempts",
    "studied_credits",
    "registration_lead_days",
    "module_presentation_length",
    "assessment_count_total",
    "first_assessment_day",
}


class Results:
    def __init__(self) -> None:
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.failures: list[str] = []

    def ok(self, name: str, detail: str = "") -> None:
        self.passed += 1
        print(f"PASS  {name}" + (f" - {detail}" if detail else ""))

    def fail(self, name: str, detail: str) -> None:
        self.failed += 1
        self.failures.append(f"{name}: {detail}")
        print(f"FAIL  {name} - {detail}")

    def skip(self, name: str, detail: str) -> None:
        self.skipped += 1
        print(f"SKIP  {name} - {detail}")

    def check(self, name: str, condition: bool, detail: str = "") -> bool:
        if condition:
            self.ok(name, detail)
        else:
            self.fail(name, detail or "condition not met")
        return condition


def verify_contract(results: Results) -> None:
    """The feature contract must never contain protected or post-outcome fields."""
    violations = [
        feature
        for feature in FEATURE_COLUMNS
        for token in FORBIDDEN_FEATURE_TOKENS
        if token in feature.lower()
    ]
    results.check(
        "feature contract excludes protected/outcome fields",
        not violations,
        f"violations: {violations}" if violations else f"{len(FEATURE_COLUMNS)} features",
    )

    def window_end_day(feature: str) -> int | None:
        match = re.search(r"_(\d+)$", feature)
        return int(match.group(1)) if match else None

    unbounded = sorted(
        feature
        for feature in FEATURE_COLUMNS
        if feature not in CONTEXT_FEATURES
        and (
            window_end_day(feature) is None
            or window_end_day(feature) > CUTOFF_DAY
        )
    )
    results.check(
        f"behavioural feature windows end on or before day {CUTOFF_DAY}",
        not unbounded,
        f"post-cutoff or unparseable: {unbounded}"
        if unbounded
        else "earlier windows (day 30) and day-60 windows only",
    )

    missing_labels = sorted(set(FEATURE_COLUMNS) - set(FEATURE_LABELS))
    results.check(
        "every feature has a product-facing label",
        not missing_labels,
        f"missing: {missing_labels}" if missing_labels else "45/45 labelled",
    )

    grouped = [feature for features in FEATURE_GROUPS.values() for feature in features]
    results.check(
        "every feature belongs to exactly one explanation group",
        sorted(grouped) == sorted(FEATURE_COLUMNS) and len(grouped) == len(set(grouped)),
        f"{len(FEATURE_GROUPS)} groups",
    )


def verify_artifacts(results: Results) -> dict | None:
    """Artifacts must exist and agree with the code-level contract."""
    missing = [
        str(path)
        for path in [
            MODEL_PATH,
            MODEL_META_PATH,
            METRICS_PATH,
            PREDICTIONS_PATH,
            SHAP_VALUES_PATH,
            FAIRNESS_PATH,
            PREDICTION_SCHEMA_PATH,
            MODEL_CARD_PATH,
        ]
        if not path.exists()
    ]
    if not results.check(
        "model artifacts are present",
        not missing,
        f"missing: {missing}" if missing else f"{len(list(ARTIFACTS_DIR.iterdir()))} files",
    ):
        return None

    contract = json.loads(MODEL_META_PATH.read_text(encoding="utf-8"))
    results.check(
        "artifact feature list matches ml/config.py",
        contract.get("feature_columns") == FEATURE_COLUMNS,
        f"{len(contract.get('feature_columns', []))} features",
    )
    results.check(
        "artifact cutoff matches the training contract",
        int(contract.get("cutoff_day", -1)) == CUTOFF_DAY,
        f"cutoff day {contract.get('cutoff_day')}",
    )
    results.check(
        "artifact risk tiers use the API vocabulary",
        set(contract.get("risk_tier_labels", {}).values()) == set(RISK_TIERS),
        f"{sorted(set(contract.get('risk_tier_labels', {}).values()))}",
    )
    results.check(
        "model card is present and non-empty",
        MODEL_CARD_PATH.stat().st_size > 2000,
        f"{MODEL_CARD_PATH.stat().st_size:,} bytes",
    )
    return contract


def verify_model_roundtrip(results: Results, contract: dict) -> None:
    """Reloading the saved model must reproduce the stored predictions exactly."""
    if not FEATURES_PATH.exists() or not PREDICTIONS_PATH.exists():
        results.skip("model reload reproduces stored predictions", "feature table missing")
        return

    df = pd.read_parquet(FEATURES_PATH)
    stored = pd.read_parquet(PREDICTIONS_PATH)
    model = CatBoostClassifier()
    model.load_model(str(MODEL_PATH))
    recomputed = model.predict_proba(df[FEATURE_COLUMNS])[:, 1]
    difference = float(
        np.max(np.abs(recomputed - stored["final_prediction"].to_numpy()))
    )
    results.check(
        "model reload reproduces stored predictions",
        difference < 1e-12,
        f"max abs difference {difference:.2e}",
    )

    # Split integrity: a student may only appear in one validation fold.
    folds_per_student = stored.groupby("id_student")["fold"].nunique()
    results.check(
        "no student spans multiple validation folds",
        int((folds_per_student > 1).sum()) == 0,
        f"{stored['id_student'].nunique():,} students",
    )

    # Tier thresholds must reproduce the published tier counts.
    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    oof = stored["oof_prediction"].to_numpy()
    support_threshold = float(contract["needs_support_threshold"])
    watch_threshold = float(contract["watch_threshold"])
    counts = {
        "support": int((oof >= support_threshold).sum()),
        "watch": int(((oof >= watch_threshold) & (oof < support_threshold)).sum()),
        "on-track": int((oof < watch_threshold).sum()),
    }
    expected = metrics["risk_tiers"]["oof_tier_counts"]
    results.check(
        "risk tier thresholds reproduce published counts",
        counts == expected,
        f"{counts}",
    )

    # The explanation matrix must be complete and finite.
    shap_values = pd.read_parquet(SHAP_VALUES_PATH)
    shap_columns = [column for column in shap_values.columns if column.startswith("shap__")]
    results.check(
        "SHAP artifact has one value per feature and no gaps",
        len(shap_columns) == len(FEATURE_COLUMNS)
        and int(shap_values[shap_columns].isna().sum().sum()) == 0,
        f"{len(shap_columns)} columns, {len(shap_values):,} rows",
    )

    # Training must be reproducible: the same seed must give the same model.
    sample = df.head(5000)
    fit_params = dict(CATBOOST_PARAMS)
    fit_params["iterations"] = 100
    first = CatBoostClassifier(**fit_params, cat_features=CATEGORICAL_FEATURES)
    first.fit(sample[FEATURE_COLUMNS], sample[TARGET])
    second = CatBoostClassifier(**fit_params, cat_features=CATEGORICAL_FEATURES)
    second.fit(sample[FEATURE_COLUMNS], sample[TARGET])
    difference = float(
        np.max(
            np.abs(
                first.predict_proba(sample[FEATURE_COLUMNS])[:, 1]
                - second.predict_proba(sample[FEATURE_COLUMNS])[:, 1]
            )
        )
    )
    results.check(
        "training is deterministic for a fixed seed",
        difference == 0.0,
        f"max abs difference {difference:.2e}",
    )

    # Serving robustness: unseen module and fully missing behavioural features.
    probe = df[FEATURE_COLUMNS].head(3).copy()
    probe["code_module"] = "ZZZ_UNSEEN_MODULE"
    try:
        model.predict_proba(probe)
        unseen_ok = True
    except Exception as exc:  # pragma: no cover - defensive
        unseen_ok = False
        unseen_error = f"{type(exc).__name__}: {exc}"
    results.check(
        "model scores an unseen module code",
        unseen_ok,
        "no exception" if unseen_ok else unseen_error,
    )

    probe_missing = df[FEATURE_COLUMNS].head(3).copy()
    probe_missing[NUMERIC_FEATURES] = np.nan
    try:
        model.predict_proba(probe_missing)
        missing_ok = True
    except Exception as exc:  # pragma: no cover - defensive
        missing_ok = False
        missing_error = f"{type(exc).__name__}: {exc}"
    results.check(
        "model scores a row with no behavioural history",
        missing_ok,
        "no exception" if missing_ok else missing_error,
    )


def verify_feature_table(results: Results) -> None:
    """The feature table must match the cohort rule and contain no outcome leaks."""
    if not FEATURES_PATH.exists():
        results.skip("feature table checks", f"{FEATURES_PATH} not built")
        return

    df = pd.read_parquet(FEATURES_PATH)
    results.check(
        "feature table contains every contract feature",
        all(column in df.columns for column in FEATURE_COLUMNS),
        f"{len(df):,} rows, {len(df.columns)} columns",
    )
    results.check(
        "feature table excludes protected attributes",
        not any(
            column in df.columns
            for column in [
                "gender",
                "region",
                "highest_education",
                "imd_band",
                "age_band",
                "disability",
                "final_result",
                "date_unregistration",
            ]
        ),
        "no outcome or protected columns present",
    )

    if FEATURE_META_PATH.exists():
        meta = json.loads(FEATURE_META_PATH.read_text(encoding="utf-8"))
        stats = meta.get("stats", {})
        results.check(
            "feature table row count matches build metadata",
            int(stats.get("feature_rows", -1)) == len(df),
            f"{stats.get('feature_rows')} rows",
        )

    if COHORT_META_PATH.exists():
        meta = pd.read_parquet(COHORT_META_PATH)
        early = meta[meta["date_unregistration"].notna()]
        early = early[early["date_unregistration"] <= CUTOFF_DAY]
        results.check(
            f"no enrolment unregistered on or before day {CUTOFF_DAY} is in the cohort",
            len(early) == 0,
            f"{len(early)} early withdrawals excluded",
        )
        results.check(
            "cohort metadata matches the feature table size",
            len(meta) == len(df),
            f"{len(meta):,} rows",
        )
    else:
        results.skip("early-withdrawal exclusion", f"{COHORT_META_PATH} missing")


def verify_payload_contract(results: Results) -> None:
    """The frozen payload schema must describe the values we actually emit."""
    if not PREDICTION_SCHEMA_PATH.exists():
        results.fail("payload schema is published", f"{PREDICTION_SCHEMA_PATH} missing")
        return
    schema = json.loads(PREDICTION_SCHEMA_PATH.read_text(encoding="utf-8"))
    required = set(schema.get("required", []))
    properties = set(schema.get("properties", {}))
    results.check(
        "payload schema marks risk fields as required",
        {"risk_probability", "risk_tier", "drivers"} <= required,
        f"required: {sorted(required)}",
    )
    results.check(
        "payload schema restricts the risk tier vocabulary",
        schema["properties"]["risk_tier"].get("enum") == list(RISK_TIERS),
        f"{schema['properties']['risk_tier'].get('enum')}",
    )
    results.check(
        "payload schema declares every driver field",
        set(schema["properties"]["drivers"]["items"]["required"])
        == {
            "feature",
            "label",
            "group",
            "value",
            "display",
            "shap_value",
            "direction",
        },
        "driver contract complete",
    )


def verify_source_data(results: Results) -> None:
    """The raw OULAD files must be present locally with the expected names."""
    missing = [name for name in RAW_FILES if not (OULAD_DIR / name).exists()]
    if missing:
        results.skip(
            "raw OULAD files present",
            f"missing (datasets are not committed): {', '.join(missing)}",
        )
        return
    results.ok("raw OULAD files present", f"{len(RAW_FILES)} files in {OULAD_DIR}")


def main() -> int:
    print("E-IDX ML verification")
    print(f"  generated at {datetime.now(timezone.utc).isoformat()}")
    print(f"  artifacts: {ARTIFACTS_DIR}")
    print(f"  features:  {FEATURES_PATH}\n")

    results = Results()

    verify_contract(results)
    contract = verify_artifacts(results)
    if contract is not None:
        verify_model_roundtrip(results, contract)
    verify_feature_table(results)
    verify_payload_contract(results)
    verify_source_data(results)

    print("\nSummary")
    print(f"  passed:  {results.passed}")
    print(f"  failed:  {results.failed}")
    print(f"  skipped: {results.skipped}")
    if results.failures:
        print("\nFailures")
        for failure in results.failures:
            print(f"  - {failure}")
        return 1
    print("\nAll executable checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
