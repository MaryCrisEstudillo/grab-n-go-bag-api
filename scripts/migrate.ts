/**
 * Applies every .sql file in migrations/ that hasn't run yet, in filename
 * order, each inside its own transaction. Deliberately small — a migration
 * library is one more thing to learn for a project with one table set.
 *
 *   npm run migrate
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { normalizeConnectionString, sslFor } from '../src/lib/connection';

/**
 * Migrations run against the direct connection when there is one. A pooler in
 * transaction mode is built for short-lived application queries, not for DDL
 * held open across a transaction — hosted Postgres providers hand out both a
 * pooled and a direct URL for exactly this reason.
 */
function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
    process.exit(1);
  }

  if (process.env.DATABASE_URL_UNPOOLED) {
    console.log('using DATABASE_URL_UNPOOLED (direct connection)');
  }
  return url;
}

const DATABASE_URL = resolveDatabaseUrl();

const MIGRATIONS_DIR = join(import.meta.dirname, '..', 'migrations');

async function main() {
  const client = new pg.Client({
    connectionString: normalizeConnectionString(DATABASE_URL),
    ssl: sslFor(DATABASE_URL),
  });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
      (row) => row.name,
    ),
  );

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  let ran = 0;

  for (const name of files) {
    if (applied.has(name)) continue;

    const sql = await readFile(join(MIGRATIONS_DIR, name), 'utf8');

    // Per migration, so a failure halfway through leaves nothing behind.
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      console.log(`applied  ${name}`);
      ran += 1;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`failed   ${name}`);
      throw error;
    }
  }

  console.log(ran === 0 ? 'Already up to date.' : `Applied ${ran} migration(s).`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
