import type { UserRow } from '../types';
import { query, queryOne } from './db';

export function findByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `SELECT id, email, password_hash
       FROM users
      WHERE lower(email) = lower($1)`,
    [email],
  );
}

export function findById(id: string): Promise<UserRow | null> {
  return queryOne<UserRow>(
    `SELECT id, email, password_hash
       FROM users
      WHERE id = $1`,
    [id],
  );
}

export async function insert(email: string, passwordHash: string): Promise<UserRow> {
  const rows = await query<UserRow>(
    `INSERT INTO users (email, password_hash)
          VALUES ($1, $2)
       RETURNING id, email, password_hash`,
    [email.trim().toLowerCase(), passwordHash],
  );

  return rows[0];
}
