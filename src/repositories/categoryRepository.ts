import type { CategoryRow } from '../types';
import { query, queryOne } from './db';

/**
 * Every statement filters on user_id. That is the ownership rule, and keeping
 * it in the WHERE rather than in a service check means there is no path to
 * another person's row even if a caller above forgets.
 */

const COLUMNS = 'id, name, icon';

export function findAll(userId: string): Promise<CategoryRow[]> {
  return query<CategoryRow>(
    `SELECT ${COLUMNS}
       FROM categories
      WHERE user_id = $1
      ORDER BY created_at`,
    [userId],
  );
}

export function findById(userId: string, id: string): Promise<CategoryRow | null> {
  return queryOne<CategoryRow>(
    `SELECT ${COLUMNS}
       FROM categories
      WHERE user_id = $1 AND id = $2`,
    [userId, id],
  );
}

export async function insert(
  userId: string,
  name: string,
  icon: string,
): Promise<CategoryRow> {
  const rows = await query<CategoryRow>(
    `INSERT INTO categories (user_id, name, icon)
          VALUES ($1, $2, $3)
       RETURNING ${COLUMNS}`,
    [userId, name, icon],
  );

  return rows[0];
}

/**
 * COALESCE so an absent key means "leave it alone" — a PATCH that only sends
 * `name` must not blank the icon.
 */
export function update(
  userId: string,
  id: string,
  patch: { name?: string; icon?: string },
): Promise<CategoryRow | null> {
  return queryOne<CategoryRow>(
    `UPDATE categories
        SET name = COALESCE($3, name),
            icon = COALESCE($4, icon)
      WHERE user_id = $1 AND id = $2
      RETURNING ${COLUMNS}`,
    [userId, id, patch.name ?? null, patch.icon ?? null],
  );
}

/** Items go with it — the cascade is declared on the foreign key. */
export async function remove(userId: string, id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM categories
      WHERE user_id = $1 AND id = $2
      RETURNING id`,
    [userId, id],
  );

  return rows.length > 0;
}
