import { query } from './db';

/**
 * Reads for the daily reminder job. One query for the whole run rather than a
 * query per user: a scheduled job that fans out N queries against a pooled
 * connection is how a five-second job becomes a five-minute one.
 */

export interface DigestRow {
  user_id: string;
  email: string;
  last_digest_signature: string | null;
  item_id: string;
  item_name: string;
  category_name: string;
  quantity: number;
  expires_on: string;
}

/**
 * Every item belonging to an opted-in user that is expired or within
 * `withinDays` of expiring, ordered so each user's items arrive together and
 * soonest-first.
 */
export function findExpiringItems(
  withinDays: number,
  today: string,
): Promise<DigestRow[]> {
  return query<DigestRow>(
    `SELECT u.id                    AS user_id,
            u.email                 AS email,
            u.last_digest_signature AS last_digest_signature,
            i.id                    AS item_id,
            i.name                  AS item_name,
            c.name                  AS category_name,
            i.quantity              AS quantity,
            i.expires_on            AS expires_on
       FROM users u
       JOIN items i      ON i.user_id = u.id
       JOIN categories c ON c.id = i.category_id
      WHERE u.notify_email
        AND i.expires_on IS NOT NULL
        AND i.expires_on <= ($2::date + $1::int)
      ORDER BY u.id, i.expires_on, i.name`,
    [withinDays, today],
  );
}

export async function markDigestSent(
  userId: string,
  signature: string,
): Promise<void> {
  await query(
    `UPDATE users
        SET last_digest_signature = $2,
            last_digest_sent_at   = now()
      WHERE id = $1`,
    [userId, signature],
  );
}

export async function setNotifyEmail(
  userId: string,
  enabled: boolean,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE users
        SET notify_email = $2
      WHERE id = $1
      RETURNING id`,
    [userId, enabled],
  );

  return rows.length > 0;
}
