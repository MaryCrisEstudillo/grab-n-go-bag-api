import pg from 'pg';
import { DATABASE_URL } from '../lib/env';
import { normalizeConnectionString, sslFor } from '../lib/connection';

/**
 * A `date` column is a calendar day, and node-postgres would otherwise hand it
 * back as a JS Date at local midnight — which is how "expires today" turns into
 * "expired" for anyone east of the server. Keep the raw 'YYYY-MM-DD' string.
 */
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

/**
 * Lambda and connection pools are a bad pairing: every warm container holds its
 * own pool, so a pool of 10 across 50 concurrent containers is 500 connections
 * against a database that will accept about 100.
 *
 * One connection per container, created lazily and reused across invocations,
 * is the shape that actually works. If concurrency ever climbs past what
 * Postgres will accept, the answer is RDS Proxy in front of it — not a bigger
 * `max` here.
 */
let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: normalizeConnectionString(DATABASE_URL),
      max: 1,
      idleTimeoutMillis: 30_000,
      /**
       * Generous on purpose. A serverless Postgres that has scaled to zero
       * needs a second or two to wake, and that wake lands on whichever
       * request arrives first after a quiet spell. Five seconds would turn a
       * normal cold start into an error.
       */
      connectionTimeoutMillis: 15_000,
      ssl: sslFor(DATABASE_URL),
    });

    // A dropped backend must not take the container down with an unhandled
    // 'error' event; the next query opens a fresh connection.
    pool.on('error', (error) => {
      console.error('Idle client error', error);
    });
  }

  return pool;
}

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

/** The single-row read every `findById` wants. */
export async function queryOne<T extends pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Postgres' code for a unique index violation. */
export const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (!error || typeof error !== 'object') return false;

  const { code, constraint: hit } = error as { code?: string; constraint?: string };
  if (code !== UNIQUE_VIOLATION) return false;

  return constraint ? hit === constraint : true;
}
