-- Demo accounts are minted one per visitor, so the app can be tried without
-- signing up and without one person's edits landing in the next person's bag.
--
-- Flagging them makes two things possible: sweeping up old ones on a schedule,
-- and telling real signups apart from traffic when reading the table.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- The sweep reads "demo accounts older than N days", so index for that.
CREATE INDEX IF NOT EXISTS users_demo_created_idx
  ON users (created_at)
  WHERE is_demo;
