/**
 * How a connection string becomes connection options. Shared by the pool and
 * by the scripts, so all three agree on what TLS means.
 *
 * Kept free of `env.ts` on purpose: the scripts take a URL as an argument and
 * must not blow up over a missing `JWT_SECRET`.
 */

import type { ConnectionOptions } from 'node:tls';

export function isLocal(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

/**
 * `sslmode` and `channel_binding` are libpq's, and node-postgres now warns
 * whenever it sees them because its reading of `sslmode=require` is changing.
 * We set TLS explicitly below, so the parameters have nothing left to decide —
 * dropping them silences a warning that would otherwise print on every cold
 * start, without changing behaviour.
 *
 * They stay in `.env` regardless: that is the string the provider hands you,
 * and it should be pasteable as-is.
 */
export function normalizeConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('channel_binding');
    return parsed.toString();
  } catch {
    // Not a URL we can parse — hand it over untouched and let pg complain.
    return url;
  }
}

/**
 * Verify the server's certificate by default. Neon and most managed Postgres
 * present a publicly trusted cert, so verification just works — and without it
 * the connection would accept any certificate at all, which over the public
 * internet is an invitation.
 *
 * The escape hatch is for providers whose CA isn't in Node's bundle. RDS is
 * the one you'd hit: it needs its own CA bundle, and until that's supplied,
 * `DATABASE_SSL_NO_VERIFY=true` gets you connected.
 */
export function sslFor(url: string): ConnectionOptions | undefined {
  if (isLocal(url)) return undefined;

  return { rejectUnauthorized: process.env.DATABASE_SSL_NO_VERIFY !== 'true' };
}
