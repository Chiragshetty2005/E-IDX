"""Train and evaluate the E-IDX OULAD cutoff-60 risk model locally.

Outputs:
  ml/artifacts/catboost_model.cbm
  ml/artifacts/logistic_model.joblib
  ml/artifacts/metrics.json
  ml/artifacts/model_meta.json
  ml/artifacts/predictions.parquet
  ml/artifacts/feature_importance.csv
  ml/artifacts/shap_values.parquet
  ml/artifacts/shap_summary.png
  ml/artifacts/shap_importance_bar.png
  ml/artifacts/calibration.png
"""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import platform
import time
import warnings
from datetime import datetime, timezone
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from catboost import CatBoostClassifier
from sklearn.calibration import calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ml.config import (
    ARTIFACTS_DIR,
    CATEGORICAL_FEATURES,
    COHORT_META_PATH,
    CUTOFF_DAY,
    FEATURES_PATH,
    FEATURE_COLUMNS,
    FEATURE_GROUPS,
    FEATURE_META_PATH,
    ID_COLUMNS,
    NEEDS_SUPPORT_QUANTILE,
    N_SPLITS,
    NUMERIC_FEATURES,
    RANDOM_SEED,
    TARGET,
    TEMPORAL_TEST_PRESENTATION,
    WATCH_QUANTILE,
)

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

CATBOOST_PARAMS = {
    "iterations": 600,
    "learning_rate": 0.035,
    "depth": 4,
    "l2_leaf_reg": 6.0,
    "loss_function": "Logloss",
    "eval_metric": "AUC",
    "random_seed": RANDOM_SEED,
    "thread_count": 4,
    "verbose": 0,
    "allow_writing_files": False,
    "task_type": "CPU",
}

RISK_TIER_LABELS = {
    "high": "needs-support",
    "watch": "watch",
    "low": "on-track",
}


def log(message: str) -> None:
    print(f"[train] {message}", flush=True)


def package_version(name: str) -> str | None:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def load_data() -> pd.DataFrame:
    if not FEATURES_PATH.exists():
        raise FileNotFoundError(
            f"{FEATURES_PATH} does not exist. Run `python -m ml.build_features` first."
        )
    df = pd.read_parquet(FEATURES_PATH)
    missing = sorted(set(FEATURE_COLUMNS) - set(df.columns))
    if missing:
        raise ValueError(f"Feature table is missing columns: {missing}")
    missing_target = TARGET not in df.columns
    if missing_target:
        raise ValueError(f"Feature table is missing target column {TARGET!r}")
    df = df.copy()
    df["code_module"] = df["code_module"].astype(str)
    df = df.reset_index(drop=True)
    log(f"Loaded {len(df):,} rows with {len(FEATURE_COLUMNS)} features")
    log(f"At-risk rate: {df[TARGET].mean():.2%}")
    return df


def make_catboost() -> CatBoostClassifier:
    return CatBoostClassifier(
        **CATBOOST_PARAMS,
        cat_features=CATEGORICAL_FEATURES,
    )


def make_logistic() -> Pipeline:
    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_pipeline = Pipeline(
        steps=[
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", numeric_pipeline, NUMERIC_FEATURES),
            ("categorical", categorical_pipeline, CATEGORICAL_FEATURES),
        ]
    )
    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "classifier",
                LogisticRegression(
                    max_iter=3000,
                    solver="lbfgs",
                    random_state=RANDOM_SEED,
                ),
            ),
        ]
    )


def top_fraction_metrics(y_true: np.ndarray, y_prob: np.ndarray, fraction: float) -> dict:
    n = max(1, int(round(len(y_true) * fraction)))
    order = np.argsort(-y_prob)[:n]
    positives = int(y_true.sum())
    true_positives = int(y_true[order].sum())
    precision = true_positives / n if n else 0.0
    recall = true_positives / positives if positives else 0.0
    base_rate = float(y_true.mean()) if len(y_true) else 0.0
    return {
        f"recall_at_{int(fraction * 100)}pct": float(recall),
        f"precision_at_{int(fraction * 100)}pct": float(precision),
        f"lift_at_{int(fraction * 100)}pct": float(precision / base_rate) if base_rate else None,
        f"captured_at_{int(fraction * 100)}pct": int(true_positives),
    }


def expected_calibration_error(
    y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10
) -> float:
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    bin_ids = np.digitize(y_prob, bins[1:-1])
    ece = 0.0
    for bin_id in range(n_bins):
        mask = bin_ids == bin_id
        if not mask.any():
            continue
        observed = float(y_true[mask].mean())
        predicted = float(y_prob[mask].mean())
        ece += float(mask.mean()) * abs(observed - predicted)
    return float(ece)


def evaluate_predictions(y_true: np.ndarray, y_prob: np.ndarray) -> dict:
    y_true = np.asarray(y_true).astype(int)
    y_prob = np.asarray(y_prob).astype(float)
    y_pred_50 = (y_prob >= 0.5).astype(int)
    result = {
        "n": int(len(y_true)),
        "positives": int(y_true.sum()),
        "base_rate": float(y_true.mean()),
        "roc_auc": float(roc_auc_score(y_true, y_prob)),
        "pr_auc": float(average_precision_score(y_true, y_prob)),
        "brier": float(brier_score_loss(y_true, y_prob)),
        "log_loss": float(log_loss(y_true, np.clip(y_prob, 1e-6, 1 - 1e-6))),
        "ece_10bin": expected_calibration_error(y_true, y_prob),
        "accuracy_at_50pct_threshold": float(accuracy_score(y_true, y_pred_50)),
        "macro_f1_at_50pct_threshold": float(
            f1_score(y_true, y_pred_50, average="macro", zero_division=0)
        ),
        "f1_at_50pct_threshold": float(
            f1_score(y_true, y_pred_50, zero_division=0)
        ),
        "recall_at_50pct_threshold": float(recall_score(y_true, y_pred_50)),
        "precision_at_50pct_threshold": float(precision_score(y_true, y_pred_50, zero_division=0)),
    }
    for fraction in (0.10, 0.20, 0.30):
        result.update(top_fraction_metrics(y_true, y_prob, fraction))
    return result


def make_folds(df: pd.DataFrame) -> np.ndarray:
    splitter = StratifiedGroupKFold(
        n_splits=N_SPLITS,
        shuffle=True,
        random_state=RANDOM_SEED,
    )
    folds = np.full(len(df), -1, dtype=int)
    groups = df["id_student"].to_numpy()
    y = df[TARGET].to_numpy()
    for fold, (_, valid_idx) in enumerate(splitter.split(df, y, groups=groups)):
        folds[valid_idx] = fold
    if (folds < 0).any():
        raise RuntimeError("Some rows were not assigned to a fold")
    fold_counts = pd.Series(folds).value_counts().sort_index().to_dict()
    log(f"Created {N_SPLITS} stratified student-group folds: {fold_counts}")
    return folds


def fold_metrics_summary(fold_metrics: list[dict]) -> dict:
    summary = {}
    keys = [
        key
        for key, value in fold_metrics[0].items()
        if isinstance(value, (int, float)) and key not in {"n", "positives"}
    ]
    for key in keys:
        values = np.array([fold[key] for fold in fold_metrics], dtype=float)
        summary[key] = {
            "mean": float(values.mean()),
            "std": float(values.std(ddof=1)) if len(values) > 1 else 0.0,
            "fold_values": [float(v) for v in values],
        }
    return summary


def run_grouped_cv(
    df: pd.DataFrame, folds: np.ndarray
) -> tuple[dict, dict, np.ndarray, np.ndarray]:
    X = df[FEATURE_COLUMNS]
    y = df[TARGET].to_numpy()
    oof_catboost = np.full(len(df), np.nan, dtype=float)
    oof_logistic = np.full(len(df), np.nan, dtype=float)
    metrics = {"catboost": [], "logistic": []}

    for fold in range(N_SPLITS):
        train_idx = np.flatnonzero(folds != fold)
        valid_idx = np.flatnonzero(folds == fold)
        X_train, X_valid = X.iloc[train_idx], X.iloc[valid_idx]
        y_train, y_valid = y[train_idx], y[valid_idx]

        log(
            f"Fold {fold + 1}/{N_SPLITS}: "
            f"train={len(train_idx):,}, valid={len(valid_idx):,}, "
            f"valid_at_risk={y_valid.mean():.2%}"
        )

        start = time.time()
        catboost = make_catboost()
        catboost.fit(X_train, y_train)
        oof_catboost[valid_idx] = catboost.predict_proba(X_valid)[:, 1]
        catboost_metrics = evaluate_predictions(
            y_valid, oof_catboost[valid_idx]
        )
        metrics["catboost"].append(catboost_metrics)
        log(
            f"  CatBoost ROC-AUC={catboost_metrics['roc_auc']:.4f}, "
            f"PR-AUC={catboost_metrics['pr_auc']:.4f}, "
            f"time={time.time() - start:.1f}s"
        )

        start = time.time()
        logistic = make_logistic()
        logistic.fit(X_train, y_train)
        oof_logistic[valid_idx] = logistic.predict_proba(X_valid)[:, 1]
        logistic_metrics = evaluate_predictions(
            y_valid, oof_logistic[valid_idx]
        )
        metrics["logistic"].append(logistic_metrics)
        log(
            f"  Logistic ROC-AUC={logistic_metrics['roc_auc']:.4f}, "
            f"PR-AUC={logistic_metrics['pr_auc']:.4f}, "
            f"time={time.time() - start:.1f}s"
        )

    return metrics, {
        "catboost": oof_catboost,
        "logistic": oof_logistic,
    }, None, None


def run_temporal_holdout(df: pd.DataFrame) -> dict:
    test_mask = df["code_presentation"] == TEMPORAL_TEST_PRESENTATION
    test_students = set(df.loc[test_mask, "id_student"].tolist())
    train_mask = (~test_mask) & (~df["id_student"].isin(test_students))
    train_idx = np.flatnonzero(train_mask.to_numpy())
    test_idx = np.flatnonzero(test_mask.to_numpy())

    X = df[FEATURE_COLUMNS]
    y = df[TARGET].to_numpy()
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    log(
        f"Temporal holdout {TEMPORAL_TEST_PRESENTATION}: "
        f"train={len(train_idx):,}, test={len(test_idx):,}, "
        f"test_at_risk={y_test.mean():.2%}"
    )

    result = {
        "test_presentation": TEMPORAL_TEST_PRESENTATION,
        "train_rows": int(len(train_idx)),
        "test_rows": int(len(test_idx)),
        "train_at_risk_rate": float(y_train.mean()),
        "test_at_risk_rate": float(y_test.mean()),
        "excluded_train_students_overlapping_test": int(
            (~test_mask & df["id_student"].isin(test_students)).sum()
        ),
        "catboost": None,
        "logistic": None,
    }

    start = time.time()
    catboost = make_catboost()
    catboost.fit(X_train, y_train)
    cat_prob = catboost.predict_proba(X_test)[:, 1]
    result["catboost"] = evaluate_predictions(y_test, cat_prob)
    result["catboost"]["fit_time_seconds"] = round(time.time() - start, 2)
    log(
        f"  Temporal CatBoost ROC-AUC={result['catboost']['roc_auc']:.4f}, "
        f"PR-AUC={result['catboost']['pr_auc']:.4f}, "
        f"time={time.time() - start:.1f}s"
    )

    start = time.time()
    logistic = make_logistic()
    logistic.fit(X_train, y_train)
    log_prob = logistic.predict_proba(X_test)[:, 1]
    result["logistic"] = evaluate_predictions(y_test, log_prob)
    result["logistic"]["fit_time_seconds"] = round(time.time() - start, 2)
    log(
        f"  Temporal Logistic ROC-AUC={result['logistic']['roc_auc']:.4f}, "
        f"PR-AUC={result['logistic']['pr_auc']:.4f}, "
        f"time={time.time() - start:.1f}s"
    )

    temporal_predictions = df.loc[test_idx, ID_COLUMNS + [TARGET]].copy()
    temporal_predictions["catboost_prediction"] = cat_prob
    temporal_predictions["logistic_prediction"] = log_prob
    temporal_predictions.to_parquet(
        ARTIFACTS_DIR / "temporal_predictions.parquet", index=False
    )
    return result


def save_calibration_plot(
    y_true: np.ndarray, y_prob: np.ndarray, output_path: Path
) -> None:
    prob_true, prob_pred = calibration_curve(
        y_true, y_prob, n_bins=10, strategy="quantile"
    )
    plt.figure(figsize=(6, 5))
    plt.plot([0, 1], [0, 1], linestyle="--", color="#8b8b8b", label="Perfect calibration")
    plt.plot(prob_pred, prob_true, marker="o", color="#1f5f5b", label="CatBoost OOF")
    plt.xlabel("Predicted risk probability")
    plt.ylabel("Observed at-risk rate")
    plt.title(f"Calibration at day {CUTOFF_DAY}")
    plt.legend(loc="best")
    plt.grid(alpha=0.25)
    plt.tight_layout()
    plt.savefig(output_path, dpi=160, bbox_inches="tight")
    plt.close()


def compute_shap(
    model: CatBoostClassifier, df: pd.DataFrame, sample_size: int = 2000
) -> dict:
    sample_size = min(sample_size, len(df))
    sample = df.sample(n=sample_size, random_state=RANDOM_SEED)
    X_sample = sample[FEATURE_COLUMNS].copy()

    log(f"Calculating SHAP values for {sample_size:,} rows ...")
    start = time.time()
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
    shap_values = np.asarray(shap_values)
    if shap_values.ndim != 2:
        raise ValueError(f"Unexpected SHAP shape: {shap_values.shape}")
    log(f"  SHAP finished in {time.time() - start:.1f}s")

    shap_df = pd.DataFrame(shap_values, columns=FEATURE_COLUMNS)
    mean_abs = shap_df.abs().mean().sort_values(ascending=False)
    mean_abs.rename("mean_abs_shap").to_csv(ARTIFACTS_DIR / "shap_importance.csv")

    feature_to_group = {
        feature: group
        for group, features in FEATURE_GROUPS.items()
        for feature in features
    }
    missing_groups = sorted(set(FEATURE_COLUMNS) - set(feature_to_group))
    if missing_groups:
        raise ValueError(f"Features missing from FEATURE_GROUPS: {missing_groups}")
    group_importance = (
        mean_abs.groupby(mean_abs.index.map(feature_to_group))
        .sum()
        .sort_values(ascending=False)
    )
    group_share = (group_importance / group_importance.sum()).rename("share")
    group_share.to_csv(ARTIFACTS_DIR / "shap_group_importance.csv")

    shap_out = pd.DataFrame(
        shap_values,
        columns=[f"shap__{column}" for column in FEATURE_COLUMNS],
    )
    meta = sample[ID_COLUMNS + [TARGET]].reset_index(drop=True)
    shap_out = pd.concat([meta, shap_out], axis=1)
    shap_out.to_parquet(ARTIFACTS_DIR / "shap_values.parquet", index=False)

    # SHAP's summary plot needs numeric colour values; encode the single
    # categorical feature for display only.
    X_plot = X_sample.copy()
    for column in CATEGORICAL_FEATURES:
        if column in X_plot.columns:
            X_plot[column] = X_plot[column].astype("category").cat.codes

    plt.figure()
    shap.summary_plot(
        shap_values,
        X_plot,
        feature_names=FEATURE_COLUMNS,
        max_display=20,
        show=False,
    )
    plt.tight_layout()
    plt.savefig(ARTIFACTS_DIR / "shap_summary.png", dpi=160, bbox_inches="tight")
    plt.close()

    plt.figure()
    shap.summary_plot(
        shap_values,
        X_plot,
        feature_names=FEATURE_COLUMNS,
        plot_type="bar",
        max_display=20,
        show=False,
    )
    plt.tight_layout()
    plt.savefig(ARTIFACTS_DIR / "shap_importance_bar.png", dpi=160, bbox_inches="tight")
    plt.close()

    return {
        "sample_rows": int(sample_size),
        "expected_value": float(np.asarray(explainer.expected_value).ravel()[0]),
        "top_features": [
            {"feature": feature, "mean_abs_shap": float(value)}
            for feature, value in mean_abs.head(20).items()
        ],
        "group_importance": [
            {"group": group, "share": float(value)}
            for group, value in group_share.items()
        ],
    }


def compute_fairness(df: pd.DataFrame, oof_probability: np.ndarray) -> dict:
    """Audit outcomes by protected attributes without using them as features."""
    if not COHORT_META_PATH.exists():
        return {"status": "skipped", "reason": "cohort_meta.parquet not found"}

    meta = pd.read_parquet(COHORT_META_PATH)
    demographic_columns = [
        "gender",
        "disability",
        "age_band",
        "imd_band",
        "region",
        "highest_education",
    ]
    available = [
        column
        for column in demographic_columns
        if column in meta.columns
    ]
    base = df[ID_COLUMNS + [TARGET]].copy()
    base["oof_prediction"] = oof_probability
    merged = base.merge(
        meta[ID_COLUMNS + available],
        on=ID_COLUMNS,
        how="left",
        validate="one_to_one",
    )
    top20_threshold = float(np.quantile(oof_probability, 0.80))
    merged["selected_top20"] = merged["oof_prediction"] >= top20_threshold

    attributes: dict[str, list[dict]] = {}
    gaps: dict[str, dict] = {}
    for attribute in available:
        rows: list[dict] = []
        for value, group in merged.groupby(attribute, dropna=False):
            if len(group) < 100:
                continue
            y_group = group[TARGET].to_numpy()
            p_group = group["oof_prediction"].to_numpy()
            positives = int(y_group.sum())
            label = "Unknown" if pd.isna(value) else str(value)
            row = {
                "group": label,
                "n": int(len(group)),
                "positives": positives,
                "at_risk_rate": float(y_group.mean()),
                "selection_rate_top20": float(group["selected_top20"].mean()),
                "recall_top20": (
                    float(group.loc[group[TARGET] == 1, "selected_top20"].mean())
                    if positives
                    else None
                ),
                "roc_auc": (
                    float(roc_auc_score(y_group, p_group))
                    if positives and positives < len(y_group)
                    else None
                ),
                "pr_auc": (
                    float(average_precision_score(y_group, p_group))
                    if positives and positives < len(y_group)
                    else None
                ),
            }
            rows.append(row)
        rows.sort(key=lambda item: item["n"], reverse=True)
        attributes[attribute] = rows
        if len(rows) >= 2:
            selection_rates = [row["selection_rate_top20"] for row in rows]
            recalls = [
                row["recall_top20"]
                for row in rows
                if row["recall_top20"] is not None
            ]
            gaps[attribute] = {
                "selection_rate_gap": float(max(selection_rates) - min(selection_rates)),
                "recall_gap": (
                    float(max(recalls) - min(recalls))
                    if len(recalls) >= 2
                    else None
                ),
            }

    result = {
        "status": "completed",
        "top20_threshold": top20_threshold,
        "attributes": attributes,
        "gaps": gaps,
        "note": (
            "Protected attributes are used only for this audit and are not model inputs. "
            "Groups with fewer than 100 active enrolments are omitted."
        ),
    }
    (ARTIFACTS_DIR / "fairness.json").write_text(
        json.dumps(result, indent=2), encoding="utf-8"
    )
    return result


def main() -> int:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    df = load_data()
    feature_hash = sha256_file(FEATURES_PATH)
    feature_meta = (
        json.loads(FEATURE_META_PATH.read_text(encoding="utf-8"))
        if FEATURE_META_PATH.exists()
        else {}
    )

    folds = make_folds(df)
    cv_metrics, oof, _, _ = run_grouped_cv(df, folds)
    y = df[TARGET].to_numpy()
    oof_catboost = oof["catboost"]
    oof_logistic = oof["logistic"]

    overall_oof = {
        "catboost": evaluate_predictions(y, oof_catboost),
        "logistic": evaluate_predictions(y, oof_logistic),
    }
    log(
        f"Overall OOF CatBoost ROC-AUC={overall_oof['catboost']['roc_auc']:.4f}, "
        f"PR-AUC={overall_oof['catboost']['pr_auc']:.4f}"
    )
    log(
        f"Overall OOF Logistic ROC-AUC={overall_oof['logistic']['roc_auc']:.4f}, "
        f"PR-AUC={overall_oof['logistic']['pr_auc']:.4f}"
    )

    fairness = compute_fairness(df, oof_catboost)
    if fairness.get("status") == "completed":
        log(
            "Fairness audit: "
            + ", ".join(
                f"{attribute} selection gap={gap['selection_rate_gap']:.3f}"
                for attribute, gap in fairness["gaps"].items()
            )
        )

    temporal = run_temporal_holdout(df)

    log("Training final CatBoost on all active enrolments ...")
    start = time.time()
    final_catboost = make_catboost()
    final_catboost.fit(df[FEATURE_COLUMNS], y)
    final_catboost.save_model(str(ARTIFACTS_DIR / "catboost_model.cbm"))
    log(f"  final CatBoost fitted in {time.time() - start:.1f}s")

    log("Training final logistic regression ...")
    start = time.time()
    final_logistic = make_logistic()
    final_logistic.fit(df[FEATURE_COLUMNS], y)
    joblib.dump(final_logistic, ARTIFACTS_DIR / "logistic_model.joblib")
    log(f"  final logistic fitted in {time.time() - start:.1f}s")

    final_prob = final_catboost.predict_proba(df[FEATURE_COLUMNS])[:, 1]
    needs_support_threshold = float(
        np.quantile(oof_catboost, NEEDS_SUPPORT_QUANTILE)
    )
    watch_threshold = float(np.quantile(oof_catboost, WATCH_QUANTILE))

    def risk_tier(probability: np.ndarray) -> np.ndarray:
        tiers = np.full(len(probability), "low", dtype=object)
        tiers[probability >= watch_threshold] = "watch"
        tiers[probability >= needs_support_threshold] = "high"
        return tiers

    predictions = df[ID_COLUMNS + [TARGET]].copy()
    predictions["fold"] = folds
    predictions["oof_prediction"] = oof_catboost
    predictions["oof_logistic_prediction"] = oof_logistic
    predictions["final_prediction"] = final_prob
    predictions["oof_risk_tier"] = risk_tier(oof_catboost)
    predictions["final_risk_tier"] = risk_tier(final_prob)
    predictions.to_parquet(ARTIFACTS_DIR / "predictions.parquet", index=False)

    feature_importance = final_catboost.get_feature_importance(prettified=True)
    feature_importance.to_csv(ARTIFACTS_DIR / "feature_importance.csv", index=False)

    save_calibration_plot(y, oof_catboost, ARTIFACTS_DIR / "calibration.png")
    shap_summary = compute_shap(final_catboost, df)

    risk_tier_counts = (
        predictions["final_risk_tier"].value_counts().reindex(["high", "watch", "low"]).fillna(0).astype(int).to_dict()
    )

    model_version = (
        f"catboost-cutoff{CUTOFF_DAY}-"
        f"{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    )
    metrics = {
        "model_version": model_version,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "model_contract": {
            "algorithm": "CatBoostClassifier",
            "target": TARGET,
            "target_positive_classes": ["Fail", "Withdrawn"],
            "cutoff_day": CUTOFF_DAY,
            "cohort_rule": f"date_unregistration IS NULL OR date_unregistration > {CUTOFF_DAY}",
            "feature_count": len(FEATURE_COLUMNS),
            "categorical_features": CATEGORICAL_FEATURES,
            "numeric_features": NUMERIC_FEATURES,
            "random_seed": RANDOM_SEED,
            "catboost_params": CATBOOST_PARAMS,
        },
        "dataset": {
            "rows": int(len(df)),
            "students": int(df["id_student"].nunique()),
            "at_risk_rows": int(y.sum()),
            "at_risk_rate": float(y.mean()),
            "feature_table_sha256": feature_hash,
            "source": feature_meta.get("source_files", {}),
            "stored_feature_meta": feature_meta.get("stats", {}),
        },
        "cross_validation": {
            "scheme": "StratifiedGroupKFold by id_student",
            "n_splits": N_SPLITS,
            "catboost": {
                "fold_metrics": cv_metrics["catboost"],
                "summary": fold_metrics_summary(cv_metrics["catboost"]),
                "overall_oof": overall_oof["catboost"],
            },
            "logistic": {
                "fold_metrics": cv_metrics["logistic"],
                "summary": fold_metrics_summary(cv_metrics["logistic"]),
                "overall_oof": overall_oof["logistic"],
            },
        },
        "temporal_holdout": temporal,
        "fairness": fairness,
        "risk_tiers": {
            "definition": "Capacity-style quantiles of OOF CatBoost probability",
            "needs_support_threshold": needs_support_threshold,
            "watch_threshold": watch_threshold,
            "needs_support_quantile": NEEDS_SUPPORT_QUANTILE,
            "watch_quantile": WATCH_QUANTILE,
            "oof_tier_counts": {
                "high": int((predictions["oof_risk_tier"] == "high").sum()),
                "watch": int((predictions["oof_risk_tier"] == "watch").sum()),
                "low": int((predictions["oof_risk_tier"] == "low").sum()),
            },
            "final_tier_counts": risk_tier_counts,
        },
        "shap": shap_summary,
        "software": {
            "python": platform.python_version(),
            "catboost": package_version("catboost"),
            "scikit-learn": package_version("scikit-learn"),
            "shap": package_version("shap"),
            "pandas": package_version("pandas"),
            "numpy": package_version("numpy"),
            "pyarrow": package_version("pyarrow"),
        },
    }

    (ARTIFACTS_DIR / "metrics.json").write_text(
        json.dumps(metrics, indent=2), encoding="utf-8"
    )
    if FEATURE_META_PATH.exists():
        (ARTIFACTS_DIR / "feature_meta.json").write_text(
            FEATURE_META_PATH.read_text(encoding="utf-8"), encoding="utf-8"
        )
    (ARTIFACTS_DIR / "model_meta.json").write_text(
        json.dumps(
            {
                "model_version": model_version,
                "created_at_utc": metrics["created_at_utc"],
                "model_file": "catboost_model.cbm",
                "logistic_file": "logistic_model.joblib",
                "feature_columns": FEATURE_COLUMNS,
                "feature_groups": FEATURE_GROUPS,
                "categorical_features": CATEGORICAL_FEATURES,
                "cutoff_day": CUTOFF_DAY,
                "target": TARGET,
                "target_positive_classes": ["Fail", "Withdrawn"],
                "needs_support_threshold": needs_support_threshold,
                "watch_threshold": watch_threshold,
                "risk_tier_labels": RISK_TIER_LABELS,
                "feature_table_sha256": feature_hash,
                "dataset_rows": int(len(df)),
                "at_risk_rate": float(y.mean()),
                "cross_validation_auc": overall_oof["catboost"]["roc_auc"],
                "cross_validation_pr_auc": overall_oof["catboost"]["pr_auc"],
                "recall_at_20pct": overall_oof["catboost"]["recall_at_20pct"],
                "temporal_test_auc": temporal["catboost"]["roc_auc"],
                "temporal_test_pr_auc": temporal["catboost"]["pr_auc"],
                "shap_group_importance": shap_summary["group_importance"],
                "fairness_selection_gaps": {
                    attribute: gap["selection_rate_gap"]
                    for attribute, gap in fairness.get("gaps", {}).items()
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print("\nFinal summary")
    print(f"  model_version: {model_version}")
    print(f"  rows: {len(df):,}")
    print(f"  at_risk_rate: {y.mean():.4f}")
    print(
        "  OOF CatBoost: "
        f"ROC-AUC={overall_oof['catboost']['roc_auc']:.4f}, "
        f"PR-AUC={overall_oof['catboost']['pr_auc']:.4f}, "
        f"recall@20%={overall_oof['catboost']['recall_at_20pct']:.4f}"
    )
    print(
        "  OOF Logistic: "
        f"ROC-AUC={overall_oof['logistic']['roc_auc']:.4f}, "
        f"PR-AUC={overall_oof['logistic']['pr_auc']:.4f}, "
        f"recall@20%={overall_oof['logistic']['recall_at_20pct']:.4f}"
    )
    print(
        f"  Temporal CatBoost ({TEMPORAL_TEST_PRESENTATION}): "
        f"ROC-AUC={temporal['catboost']['roc_auc']:.4f}, "
        f"PR-AUC={temporal['catboost']['pr_auc']:.4f}, "
        f"recall@20%={temporal['catboost']['recall_at_20pct']:.4f}"
    )
    print(
        "  Risk tiers: "
        f"high={risk_tier_counts['high']:,}, "
        f"watch={risk_tier_counts['watch']:,}, "
        f"low={risk_tier_counts['low']:,}"
    )
    print(f"  Artifacts written to {ARTIFACTS_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
