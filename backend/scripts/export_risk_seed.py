"""Export a backend seed file from the trained OULAD risk model.

The backend never scores on the fly: the platform stores the model output
that the ML pipeline produced. This script turns the frozen artifacts into
`backend/seed/risk_seed.json`, which `npm run seed` loads into PostgreSQL.

What is exported
----------------
* One enrolment per sampled student, with the out-of-fold probability, the
  capacity-based tier and the five strongest out-of-fold SHAP drivers.
* The aggregated feature snapshot for the same row, so the database holds the
  model input without any raw VLE click log.

Honesty notes
-------------
* Probabilities and drivers come from the out-of-fold predictions, so no row
  is explained by a model that trained on it.
* OULAD module codes are mapped onto campus course codes for the preview
  seed. The original OULAD module and presentation are kept alongside the
  campus code in the feature snapshot.

Run with the project virtualenv:

    ml/.venv/bin/python backend/scripts/export_risk_seed.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from ml.config import (  # noqa: E402
    ARTIFACTS_DIR,
    DATA_DIR,
    FEATURE_COLUMNS,
    FEATURE_GROUPS,
    FEATURE_LABELS,
)
from ml.predict import display_value  # noqa: E402

SEED_PATH = ROOT / "backend" / "seed" / "risk_seed.json"
FEATURES_PATH = DATA_DIR / "features_cutoff60.parquet"
OOF_SHAP_PATH = DATA_DIR / "oof_shap_values.parquet"
PREDICTIONS_PATH = ARTIFACTS_DIR / "predictions.parquet"
MODEL_META_PATH = ARTIFACTS_DIR / "model_meta.json"

# Campus course codes for the preview seed.
MODULE_TO_COURSE = {
    "AAA": "CS601",
    "BBB": "CS602",
    "CCC": "CS603",
    "DDD": "CS604",
}
COURSE_TITLES = {
    "CS601": "Software engineering",
    "CS602": "Machine learning",
    "CS603": "Cloud computing",
    "CS604": "Minor project",
}

# Campus size used by the frontend preview and therefore by the seed.
CAMPUS_SIZE = 4786
TIER_COUNTS = {"support": 479, "watch": 957, "on-track": 3350}

DEMO_USNS = [
    "1DS23CS0084",
    "1DS23CS0056",
    "1DS23CS0017",
    "1DS23CS0031",
    "1DS23CS0063",
    "1DS23CS0071",
    "1DS23CS0038",
    "1DS23CS0009",
    "1DS23CS0012",
    "1DS23CS0024",
    "1DS23CS0029",
    "1DS23CS0048",
]
DEMO_TIERS = {
    "1DS23CS0084": "support",
    "1DS23CS0056": "support",
    "1DS23CS0017": "support",
    "1DS23CS0031": "support",
    "1DS23CS0063": "watch",
    "1DS23CS0071": "watch",
    "1DS23CS0038": "on-track",
    "1DS23CS0009": "on-track",
    "1DS23CS0012": "on-track",
    "1DS23CS0024": "on-track",
    "1DS23CS0029": "on-track",
    "1DS23CS0048": "on-track",
}

FEATURE_TO_GROUP = {
    feature: group for group, features in FEATURE_GROUPS.items() for feature in features
}


def log(message: str) -> None:
    print(f"[export-risk] {message}", flush=True)


def load_frames() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict]:
    features = pd.read_parquet(FEATURES_PATH)
    shap = pd.read_parquet(OOF_SHAP_PATH)
    predictions = pd.read_parquet(PREDICTIONS_PATH)
    contract = json.loads(MODEL_META_PATH.read_text(encoding="utf-8"))
    return features, shap, predictions, contract


def row_drivers(row: pd.Series, shap_row: pd.Series, top_k: int = 5) -> list[dict]:
    contributions = {
        feature: float(shap_row[f"shap__{feature}"]) for feature in FEATURE_COLUMNS
    }
    order = sorted(contributions, key=lambda key: -abs(contributions[key]))[:top_k]
    drivers = []
    for feature in order:
        raw_value = row[feature]
        value: float | None
        try:
            number = float(raw_value)
            value = None if np.isnan(number) else number
        except (TypeError, ValueError):
            value = None
        shap_value = contributions[feature]
        drivers.append(
            {
                "feature": feature,
                "label": FEATURE_LABELS.get(feature, feature),
                "group": FEATURE_TO_GROUP.get(feature, "Other"),
                "value": value,
                "display": display_value(feature, raw_value),
                "shap_value": shap_value,
                "direction": "increases-risk" if shap_value >= 0 else "reduces-risk",
            }
        )
    return drivers


def choose_rows(
    features: pd.DataFrame,
    predictions: pd.DataFrame,
) -> pd.DataFrame:
    """Pick one enrolment per student, matching the preview campus tiers."""
    merged = predictions.merge(
        features.drop(columns=["at_risk"]), on=["id_student", "code_module", "code_presentation"],
        how="left", validate="one_to_one",
    )
    # One enrolment per student keeps the seeded body equal to the student count.
    merged = merged.sort_values(
        ["id_student", "oof_prediction"], ascending=[True, False]
    ).drop_duplicates("id_student", keep="first")

    rng = np.random.default_rng(42)
    picked: list[pd.Series] = []
    used: set[int] = set()

    for tier, wanted in TIER_COUNTS.items():
        pool = merged[merged["oof_risk_tier"] == tier].sort_values("id_student")
        if len(pool) < wanted:
            raise RuntimeError(f"Not enough {tier} rows to seed ({len(pool)} < {wanted}).")
        chosen = pool.sample(n=wanted, random_state=int(rng.integers(0, 2**31 - 1)))
        for idx in chosen.index:
            used.add(idx)
        picked.append(chosen)

    selected = pd.concat(picked).reset_index(drop=True)
    if len(selected) != CAMPUS_SIZE:
        raise RuntimeError(f"Expected {CAMPUS_SIZE} rows, got {len(selected)}.")
    return selected


def assign_demo_rows(selected: pd.DataFrame) -> dict[str, str]:
    """Map the twelve preview USNs onto real rows of the matching tier."""
    demo_map: dict[str, str] = {}
    used_ids: set[int] = set()

    for usn, tier in DEMO_TIERS.items():
        candidates = selected[
            (selected["oof_risk_tier"] == tier)
            & (~selected["id_student"].isin(used_ids))
        ]
        if candidates.empty:
            raise RuntimeError(f"No {tier} row left for {usn}.")
        # Strongest signal for the flagged students, calmest for the on-track ones.
        candidates = candidates.sort_values(
            "oof_prediction", ascending=(tier != "on-track")
        )
        row = candidates.iloc[0]
        used_ids.add(int(row["id_student"]))
        demo_map[usn] = str(int(row["id_student"]))

    return demo_map


def build_record(row: pd.Series, shap_row: pd.Series) -> dict:
    module = str(row["code_module"])
    course_code = MODULE_TO_COURSE.get(module, module)
    features = {
        feature: (
            None
            if pd.isna(row[feature])
            else (float(row[feature]) if feature != "code_module" else str(row[feature]))
        )
        for feature in FEATURE_COLUMNS
    }
    return {
        "oulad_student_id": int(row["id_student"]),
        "course_code": course_code,
        "course_title": COURSE_TITLES.get(course_code, course_code),
        "source_module": module,
        "source_presentation": str(row["code_presentation"]),
        "probability": float(row["oof_prediction"]),
        "tier": str(row["oof_risk_tier"]),
        "at_risk": bool(row.get("at_risk", False)),
        "drivers": row_drivers(row, shap_row),
        "features": features,
    }


def main() -> int:
    log("Loading model artifacts")
    features, shap, predictions, contract = load_frames()

    shap_columns = {"id_student", "code_module", "code_presentation"}
    missing_shap = [feature for feature in FEATURE_COLUMNS if f"shap__{feature}" not in shap.columns]
    if missing_shap:
        raise RuntimeError(f"OOF SHAP file is missing columns: {missing_shap}")
    shap_frame = shap[
        list(shap_columns) + [f"shap__{feature}" for feature in FEATURE_COLUMNS]
    ]

    log("Selecting rows")
    selected = choose_rows(features, predictions)
    demo_map = assign_demo_rows(selected)

    log(f"Building {len(selected)} seeded students")
    shap_lookup = shap_frame.set_index(["id_student", "code_module", "code_presentation"])
    records: list[dict] = []
    for _, row in selected.iterrows():
        key = (row["id_student"], row["code_module"], row["code_presentation"])
        shap_row = shap_lookup.loc[key]
        records.append(build_record(row, shap_row))

    by_oulad = {record["oulad_student_id"]: record for record in records}
    demo_rows = {}
    for usn, oulad_id in demo_map.items():
        demo_rows[usn] = by_oulad[int(oulad_id)]

    payload = {
        "model_version": contract["model_version"],
        "cutoff_day": contract["cutoff_day"],
        "needs_support_threshold": contract["needs_support_threshold"],
        "watch_threshold": contract["watch_threshold"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "campus_size": CAMPUS_SIZE,
        "tier_counts": TIER_COUNTS,
        "students": records,
        "demo": demo_rows,
    }

    SEED_PATH.parent.mkdir(parents=True, exist_ok=True)
    SEED_PATH.write_text(json.dumps(payload, indent=1), encoding="utf-8")
    log(f"Wrote {SEED_PATH} ({SEED_PATH.stat().st_size / 1_000_000:.1f} MB)")

    counts = pd.Series([record["tier"] for record in records]).value_counts().to_dict()
    log(f"Tier counts: {counts}")
    log(f"Demo rows: {len(demo_rows)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
