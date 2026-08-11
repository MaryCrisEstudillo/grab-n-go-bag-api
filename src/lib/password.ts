import bcrypt from 'bcryptjs';

/**
 * bcryptjs rather than bcrypt: pure JS, so there is no native module to build
 * for the Lambda runtime's architecture.
 */

const ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
