"""Score student-module feature rows with the frozen E-IDX risk model.

This is the serving-side entry point for the model contract. It loads the
trained CatBoost artifact, validates the incoming feature frame, produces the
risk probability, the capacity-based risk tier and the top explanation
drivers, and can emit a JSON payload that matches
`ml/artifacts/prediction_payload.schema.json`.

Examples
--------
Score a Parquet file of feature rows and write a flat result table:

    ml/.venv/bin/python -m ml.predict \
        --input ml/data/features_cutoff60.parquet \
        --output ml/data/scored_predictions.parquet

Emit the JSON payload for the first rows (API integration example):

    ml/.venv/bin/python -m ml.predict \
        --input ml/data/features_cutoff60.parquet \
        --json /tmp/eidx_payload.json --limit 5

Regenerate the payload schema:

    ml/.venv/bin/python -m ml.predict --write-schema
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import shap
from catboost import CatBoostClassifier

from ml.config import (
    ARTIFACTS_DIR,
    CATEGORICAL_FEATURES,
    FEATURE_COLUMNS,
    FEATURE_GROUPS,
    FEATURE_LABELS,
    ID_COLUMNS,
    MODEL_CARD_PATH,
    NUMERIC_FEATURES,
    PREDICTION_SCHEMA_PATH,
    RISK_TIERS,
)

MODEL_PATH = ARTIFACTS_DIR / "catboost_model.cbm"
MODEL_META_PATH = ARTIFACTS_DIR / "model_meta.json"

FEATURE_TO_GROUP = {
    feature: group for group, features in FEATURE_GROUPS.items() for feature in features
}


def log(message: str) -> None:
    print(f"[predict] {message}", flush=True)


def load_model_contract() -> dict:
    if not MODEL_META_PATH.exists():
        raise FileNotFoundError(
            f"{MODEL_META_PATH} not found. Run `python -m ml.train` first."
        )
    contract = json.loads(MODEL_META_PATH.read_text(encoding="utf-8"))
    contract_features = contract.get("feature_columns", [])
    if contract_features != FEATURE_COLUMNS:
        raise RuntimeError(
            "The trained artifact and ml/config.py disagree on the feature list. "
            "Retrain the model (`python -m ml.train`) before scoring."
        )
    return contract


def load_model() -> CatBoostClassifier:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"{MODEL_PATH} not found. Run `python -m ml.train` first."
        )
    model = CatBoostClassifier()
    model.load_model(str(MODEL_PATH))
    return model


def prepare_input(frame: pd.DataFrame) -> pd.DataFrame:
    missing = [column for column in FEATURE_COLUMNS if column not in frame.columns]
    if missing:
        raise ValueError(
            "Input is missing required model features: "
            + ", ".join(missing)
            + ". Rebuild the feature snapshot with `python -m ml.build_features`."
        )
    prepared = frame.copy()
    for column in CATEGORICAL_FEATURES:
        prepared[column] = prepared[column].astype(str)
    for column in NUMERIC_FEATURES:
        prepared[column] = pd.to_numeric(prepared[column], errors="coerce")
    return prepared


def risk_tier(probability: float, support_threshold: float, watch_threshold: float) -> str:
    if probability >= support_threshold:
        return "support"
    if probability >= watch_threshold:
        return "watch"
    return "on-track"


def display_value(feature: str, value) -> str | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    if math.isnan(number):
        return None
    if feature.endswith("_rate_60") or feature.endswith("_share_60"):
        return f"{number * 100:.0f}%"
    if "score" in feature and feature != "n_scored_60":
        return f"{number:.1f}"
    if number.is_integer():
        return str(int(number))
    return f"{number:.2f}"


def explain_rows(
    model: CatBoostClassifier,
    features: pd.DataFrame,
    top_k: int,
) -> list[list[dict]]:
    """Return the top explanation drivers for every row."""
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(features)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
    shap_values = np.asarray(shap_values)
    if shap_values.shape != (len(features), len(FEATURE_COLUMNS)):
        raise RuntimeError(f"Unexpected SHAP shape: {shap_values.shape}")

    drivers: list[list[dict]] = []
    for row_idx in range(len(features)):
        contributions = shap_values[row_idx]
        order = np.argsort(-np.abs(contributions))[:top_k]
        row_drivers = []
        for feature_idx in order:
            feature = FEATURE_COLUMNS[feature_idx]
            raw_value = features.iloc[row_idx][feature]
            value = None
            if raw_value is not None and not (
                isinstance(raw_value, float) and math.isnan(raw_value)
            ):
                value = float(raw_value)
            shap_value = float(contributions[feature_idx])
            row_drivers.append(
                {
                    "feature": feature,
                    "label": FEATURE_LABELS.get(feature, feature),
                    "group": FEATURE_TO_GROUP.get(feature, "Other"),
                    "value": value,
                    "display": display_value(feature, raw_value),
                    "shap_value": shap_value,
                    "direction": (
                        "increases-risk" if shap_value >= 0 else "reduces-risk"
                    ),
                }
            )
        drivers.append(row_drivers)
    return drivers


def predict_frame(
    frame: pd.DataFrame,
    model: CatBoostClassifier | None = None,
    contract: dict | None = None,
    top_k: int = 5,
) -> tuple[pd.DataFrame, list[list[dict]]]:
    """Score rows and return a flat result table plus per-row driver lists."""
    contract = contract or load_model_contract()
    model = model or load_model()
    prepared = prepare_input(frame)
    features = prepared[FEATURE_COLUMNS]

    probability = model.predict_proba(features)[:, 1]
    support_threshold = float(contract["needs_support_threshold"])
    watch_threshold = float(contract["watch_threshold"])
    generated_at = datetime.now(timezone.utc).isoformat()

    drivers = explain_rows(model, features, top_k)

    result = pd.DataFrame(index=prepared.index)
    for column in ID_COLUMNS:
        if column in prepared.columns:
            result[column] = prepared[column]
    if "at_risk" in prepared.columns:
        result["at_risk"] = prepared["at_risk"]
    result["risk_probability"] = probability
    result["risk_tier"] = [
        risk_tier(float(p), support_threshold, watch_threshold) for p in probability
    ]
    result["model_version"] = contract["model_version"]
    result["cutoff_day"] = int(contract["cutoff_day"])
    result["generated_at"] = generated_at

    for position in range(top_k):
        result[f"driver_{position + 1}_label"] = [
            row[position]["label"] if len(row) > position else None for row in drivers
        ]
        result[f"driver_{position + 1}_direction"] = [
            row[position]["direction"] if len(row) > position else None
            for row in drivers
        ]
        result[f"driver_{position + 1}_value"] = [
            row[position]["value"] if len(row) > position else None for row in drivers
        ]
        result[f"driver_{position + 1}_shap"] = [
            row[position]["shap_value"] if len(row) > position else None
            for row in drivers
        ]

    return result, drivers


def build_payload(
    result: pd.DataFrame, drivers: list[list[dict]], contract: dict
) -> list[dict]:
    payloads = []
    for idx in range(len(result)):
        row = result.iloc[idx]
        payload = {
            "model_version": contract["model_version"],
            "cutoff_day": int(contract["cutoff_day"]),
            "generated_at": row["generated_at"],
            "risk_probability": float(row["risk_probability"]),
            "risk_tier": row["risk_tier"],
            "drivers": drivers[idx],
        }
        if "id_student" in result.columns:
            payload["student_ref"] = str(row["id_student"])
        if "code_module" in result.columns:
            payload["module_ref"] = str(row["code_module"])
        payloads.append(payload)
    return payloads


def payload_schema() -> dict:
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://eidx.local/schemas/academic-risk-prediction-v1.json",
        "title": "EIDXAcademicRiskPrediction",
        "description": (
            "Staff-only academic risk prediction for one student-module enrolment. "
            "Never expose this payload on student card or student-facing surfaces."
        ),
        "type": "object",
        "additionalProperties": False,
        "required": [
            "model_version",
            "cutoff_day",
            "generated_at",
            "risk_probability",
            "risk_tier",
            "drivers",
        ],
        "properties": {
            "model_version": {"type": "string"},
            "cutoff_day": {"type": "integer", "minimum": 1},
            "generated_at": {"type": "string", "format": "date-time"},
            "student_ref": {"type": "string"},
            "module_ref": {"type": "string"},
            "risk_probability": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
            },
            "risk_tier": {"type": "string", "enum": list(RISK_TIERS)},
            "drivers": {
                "type": "array",
                "maxItems": 5,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "feature",
                        "label",
                        "group",
                        "value",
                        "display",
                        "shap_value",
                        "direction",
                    ],
                    "properties": {
                        "feature": {"type": "string"},
                        "label": {"type": "string"},
                        "group": {"type": "string"},
                        "value": {"type": ["number", "null"]},
                        "display": {"type": ["string", "null"]},
                        "shap_value": {"type": "number"},
                        "direction": {
                            "type": "string",
                            "enum": ["increases-risk", "reduces-risk"],
                        },
                    },
                },
            },
        },
    }


def write_schema() -> None:
    PREDICTION_SCHEMA_PATH.parent.mkdir(parents=True, exist_ok=True)
    PREDICTION_SCHEMA_PATH.write_text(
        json.dumps(payload_schema(), indent=2), encoding="utf-8"
    )
    log(f"Wrote {PREDICTION_SCHEMA_PATH}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", help="Parquet/CSV file with the model feature columns.")
    parser.add_argument("--output", help="Where to write the flat scored table.")
    parser.add_argument("--json", dest="json_output", help="Where to write the JSON payload.")
    parser.add_argument("--limit", type=int, default=0, help="Only score the first N rows.")
    parser.add_argument("--top-drivers", type=int, default=5)
    parser.add_argument("--write-schema", action="store_true")
    args = parser.parse_args()

    if args.write_schema:
        write_schema()
        if not args.input:
            return 0

    if not args.input:
        parser.error("--input is required unless --write-schema is used")

    input_path = Path(args.input)
    if not input_path.exists():
        raise FileNotFoundError(f"{input_path} does not exist")
    if input_path.suffix.lower() == ".csv":
        frame = pd.read_csv(input_path)
    else:
        frame = pd.read_parquet(input_path)
    if args.limit:
        frame = frame.head(args.limit)
    log(f"Scoring {len(frame):,} rows from {input_path}")

    contract = load_model_contract()
    model = load_model()
    result, drivers = predict_frame(
        frame, model=model, contract=contract, top_k=args.top_drivers
    )

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        result.to_parquet(output_path, index=False)
        log(f"Wrote {output_path}")

    if args.json_output:
        json_path = Path(args.json_output)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        payload = build_payload(result, drivers, contract)
        json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        log(f"Wrote {json_path}")

    print("\nScored summary")
    print(f"  rows: {len(result):,}")
    print(f"  tier counts: {result['risk_tier'].value_counts().to_dict()}")
    print(f"  probability: min={result['risk_probability'].min():.4f} "
          f"median={result['risk_probability'].median():.4f} "
          f"max={result['risk_probability'].max():.4f}")
    if MODEL_CARD_PATH.exists():
        print(f"  model card: {MODEL_CARD_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
