-- Users, and the two tables that make up a bag.
--
-- Everything is scoped by user_id: one person's bag is never reachable from
-- another person's token, and the repositories enforce that in every WHERE.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Emails are compared lowercased, so uniqueness has to be too.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));

CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       text NOT NULL,
  icon       text NOT NULL DEFAULT 'package',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT categories_name_length CHECK (char_length(name) BETWEEN 1 AND 80)
);

-- "You already have a category with that name" — per user, case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_unique
  ON categories (user_id, lower(name));

CREATE TABLE IF NOT EXISTS items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- Items belong to exactly one category, and go with it when it is deleted.
  category_id uuid NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  quantity    integer NOT NULL DEFAULT 0,
  -- `date`, not `timestamptz`: an expiry is a calendar day. Storing it with a
  -- time would let "expires today" flip to "expired" partway through the
  -- afternoon, or shift when the phone crosses a timezone.
  date_packed date NOT NULL,
  expires_on  date,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT items_name_length CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT items_quantity_range CHECK (quantity BETWEEN 0 AND 9999),
  CONSTRAINT items_expiry_after_packed CHECK (expires_on IS NULL OR expires_on >= date_packed)
);

CREATE INDEX IF NOT EXISTS items_user_idx ON items (user_id);
CREATE INDEX IF NOT EXISTS items_category_idx ON items (category_id);
-- The dashboard's "what's expiring" read, in index order.
CREATE INDEX IF NOT EXISTS items_user_expires_idx ON items (user_id, expires_on);
