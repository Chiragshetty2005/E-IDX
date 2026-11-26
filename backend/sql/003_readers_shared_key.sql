-- Readers share the campus device credential in the preview deployment, so the
-- key hash cannot be unique per row. Keep an index for lookups instead.

ALTER TABLE readers DROP CONSTRAINT IF EXISTS readers_api_key_hash_key;

CREATE INDEX IF NOT EXISTS readers_api_key_hash_idx ON readers (api_key_hash);
