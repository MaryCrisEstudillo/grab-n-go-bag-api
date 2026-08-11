import type { ItemRow } from '../types';
import { query, queryOne } from './db';

const COLUMNS =
  'id, category_id, name, description, quantity, date_packed, expires_on';

export interface ItemInsert {
  categoryId: string;
  name: string;
  description: string;
  quantity: number;
  datePacked: string;
  expiresOn: string | null;
}

export interface ItemPatch {
  categoryId?: string;
  name?: string;
  description?: string;
  quantity?: number;
  datePacked?: string;
  expiresOn?: string | null;
}

export function findAll(userId: string): Promise<ItemRow[]> {
  return query<ItemRow>(
    `SELECT ${COLUMNS}
       FROM items
      WHERE user_id = $1
      ORDER BY created_at`,
    [userId],
  );
}

export function findByCategory(
  userId: string,
  categoryId: string,
): Promise<ItemRow[]> {
  return query<ItemRow>(
    `SELECT ${COLUMNS}
       FROM items
      WHERE user_id = $1 AND category_id = $2
      ORDER BY created_at`,
    [userId, categoryId],
  );
}

export function findById(userId: string, id: string): Promise<ItemRow | null> {
  return queryOne<ItemRow>(
    `SELECT ${COLUMNS}
       FROM items
      WHERE user_id = $1 AND id = $2`,
    [userId, id],
  );
}

export async function insert(userId: string, values: ItemInsert): Promise<ItemRow> {
  const rows = await query<ItemRow>(
    `INSERT INTO items
            (user_id, category_id, name, description, quantity, date_packed, expires_on)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNS}`,
    [
      userId,
      values.categoryId,
      values.name,
      values.description,
      values.quantity,
      values.datePacked,
      values.expiresOn,
    ],
  );

  return rows[0];
}

/**
 * `expiresOn` can't use COALESCE — null is a meaningful value here ("this
 * doesn't expire"), not an absent one. The extra flag says which was meant.
 */
export function update(
  userId: string,
  id: string,
  patch: ItemPatch,
): Promise<ItemRow | null> {
  const clearsExpiry = 'expiresOn' in patch;

  return queryOne<ItemRow>(
    `UPDATE items
        SET category_id = COALESCE($3, category_id),
            name        = COALESCE($4, name),
            description = COALESCE($5, description),
            quantity    = COALESCE($6, quantity),
            date_packed = COALESCE($7, date_packed),
            expires_on  = CASE WHEN $8 THEN $9 ELSE expires_on END
      WHERE user_id = $1 AND id = $2
      RETURNING ${COLUMNS}`,
    [
      userId,
      id,
      patch.categoryId ?? null,
      patch.name ?? null,
      patch.description ?? null,
      patch.quantity ?? null,
      patch.datePacked ?? null,
      clearsExpiry,
      patch.expiresOn ?? null,
    ],
  );
}

export function updateQuantity(
  userId: string,
  id: string,
  quantity: number,
): Promise<ItemRow | null> {
  return queryOne<ItemRow>(
    `UPDATE items
        SET quantity = $3
      WHERE user_id = $1 AND id = $2
      RETURNING ${COLUMNS}`,
    [userId, id, quantity],
  );
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM items
      WHERE user_id = $1 AND id = $2
      RETURNING id`,
    [userId, id],
  );

  return rows.length > 0;
}
