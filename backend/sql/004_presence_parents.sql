-- Parent links, checkpoints, hands-free presence and parent notifications.
--
-- The deck adds a school-safety layer on top of the college register:
-- UHF/QR/NFC readers log a child at the bus, gate and classroom, and only a
-- linked parent receives the alert. Academic risk stays in the separate
-- `risk` schema and is never reachable from a parent session.

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'college';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS class_label text;

ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('admin', 'faculty', 'student', 'parent'));

ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_level_check;
ALTER TABLE app_users ADD CONSTRAINT app_users_level_check
  CHECK (level IN ('school', 'college'));

CREATE INDEX IF NOT EXISTS app_users_level_idx ON app_users (level) WHERE role = 'student';

-- ---------------------------------------------------------------------------
-- Cards: the physical identifiers the readers see
-- ---------------------------------------------------------------------------

ALTER TABLE cards ADD COLUMN IF NOT EXISTS nfc_uid text;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS uhf_tag_id text;

CREATE UNIQUE INDEX IF NOT EXISTS cards_nfc_uid_idx
  ON cards (nfc_uid) WHERE nfc_uid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cards_uhf_tag_id_idx
  ON cards (uhf_tag_id) WHERE uhf_tag_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Parent links
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS parent_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  relationship    text NOT NULL DEFAULT 'guardian',
  primary_contact boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, student_id)
);

CREATE INDEX IF NOT EXISTS parent_links_parent_idx ON parent_links (parent_id);
CREATE INDEX IF NOT EXISTS parent_links_student_idx ON parent_links (student_id);

-- ---------------------------------------------------------------------------
-- Checkpoints and presence
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS checkpoints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  zone        text NOT NULL CHECK (zone IN ('bus', 'gate', 'classroom', 'library', 'canteen')),
  level       text NOT NULL DEFAULT 'school' CHECK (level IN ('school', 'college')),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS presence_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  checkpoint_id uuid NOT NULL REFERENCES checkpoints (id) ON DELETE RESTRICT,
  direction     text NOT NULL CHECK (direction IN ('in', 'out')),
  method        text NOT NULL CHECK (method IN ('uhf', 'qr', 'nfc')),
  source        text NOT NULL DEFAULT 'reader' CHECK (source IN ('reader', 'simulated', 'seed')),
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS presence_events_student_idx
  ON presence_events (student_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS presence_events_time_idx
  ON presence_events (occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Parent notifications (app push and SMS outbox)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  event_id    uuid REFERENCES presence_events (id) ON DELETE SET NULL,
  channel     text NOT NULL CHECK (channel IN ('push', 'sms')),
  status      text NOT NULL DEFAULT 'queued' CHECK (status IN ('sent', 'queued', 'failed')),
  title       text NOT NULL,
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_parent_idx
  ON notifications (parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_student_idx
  ON notifications (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_time_idx
  ON notifications (created_at DESC);

-- ---------------------------------------------------------------------------
-- Runtime role grants
--
-- 002 granted the tables that existed then. The migration runner applies this
-- file afterwards, so the new tables need their own grant.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eidx_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      parent_links, checkpoints, presence_events, notifications TO eidx_app;
  END IF;
END
$$;
