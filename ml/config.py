"""Shared configuration for the E-IDX OULAD risk model."""

from pathlib import Path

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ML_DIR = PROJECT_ROOT / "ml"
DATA_DIR = ML_DIR / "data"
ARTIFACTS_DIR = ML_DIR / "artifacts"
OULAD_DIR = PROJECT_ROOT / "mp_data" / "oulad"

DB_PATH = DATA_DIR / "oulad.duckdb"
FEATURE_META_PATH = DATA_DIR / "feature_meta.json"
COHORT_META_PATH = DATA_DIR / "cohort_meta.parquet"

# Model contract
CUTOFF_DAY = 60
FEATURES_PATH = DATA_DIR / f"features_cutoff{CUTOFF_DAY}.parquet"
TARGET = "at_risk"
TARGET_POSITIVE_CLASSES = ("Fail", "Withdrawn")
ID_COLUMNS = ["id_student", "code_module", "code_presentation"]
CATEGORICAL_FEATURES = ["code_module"]

# Keep this list explicit. The training code never infers features from all columns,
# which prevents demographics or post-cutoff fields from leaking into the model.
NUMERIC_FEATURES = [
    # Student / module context (known at registration)
    "num_of_prev_attempts",
    "studied_credits",
    "registration_lead_days",
    "module_presentation_length",
    "assessment_count_total",
    "first_assessment_day",
    "weight_due_60",
    # Assessment behaviour up to the cutoff
    "n_due_60",
    "n_submitted_60",
    "n_ontime_60",
    "n_late_60",
    "n_scored_60",
    "n_banked_60",
    "avg_score_60",
    "weighted_score_60",
    "min_score_60",
    "max_score_60",
    "first_score_60",
    "last_score_60",
    "submission_rate_60",
    "ontime_rate_60",
    "n_missing_60",
    "days_since_last_submission_60",
    "has_assessment_60",
    # VLE engagement up to the cutoff
    "vle_clicks_60",
    "log_vle_clicks_60",
    "vle_active_days_60",
    "vle_distinct_sites_60",
    "vle_clicks_per_active_day_60",
    "vle_clicks_30",
    "vle_active_days_30",
    "vle_clicks_31_60",
    "vle_active_days_31_60",
    "vle_clicks_last_14_days_60",
    "vle_active_days_last_14_days_60",
    "days_since_last_vle_60",
    "has_vle_60",
    "forum_clicks_60",
    "content_clicks_60",
    "quiz_clicks_60",
    "forum_active_days_60",
    "forum_share_60",
    "content_share_60",
    "quiz_share_60",
]

FEATURE_COLUMNS = CATEGORICAL_FEATURES + NUMERIC_FEATURES

# Human-readable groups used for model explanations in the product UI.
# Every feature should appear in exactly one group.
FEATURE_GROUPS = {
    "Assessment scores": [
        "avg_score_60",
        "weighted_score_60",
        "min_score_60",
        "max_score_60",
        "first_score_60",
        "last_score_60",
    ],
    "Missed assessments": [
        "n_missing_60",
        "n_due_60",
        "n_submitted_60",
        "has_assessment_60",
        "submission_rate_60",
    ],
    "Submission timing": [
        "n_ontime_60",
        "n_late_60",
        "ontime_rate_60",
        "days_since_last_submission_60",
        "n_scored_60",
    ],
    "Recent VLE activity": [
        "vle_active_days_last_14_days_60",
        "vle_clicks_last_14_days_60",
        "vle_active_days_31_60",
        "vle_clicks_31_60",
        "days_since_last_vle_60",
    ],
    "VLE breadth": [
        "vle_distinct_sites_60",
        "content_clicks_60",
        "content_share_60",
        "forum_clicks_60",
        "forum_active_days_60",
        "forum_share_60",
        "quiz_clicks_60",
        "quiz_share_60",
    ],
    "Total VLE engagement": [
        "vle_clicks_60",
        "log_vle_clicks_60",
        "vle_active_days_60",
        "vle_clicks_per_active_day_60",
        "vle_clicks_30",
        "vle_active_days_30",
        "has_vle_60",
    ],
    "Prior attempts": ["num_of_prev_attempts"],
    "Credits and registration": ["studied_credits", "registration_lead_days"],
    "Module context": [
        "code_module",
        "module_presentation_length",
        "assessment_count_total",
        "first_assessment_day",
        "weight_due_60",
    ],
    "Banked credit": ["n_banked_60"],
}

# Splitting / reproducibility
RANDOM_SEED = 42
N_SPLITS = 5
TEMPORAL_TEST_PRESENTATION = "2014J"

# Risk tiers use capacity-style quantiles on out-of-fold predictions:
# top 10% = needs support, next 20% = watch, remainder = on track.
NEEDS_SUPPORT_QUANTILE = 0.90
WATCH_QUANTILE = 0.70
