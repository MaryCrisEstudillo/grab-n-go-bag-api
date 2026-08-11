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
