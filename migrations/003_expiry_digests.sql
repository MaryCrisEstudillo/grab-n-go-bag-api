-- Daily expiry reminders.
--
-- The demo-account idea was dropped in favour of real registration, so the
-- flag that supported it goes with it. Its partial index goes automatically.

ALTER TABLE users DROP COLUMN IF EXISTS is_demo;

-- Off means off. Every reminder carries an unsubscribe link that sets this.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_digest_sent_at timestamptz;

/**
 * A fingerprint of what the last reminder said — the items it listed and how
 * they were categorised. The job compares it before sending, so a bag nobody
 * has touched produces one email, not one every morning until the tin of
 * sardines is finally thrown out.
 */
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_digest_signature text;

-- The job's own read: everyone still opted in.
CREATE INDEX IF NOT EXISTS users_notifiable_idx
  ON users (id)
  WHERE notify_email;
