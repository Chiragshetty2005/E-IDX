-- Runtime role separation.
--
-- The API process connects as `eidx_app`, which can read and write the
-- platform tables but cannot touch the risk base tables. Academic risk is
-- only reachable through the staff scoped views, and only inside a
-- transaction that has enabled the staff scope flag.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eidx_app') THEN
    GRANT USAGE ON SCHEMA public, risk TO eidx_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO eidx_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eidx_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA risk TO eidx_app;

    REVOKE ALL ON risk.predictions FROM eidx_app;
    REVOKE ALL ON risk.feature_snapshots FROM eidx_app;
    GRANT SELECT ON risk.staff_predictions TO eidx_app;
    GRANT SELECT ON risk.staff_feature_snapshots TO eidx_app;
  END IF;
END
$$;
