import type { UserRow } from '../types';
import { SEED_CATEGORIES, resolveSeedItems } from '../data/seed';
import { withTransaction } from './db';

/**
 * Creates an account with a bag already packed, in one transaction.
 *
 * Registration seeds rather than starting empty for two reasons: an empty bag
 * is a poor first screen, and the expiry reminder can only prove it works if
 * there is something in there to expire. The seed always includes items a few
 * days out, so the first digest lands the next morning.
 *
 * Spanning three tables is why this doesn't go through the per-table
 * repositories — nobody may land on an account holding half a bag.
 */
export function createUserWithSeededBag(
  email: string,
  passwordHash: string,
  today = new Date(),
): Promise<UserRow> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<UserRow>(
      `INSERT INTO users (email, password_hash)
            VALUES ($1, $2)
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
