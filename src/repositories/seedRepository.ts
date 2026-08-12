import type { UserRow } from '../types';
import { SEED_CATEGORIES } from '../data/seed';
import { withTransaction } from './db';

/**
 * Creates an account with its categories already in place, in one transaction.
 *
 * Categories but no items: eight obvious places to start putting things beats
 * a blank page, and what goes in the bag is the owner's to decide. Seeding
 * items would also mean the daily reminder mails someone about things they
 * never packed.
 *
 * Spanning two tables is why this doesn't go through the per-table
 * repositories — nobody may land on an account holding half a bag.
 */
export function createUserWithSeededBag(
  email: string,
  passwordHash: string,
): Promise<UserRow> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<UserRow>(
      `INSERT INTO users (email, password_hash)
            VALUES ($1, $2)
         RETURNING id, email, password_hash`,
      [email, passwordHash],
    );
    const user = rows[0];

    // One statement for all eight.
    const categoryValues = SEED_CATEGORIES.map(
      (_, index) => `($1, $${index * 2 + 2}, $${index * 2 + 3})`,
    ).join(', ');

    await client.query(
      `INSERT INTO categories (user_id, name, icon)
            VALUES ${categoryValues}`,
      [user.id, ...SEED_CATEGORIES.flatMap((c) => [c.name, c.icon])],
    );

    return user;
  });
}
