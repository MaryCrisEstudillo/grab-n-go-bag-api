/**
 * Read once, at module load, so a missing variable kills the container on its
 * first invocation rather than failing one request in ten thousand.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const DATABASE_URL = required('DATABASE_URL');
export const JWT_SECRET = required('JWT_SECRET');
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '30d';

/**
 * A comma-separated list, so the deployed site and a local dev server can be
 * allowed at once. Otherwise working locally means editing the deployed origin
 * out of `.env` and remembering to put it back.
 *
 * `||` rather than `??` so an empty variable falls back to the wildcard, the
 * same as an unset one. Parsed here rather than in `corsHeaders` because that
 * runs on every request, including every preflight, to re-derive a value that
 * cannot change.
 */
export const CORS_ORIGINS = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
