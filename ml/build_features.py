"""Build the OULAD cutoff-60 modelling table locally with DuckDB.

The raw VLE table has 10.6M rows. We keep the heavy work inside DuckDB and
export only the compact student-module feature table used for training.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

import duckdb

from ml.config import (
    CATEGORICAL_FEATURES,
    COHORT_META_PATH,
    CUTOFF_DAY,
    DATA_DIR,
    DB_PATH,
    FEATURES_PATH,
    FEATURE_COLUMNS,
    FEATURE_META_PATH,
    NUMERIC_FEATURES,
    OULAD_DIR,
    TARGET,
    TARGET_POSITIVE_CLASSES,
)


EXPECTED_FILES = [
    "courses.csv",
    "assessments.csv",
    "studentInfo.csv",
    "studentRegistration.csv",
    "studentAssessment.csv",
    "vle.csv",
    "studentVle.csv",
]


CSV_SCHEMAS = {
    "courses": {
        "code_module": "VARCHAR",
        "code_presentation": "VARCHAR",
        "module_presentation_length": "INTEGER",
    },
    "assessments": {
        "code_module": "VARCHAR",
        "code_presentation": "VARCHAR",
        "id_assessment": "INTEGER",
        "assessment_type": "VARCHAR",
        "date": "INTEGER",
        "weight": "DOUBLE",
    },
    "studentInfo": {
        "code_module": "VARCHAR",
        "code_presentation": "VARCHAR",
        "id_student": "INTEGER",
        "gender": "VARCHAR",
        "region": "VARCHAR",
        "highest_education": "VARCHAR",
        "imd_band": "VARCHAR",
        "age_band": "VARCHAR",
        "num_of_prev_attempts": "INTEGER",
        "studied_credits": "INTEGER",
        "disability": "VARCHAR",
        "final_result": "VARCHAR",
    },
    "studentRegistration": {
        "code_module": "VARCHAR",
        "code_presentation": "VARCHAR",
        "id_student": "INTEGER",
        "date_registration": "INTEGER",
        "date_unregistration": "INTEGER",
    },
    "studentAssessment": {
        "id_assessment": "INTEGER",
        "id_student": "INTEGER",
        "date_submitted": "INTEGER",
        "is_banked": "INTEGER",
        "score": "DOUBLE",
    },
    "vle": {
        "id_site": "INTEGER",
        "code_module": "VARCHAR",
        "code_presentation": "VARCHAR",
        "activity_type": "VARCHAR",
        "week_from": "INTEGER",
        "week_to": "INTEGER",
    },
    "studentVle": {
        "code_module": "VARCHAR",
        "code_presentation": "VARCHAR",
        "id_student": "INTEGER",
        "id_site": "INTEGER",
        "date": "INTEGER",
        "sum_click": "INTEGER",
    },
}


def log(message: str) -> None:
    print(f"[build_features] {message}", flush=True)


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    FEATURES_PATH.parent.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "duckdb_tmp").mkdir(parents=True, exist_ok=True)


def sha256_file(path: Path, chunk_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def check_raw_files() -> None:
    missing = [name for name in EXPECTED_FILES if not (OULAD_DIR / name).exists()]
    if missing:
        raise FileNotFoundError(
            f"Missing OULAD files in {OULAD_DIR}: {', '.join(missing)}"
        )


def read_csv_sql(table: str, path: Path) -> str:
    schema = CSV_SCHEMAS[table]
    columns_sql = ", ".join(
        f"'{column}': '{dtype}'" for column, dtype in schema.items()
    )
    return (
        f"CREATE OR REPLACE TABLE {table} AS "
        f"SELECT * FROM read_csv('{path}', header=true, nullstr='', "
        f"columns={{{columns_sql}}})"
    )


def import_tables(con: duckdb.DuckDBPyConnection) -> None:
    for table in EXPECTED_FILES:
        source = OULAD_DIR / table
        log(f"Importing {source.name} ...")
        con.execute(read_csv_sql(table.replace(".csv", ""), source))
        count = con.execute(
            f"SELECT count(*) FROM {table.replace('.csv', '')}"
        ).fetchone()[0]
        log(f"  {table}: {count:,} rows")


def build_feature_tables(con: duckdb.DuckDBPyConnection) -> None:
    cutoff = CUTOFF_DAY
    log(f"Building cohort and features at day {cutoff} ...")

    con.execute(
        f"""
        CREATE OR REPLACE TABLE cohort AS
        SELECT
            si.code_module,
            si.code_presentation,
            si.id_student,
            si.num_of_prev_attempts,
            si.studied_credits,
            si.final_result,
            sr.date_registration,
            sr.date_unregistration,
            co.module_presentation_length,
            -sr.date_registration AS registration_lead_days,
            CASE WHEN si.final_result IN ('Fail', 'Withdrawn') THEN 1 ELSE 0 END AS at_risk
        FROM studentInfo AS si
        LEFT JOIN studentRegistration AS sr
            ON si.code_module = sr.code_module
           AND si.code_presentation = sr.code_presentation
           AND si.id_student = sr.id_student
        LEFT JOIN courses AS co
            ON si.code_module = co.code_module
           AND si.code_presentation = co.code_presentation
        WHERE sr.date_unregistration IS NULL
           OR sr.date_unregistration > {cutoff}
        """
    )

    con.execute(
        f"""
        CREATE OR REPLACE TABLE cohort_meta AS
        SELECT
            si.code_module,
            si.code_presentation,
            si.id_student,
            si.gender,
            si.region,
            si.highest_education,
            si.imd_band,
            si.age_band,
            si.disability,
            si.final_result,
            sr.date_registration,
            sr.date_unregistration,
            CASE WHEN si.final_result IN ('Fail', 'Withdrawn') THEN 1 ELSE 0 END AS at_risk
        FROM studentInfo AS si
        LEFT JOIN studentRegistration AS sr
            ON si.code_module = sr.code_module
           AND si.code_presentation = sr.code_presentation
           AND si.id_student = sr.id_student
        WHERE sr.date_unregistration IS NULL
           OR sr.date_unregistration > {cutoff}
        """
    )

    con.execute(
        f"""
        CREATE OR REPLACE TABLE assess_meta AS
        SELECT
            code_module,
            code_presentation,
            COUNT(*) AS assessment_count_total,
            COUNT(*) FILTER (WHERE date IS NOT NULL AND date <= {cutoff}) AS n_assessments_due_60,
            MIN(date) AS first_assessment_day,
            SUM(weight) FILTER (WHERE date IS NOT NULL AND date <= {cutoff}) AS weight_due_60
        FROM assessments
        GROUP BY code_module, code_presentation
        """
    )

    con.execute(
        f"""
        CREATE OR REPLACE TABLE assess_agg AS
        WITH due AS (
            SELECT
                c.code_module,
                c.code_presentation,
                c.id_student,
                a.id_assessment,
                a.assessment_type,
                a.date AS due_date,
                a.weight,
                sa.date_submitted,
                sa.score,
                sa.is_banked
            FROM cohort AS c
            JOIN assessments AS a
                ON c.code_module = a.code_module
               AND c.code_presentation = a.code_presentation
            LEFT JOIN studentAssessment AS sa
                ON a.id_assessment = sa.id_assessment
               AND c.id_student = sa.id_student
            WHERE a.date IS NOT NULL
              AND a.date <= {cutoff}
        )
        SELECT
            code_module,
            code_presentation,
            id_student,
            COUNT(*) AS n_due_60,
            COUNT(*) FILTER (WHERE date_submitted <= {cutoff}) AS n_submitted_60,
            COUNT(*) FILTER (
                WHERE date_submitted <= {cutoff}
                  AND date_submitted <= due_date
            ) AS n_ontime_60,
            COUNT(*) FILTER (
                WHERE date_submitted <= {cutoff}
                  AND date_submitted > due_date
            ) AS n_late_60,
            COUNT(*) FILTER (
                WHERE date_submitted <= {cutoff}
                  AND score IS NOT NULL
            ) AS n_scored_60,
            COUNT(*) FILTER (
                WHERE date_submitted <= {cutoff}
                  AND is_banked = 1
            ) AS n_banked_60,
            AVG(score) FILTER (
                WHERE date_submitted <= {cutoff}
                  AND score IS NOT NULL
            ) AS avg_score_60,
            SUM(score * weight) FILTER (
                WHERE date_submitted <= {cutoff}
                  AND score IS NOT NULL
                  AND weight IS NOT NULL
                  AND weight > 0
            ) / NULLIF(SUM(weight) FILTER (
                WHERE date_submitted <= {cutoff}
                  AND score IS NOT NULL
                  AND weight IS NOT NULL
                  AND weight > 0
            ), 0) AS weighted_score_60,
            MIN(score) FILTER (
                WHERE date_submitted <= {cutoff}
                  AND score IS NOT NULL
            ) AS min_score_60,
            MAX(score) FILTER (
                WHERE date_submitted <= {cutoff}
                  AND score IS NOT NULL
            ) AS max_score_60,
            arg_min(score, due_date) FILTER (
                WHERE date_submitted <= {cutoff}
                  AND score IS NOT NULL
            ) AS first_score_60,
            arg_max(score, due_date) FILTER (
                WHERE date_submitted <= {cutoff}
                  AND score IS NOT NULL
            ) AS last_score_60,
            MAX(date_submitted) FILTER (
                WHERE date_submitted <= {cutoff}
            ) AS last_submission_day_60,
            COUNT(DISTINCT assessment_type) FILTER (
                WHERE date_submitted <= {cutoff}
            ) AS n_assessment_types_60
        FROM due
        GROUP BY code_module, code_presentation, id_student
        """
    )

    con.execute(
        f"""
        CREATE OR REPLACE TABLE vle_agg AS
        WITH v AS (
            SELECT
                sv.code_module,
                sv.code_presentation,
                sv.id_student,
                sv.id_site,
                sv.date,
                sv.sum_click,
                vl.activity_type
            FROM studentVle AS sv
            JOIN cohort AS c
                ON sv.code_module = c.code_module
               AND sv.code_presentation = c.code_presentation
               AND sv.id_student = c.id_student
            LEFT JOIN vle AS vl
                ON sv.id_site = vl.id_site
               AND sv.code_module = vl.code_module
               AND sv.code_presentation = vl.code_presentation
            WHERE sv.date <= {cutoff}
        ),
        agg AS (
            SELECT
                code_module,
                code_presentation,
                id_student,
                SUM(sum_click) AS vle_clicks_60,
                COUNT(DISTINCT date) AS vle_active_days_60,
                COUNT(DISTINCT id_site) AS vle_distinct_sites_60,
                SUM(sum_click) FILTER (WHERE date <= 30) AS vle_clicks_30,
                COUNT(DISTINCT date) FILTER (WHERE date <= 30) AS vle_active_days_30,
                SUM(sum_click) FILTER (WHERE date > 30) AS vle_clicks_31_60,
                COUNT(DISTINCT date) FILTER (WHERE date > 30) AS vle_active_days_31_60,
                SUM(sum_click) FILTER (WHERE date > {cutoff - 14}) AS vle_clicks_last_14_days_60,
                COUNT(DISTINCT date) FILTER (WHERE date > {cutoff - 14}) AS vle_active_days_last_14_days_60,
                MAX(date) AS last_vle_day_60,
                SUM(sum_click) FILTER (WHERE activity_type = 'forumng') AS forum_clicks_60,
                SUM(sum_click) FILTER (
                    WHERE activity_type IN (
                        'resource', 'subpage', 'oucontent', 'url', 'page',
                        'glossary', 'dualpane', 'folder', 'htmlactivity',
                        'repeatactivity', 'sharedsubpage'
                    )
                ) AS content_clicks_60,
                SUM(sum_click) FILTER (
                    WHERE activity_type IN ('quiz', 'externalquiz', 'questionnaire')
                ) AS quiz_clicks_60,
                SUM(sum_click) FILTER (
                    WHERE activity_type IN ('oucollaborate', 'ouelluminate')
                ) AS collab_clicks_60,
                COUNT(DISTINCT date) FILTER (WHERE activity_type = 'forumng') AS forum_active_days_60
            FROM v
            GROUP BY code_module, code_presentation, id_student
        )
        SELECT * FROM agg
        """
    )

    con.execute(
        f"""
        CREATE OR REPLACE TABLE features AS
        SELECT
            c.code_module,
            c.code_presentation,
            c.id_student,
            c.at_risk,
            c.num_of_prev_attempts,
            c.studied_credits,
            c.registration_lead_days,
            c.module_presentation_length,
            am.assessment_count_total,
            am.first_assessment_day,
            am.weight_due_60,
            COALESCE(aa.n_due_60, 0) AS n_due_60,
            COALESCE(aa.n_submitted_60, 0) AS n_submitted_60,
            COALESCE(aa.n_ontime_60, 0) AS n_ontime_60,
            COALESCE(aa.n_late_60, 0) AS n_late_60,
            COALESCE(aa.n_scored_60, 0) AS n_scored_60,
            COALESCE(aa.n_banked_60, 0) AS n_banked_60,
            aa.avg_score_60,
            aa.weighted_score_60,
            aa.min_score_60,
            aa.max_score_60,
            aa.first_score_60,
            aa.last_score_60,
            CASE WHEN COALESCE(aa.n_due_60, 0) > 0
                 THEN aa.n_submitted_60::DOUBLE / aa.n_due_60
                 ELSE NULL END AS submission_rate_60,
            CASE WHEN COALESCE(aa.n_submitted_60, 0) > 0
                 THEN aa.n_ontime_60::DOUBLE / aa.n_submitted_60
                 ELSE NULL END AS ontime_rate_60,
            CASE WHEN COALESCE(aa.n_due_60, 0) > 0
                 THEN aa.n_due_60 - COALESCE(aa.n_submitted_60, 0)
                 ELSE 0 END AS n_missing_60,
            CASE WHEN aa.last_submission_day_60 IS NOT NULL
                 THEN {cutoff} - aa.last_submission_day_60
                 ELSE NULL END AS days_since_last_submission_60,
            CASE WHEN COALESCE(aa.n_submitted_60, 0) > 0 THEN 1 ELSE 0 END AS has_assessment_60,
            COALESCE(va.vle_clicks_60, 0) AS vle_clicks_60,
            LN(1 + COALESCE(va.vle_clicks_60, 0)) AS log_vle_clicks_60,
            COALESCE(va.vle_active_days_60, 0) AS vle_active_days_60,
            COALESCE(va.vle_distinct_sites_60, 0) AS vle_distinct_sites_60,
            CASE WHEN COALESCE(va.vle_active_days_60, 0) > 0
                 THEN va.vle_clicks_60::DOUBLE / va.vle_active_days_60
                 ELSE NULL END AS vle_clicks_per_active_day_60,
            COALESCE(va.vle_clicks_30, 0) AS vle_clicks_30,
            COALESCE(va.vle_active_days_30, 0) AS vle_active_days_30,
            COALESCE(va.vle_clicks_31_60, 0) AS vle_clicks_31_60,
            COALESCE(va.vle_active_days_31_60, 0) AS vle_active_days_31_60,
            COALESCE(va.vle_clicks_last_14_days_60, 0) AS vle_clicks_last_14_days_60,
            COALESCE(va.vle_active_days_last_14_days_60, 0) AS vle_active_days_last_14_days_60,
            CASE WHEN va.last_vle_day_60 IS NOT NULL
                 THEN {cutoff} - va.last_vle_day_60
                 ELSE NULL END AS days_since_last_vle_60,
            CASE WHEN COALESCE(va.vle_active_days_60, 0) > 0 THEN 1 ELSE 0 END AS has_vle_60,
            COALESCE(va.forum_clicks_60, 0) AS forum_clicks_60,
            COALESCE(va.content_clicks_60, 0) AS content_clicks_60,
            COALESCE(va.quiz_clicks_60, 0) AS quiz_clicks_60,
            COALESCE(va.collab_clicks_60, 0) AS collab_clicks_60,
            COALESCE(va.forum_active_days_60, 0) AS forum_active_days_60,
            CASE WHEN COALESCE(va.vle_clicks_60, 0) > 0
                 THEN va.forum_clicks_60::DOUBLE / va.vle_clicks_60
                 ELSE NULL END AS forum_share_60,
            CASE WHEN COALESCE(va.vle_clicks_60, 0) > 0
                 THEN va.content_clicks_60::DOUBLE / va.vle_clicks_60
                 ELSE NULL END AS content_share_60,
            CASE WHEN COALESCE(va.vle_clicks_60, 0) > 0
                 THEN va.quiz_clicks_60::DOUBLE / va.vle_clicks_60
                 ELSE NULL END AS quiz_share_60
        FROM cohort AS c
        LEFT JOIN assess_meta AS am
            ON c.code_module = am.code_module
           AND c.code_presentation = am.code_presentation
        LEFT JOIN assess_agg AS aa
            ON c.code_module = aa.code_module
           AND c.code_presentation = aa.code_presentation
           AND c.id_student = aa.id_student
        LEFT JOIN vle_agg AS va
            ON c.code_module = va.code_module
           AND c.code_presentation = va.code_presentation
           AND c.id_student = va.id_student
        """
    )


def export_tables(con: duckdb.DuckDBPyConnection) -> dict:
    log(f"Exporting {FEATURES_PATH} ...")
    con.execute(
        f"COPY features TO '{FEATURES_PATH}' (FORMAT PARQUET, COMPRESSION ZSTD)"
    )
    log(f"Exporting {COHORT_META_PATH} ...")
    con.execute(
        f"COPY cohort_meta TO '{COHORT_META_PATH}' (FORMAT PARQUET, COMPRESSION ZSTD)"
    )

    feature_rows = con.execute("SELECT count(*) FROM features").fetchone()[0]
    active_students = con.execute(
        "SELECT count(DISTINCT id_student) FROM features"
    ).fetchone()[0]
    at_risk = con.execute("SELECT sum(at_risk) FROM features").fetchone()[0]
    at_risk_rate = con.execute("SELECT avg(at_risk) FROM features").fetchone()[0]
    all_rows = con.execute("SELECT count(*) FROM studentInfo").fetchone()[0]
    early_unregistered = con.execute(
        f"""
        SELECT count(*)
        FROM studentInfo AS si
        LEFT JOIN studentRegistration AS sr
            ON si.code_module = sr.code_module
           AND si.code_presentation = sr.code_presentation
           AND si.id_student = sr.id_student
        WHERE sr.date_unregistration IS NOT NULL
          AND sr.date_unregistration <= {CUTOFF_DAY}
        """
    ).fetchone()[0]
    no_vle = con.execute(
        "SELECT count(*) FROM features WHERE has_vle_60 = 0"
    ).fetchone()[0]
    no_assessment = con.execute(
        "SELECT count(*) FROM features WHERE has_assessment_60 = 0"
    ).fetchone()[0]
    missing_scores = con.execute(
        "SELECT count(*) FROM features WHERE avg_score_60 IS NULL"
    ).fetchone()[0]

    return {
        "feature_rows": int(feature_rows),
        "active_students": int(active_students),
        "at_risk_rows": int(at_risk),
        "at_risk_rate": float(at_risk_rate),
        "all_enrollments": int(all_rows),
        "early_unregistered": int(early_unregistered),
        "no_vle_rows": int(no_vle),
        "no_assessment_rows": int(no_assessment),
        "missing_score_rows": int(missing_scores),
    }


def package_version(name: str) -> str | None:
    try:
        return importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        return None


def write_metadata(stats: dict, source_hashes: dict) -> None:
    metadata = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset": "OULAD",
        "cutoff_day": CUTOFF_DAY,
        "target": TARGET,
        "target_positive_classes": list(TARGET_POSITIVE_CLASSES),
        "cohort_rule": f"date_unregistration IS NULL OR date_unregistration > {CUTOFF_DAY}",
        "feature_columns": FEATURE_COLUMNS,
        "categorical_features": CATEGORICAL_FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "n_features": len(FEATURE_COLUMNS),
        "stats": stats,
        "source_files": source_hashes,
        "software": {
            "python": platform.python_version(),
            "duckdb": package_version("duckdb"),
            "pandas": package_version("pandas"),
            "pyarrow": package_version("pyarrow"),
            "scikit-learn": package_version("scikit-learn"),
            "catboost": package_version("catboost"),
            "shap": package_version("shap"),
            "numpy": package_version("numpy"),
        },
    }
    FEATURE_META_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    log(f"Wrote {FEATURE_META_PATH}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--rebuild-db",
        action="store_true",
        help="Re-import the raw CSVs even if the DuckDB file already exists.",
    )
    args = parser.parse_args()

    ensure_dirs()
    check_raw_files()

    log(f"Opening DuckDB at {DB_PATH}")
    con = duckdb.connect(str(DB_PATH))
    con.execute("SET memory_limit='1800MB'")
    con.execute("SET threads=4")
    con.execute("SET preserve_insertion_order=false")
    con.execute(f"SET temp_directory='{DATA_DIR / 'duckdb_tmp'}'")

    try:
        tables_ready = con.execute(
            "SELECT count(*) FROM information_schema.tables "
            "WHERE table_name IN ('studentVle', 'studentInfo', 'assessments')"
        ).fetchone()[0]
        if args.rebuild_db or tables_ready != 3:
            import_tables(con)
        else:
            log("Reusing existing DuckDB tables")

        log("Computing source file hashes ...")
        source_hashes = {
            name: {
                "sha256": sha256_file(OULAD_DIR / name),
                "bytes": (OULAD_DIR / name).stat().st_size,
            }
            for name in EXPECTED_FILES
        }

        build_feature_tables(con)
        stats = export_tables(con)

        print("\nFeature table summary")
        for key, value in stats.items():
            if isinstance(value, float):
                print(f"  {key}: {value:.4f}")
            else:
                print(f"  {key}: {value:,}")

        write_metadata(stats, source_hashes)
        log("Done.")
    finally:
        con.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
