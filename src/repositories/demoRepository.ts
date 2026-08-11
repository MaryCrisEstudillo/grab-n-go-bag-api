import type { UserRow } from '../types';
import { SEED_CATEGORIES, resolveSeedItems } from '../data/seed';
import { withTransaction } from './db';

/**
 * Creates a demo account and its whole bag in one transaction. Spanning three
 * tables is exactly why this doesn't go through the per-table repositories —
 * a visitor must never land on an account with half a bag in it.
 */
export function createSeededUser(
  email: string,
  passwordHash: string,
  today = new Date(),
): Promise<UserRow> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<UserRow>(
      `INSERT INTO users (email, password_hash, is_demo)
            VALUES ($1, $2, true)
         RETURNING id, email, password_hash`,
      [email, passwordHash],
    );
    const user = rows[0];

    // One statement for all eight, and RETURNING gives back the minted ids in
    // insertion order — which is how each item finds its category below.
    const categoryValues = SEED_CATEGORIES.map(
      (_, index) => `($1, $${index * 2 + 2}, $${index * 2 + 3})`,
    ).join(', ');

    const categories = await client.query<{ id: string }>(
      `INSERT INTO categories (user_id, name, icon)
            VALUES ${categoryValues}
         RETURNING id`,
      [user.id, ...SEED_CATEGORIES.flatMap((c) => [c.name, c.icon])],
    );

    const idByKey = new Map(
      SEED_CATEGORIES.map((category, index) => [
        category.key,
        categories.rows[index].id,
      ]),
    );

    const items = resolveSeedItems(today);
    const itemValues = items
      .map((_, i) => {
        const base = i * 6 + 2;
        return `($1, $${base}, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
      })
      .join(', ');

    await client.query(
      `INSERT INTO items
              (user_id, category_id, name, description, quantity, date_packed, expires_on)
            VALUES ${itemValues}`,
      [
        user.id,
        ...items.flatMap((item) => [
          idByKey.get(item.categoryKey),
          item.name,
          item.description,
          item.quantity,
          item.datePacked,
          item.expiresOn,
        ]),
      ],
    );

    return user;
  });
}

/**
 * Sweeps up demo accounts past `olderThanDays`. Their categories and items go
 * with them through the cascade. Nothing calls this on a schedule yet — it is
 * here so that when the table needs it, the query already exists and is known
 * to be scoped to demo rows only.
 */
export async function removeStaleDemoUsers(olderThanDays: number): Promise<number> {
  return withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `DELETE FROM users
        WHERE is_demo
          AND created_at < now() - make_interval(days => $1)`,
      [olderThanDays],
    );
    return rowCount ?? 0;
  });
}
