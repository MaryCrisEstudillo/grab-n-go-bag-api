/**
 * Answers one question: does this DATABASE_URL work?
 *
 *   npm run db:check
 *
 * Worth running the moment you paste a new connection string, so a failure
 * points at the string rather than at whatever you were actually trying to do.
 */

import pg from 'pg';

function resolveDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  return value;
}

const url = resolveDatabaseUrl();

/** Never print the password, even to a terminal the user owns. */
function describe(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    return `${parsed.username}@${parsed.host}${parsed.pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
}

const isLocal = url.includes('localhost') || url.includes('127.0.0.1');

async function main() {
  console.log(`connecting to ${describe(url)}`);
  if (!isLocal && url.includes('-pooler')) {
    console.log('endpoint       pooled');
  } else if (!isLocal) {
    console.log('endpoint       direct');
  }

  const started = Date.now();
  const client = new pg.Client({
    connectionString: url,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    // A sleeping serverless instance takes a moment to wake.
    connectionTimeoutMillis: 20_000,
  });

  await client.connect();
  console.log(`connected      ${Date.now() - started}ms`);

  const { rows } = await client.query<{ version: string; db: string }>(
    'SELECT version() AS version, current_database() AS db',
  );
  console.log(`database       ${rows[0].db}`);
  console.log(`server         ${rows[0].version.split(',')[0]}`);

  const tables = await client.query<{ table_name: string; rows: string }>(
    `SELECT c.relname AS table_name, c.reltuples::bigint::text AS rows
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`,
  );

  if (tables.rows.length === 0) {
    console.log('tables         none yet — run `npm run migrate`');
  } else {
    console.log(
      `tables         ${tables.rows.map((row) => row.table_name).join(', ')}`,
    );
  }

  await client.end();
  console.log('\nOK');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nFAILED: ${message}`);

  // The three that actually happen, and what each one means.
  if (message.includes('password authentication failed')) {
    console.error(
      'Check the password. If the string has `channel_binding=require`, try removing it.',
    );
  } else if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    console.error('Reachable? Check the host, and any IP allowlist on the database.');
  } else if (message.includes('ENOTFOUND')) {
    console.error('The host does not resolve — likely a typo in the connection string.');
  }

  process.exit(1);
});
