-- E-IDX core schema
--
-- Platform tables live in `public`. Academic risk data lives in the separate
-- `risk` schema and is only reachable by the runtime role through staff
-- scoped views, so a student-facing request can never read it even by
-- mistake. Raw VLE click logs are never stored here: the platform keeps
-- aggregated feature snapshots only.

CREATE SCHEMA IF NOT EXISTS risk;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     text UNIQUE NOT NULL,
  full_name       text NOT NULL,
  email           text UNIQUE,
  role            text NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
  programme       text,
  semester        text,
  section         text,
  mentor_id       uuid REFERENCES app_users (id) ON DELETE SET NULL,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_users_role_idx ON app_users (role) WHERE active;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  token_hash   text UNIQUE NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);

CREATE INDEX IF NOT EXISTS auth_sessions_token_idx ON auth_sessions (token_hash);

-- ---------------------------------------------------------------------------
-- Cards
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid UNIQUE NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  card_uid       text UNIQUE NOT NULL,
  status         text NOT NULL CHECK (status IN ('active', 'sync', 'low-battery', 'revoked', 'unprovisioned')),
  battery        smallint CHECK (battery BETWEEN 0 AND 100),
  firmware       text NOT NULL DEFAULT '1.4.2',
  valid_from     timestamptz NOT NULL DEFAULT now(),
  valid_to       timestamptz NOT NULL,
  last_sync_at   timestamptz,
  revoked_at     timestamptz,
  revoke_reason  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cards_status_idx ON cards (status);

CREATE TABLE IF NOT EXISTS card_updates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id          uuid NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  change_type      text NOT NULL CHECK (change_type IN ('validity', 'status', 'firmware', 'reissue')),
  summary          text NOT NULL,
  payload          jsonb NOT NULL,
  state            text NOT NULL CHECK (state IN ('queued', 'confirmed', 'failed')) DEFAULT 'queued',
  idempotency_key  text UNIQUE,
  actor_id         uuid NOT NULL REFERENCES app_users (id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  confirmed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS card_updates_student_idx ON card_updates (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS card_updates_state_idx ON card_updates (state, created_at DESC);

-- ---------------------------------------------------------------------------
-- Academic record (campus systems, not model inputs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS course_enrollments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  course_code   text NOT NULL,
  course_title  text,
  credits       smallint,
  enrolled_at   timestamptz NOT NULL DEFAULT now(),
  withdrawn_at  timestamptz,
  UNIQUE (student_id, course_code)
);

CREATE TABLE IF NOT EXISTS course_attendance_summary (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  course_code  text NOT NULL,
  held         integer NOT NULL CHECK (held >= 0),
  attended     integer NOT NULL CHECK (attended >= 0 AND attended <= held),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_code)
);

CREATE TABLE IF NOT EXISTS student_academic_profiles (
  student_id      uuid PRIMARY KEY REFERENCES app_users (id) ON DELETE CASCADE,
  cgpa            numeric(4,2) NOT NULL CHECK (cgpa BETWEEN 0 AND 10),
  backlogs        smallint NOT NULL DEFAULT 0 CHECK (backlogs >= 0),
  internal_marks  numeric(5,2) NOT NULL DEFAULT 0,
  internal_max    numeric(5,2) NOT NULL DEFAULT 25,
  assignment_rate numeric(5,2) NOT NULL DEFAULT 0,
  library_visits  smallint NOT NULL DEFAULT 0,
  sgpa            jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Attendance sessions and verification
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS readers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  location      text NOT NULL,
  api_key_hash  text UNIQUE NOT NULL,
  status        text NOT NULL CHECK (status IN ('online', 'offline')) DEFAULT 'online',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code     text NOT NULL,
  title           text NOT NULL,
  room            text,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  state           text NOT NULL CHECK (state IN ('upcoming', 'open', 'closed')) DEFAULT 'upcoming',
  total_expected  integer NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES app_users (id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendance_sessions_date_idx ON attendance_sessions (starts_at DESC);

CREATE TABLE IF NOT EXISTS attendance_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES attendance_sessions (id) ON DELETE CASCADE,
  student_id   uuid REFERENCES app_users (id) ON DELETE SET NULL,
  card_id      uuid REFERENCES cards (id) ON DELETE SET NULL,
  method       text NOT NULL CHECK (method IN ('qr', 'nfc')),
  status       text NOT NULL CHECK (status IN ('accepted', 'rejected')),
  reason       text,
  latency_ms   integer,
  reader_id    text NOT NULL,
  verified_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_accepted_uniq
  ON attendance_records (session_id, student_id) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS attendance_records_session_idx ON attendance_records (session_id, verified_at DESC);

CREATE TABLE IF NOT EXISTS verification_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_nonce  text UNIQUE NOT NULL,
  reader_id    text NOT NULL,
  method       text NOT NULL CHECK (method IN ('qr', 'nfc')),
  result       text NOT NULL CHECK (result IN ('accepted', 'rejected')),
  reason       text,
  latency_ms   integer,
  student_id   uuid REFERENCES app_users (id) ON DELETE SET NULL,
  card_id      uuid REFERENCES cards (id) ON DELETE SET NULL,
  verified_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_events_time_idx ON verification_events (verified_at DESC);

CREATE TABLE IF NOT EXISTS interventions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES app_users (id),
  note        text NOT NULL,
  source      text NOT NULL DEFAULT 'mentor' CHECK (source IN ('mentor', 'model-flag', 'counsellor')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interventions_student_idx ON interventions (student_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Campus services
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS exam_schedule (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code       text NOT NULL,
  title             text NOT NULL,
  starts_at         timestamptz NOT NULL,
  duration_minutes  integer NOT NULL DEFAULT 120,
  hall              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exam_schedule_start_idx ON exam_schedule (starts_at);

CREATE TABLE IF NOT EXISTS library_loans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  title       text NOT NULL,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  due_at      timestamptz NOT NULL,
  returned_at timestamptz
);

CREATE INDEX IF NOT EXISTS library_loans_student_idx ON library_loans (student_id, due_at);

CREATE TABLE IF NOT EXISTS fee_receipts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  term        text NOT NULL,
  amount      numeric(12,2) NOT NULL,
  paid_on     date NOT NULL,
  receipt_no  text NOT NULL,
  status      text NOT NULL CHECK (status IN ('Paid', 'Pending', 'Refundable')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fee_receipts_student_idx ON fee_receipts (student_id, paid_on DESC);

-- ---------------------------------------------------------------------------
-- Risk (staff only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS risk.feature_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  course_code    text NOT NULL,
  model_version  text NOT NULL,
  cutoff_day     integer NOT NULL CHECK (cutoff_day > 0),
  features       jsonb NOT NULL,
  captured_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_code, model_version, cutoff_day)
);

CREATE TABLE IF NOT EXISTS risk.predictions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  course_code    text NOT NULL,
  model_version  text NOT NULL,
  cutoff_day     integer NOT NULL CHECK (cutoff_day > 0),
  probability    numeric(6,5) NOT NULL CHECK (probability BETWEEN 0 AND 1),
  tier           text NOT NULL CHECK (tier IN ('support', 'watch', 'on-track')),
  drivers        jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_code, model_version, cutoff_day)
);

CREATE INDEX IF NOT EXISTS risk_predictions_student_idx ON risk.predictions (student_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS risk_predictions_tier_idx ON risk.predictions (tier);

-- Staff scope gate. The runtime role cannot read the base tables directly;
-- it only sees rows through these views, and only inside a transaction that
-- has set `eidx.staff_scope = 'on'`.
CREATE OR REPLACE FUNCTION risk.enable_staff_scope() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('eidx.staff_scope', 'on', true);
END;
$$;

CREATE OR REPLACE VIEW risk.staff_predictions AS
SELECT p.*
FROM risk.predictions p
WHERE COALESCE(current_setting('eidx.staff_scope', true), 'off') = 'on';

CREATE OR REPLACE VIEW risk.staff_feature_snapshots AS
SELECT f.*
FROM risk.feature_snapshots f
WHERE COALESCE(current_setting('eidx.staff_scope', true), 'off') = 'on';

-- ---------------------------------------------------------------------------
-- Housekeeping
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
  name        text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS app_users_updated_at ON app_users;
CREATE TRIGGER app_users_updated_at BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS cards_updated_at ON cards;
CREATE TRIGGER cards_updated_at BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
