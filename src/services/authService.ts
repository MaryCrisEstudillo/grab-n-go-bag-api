import type { AuthSession, User } from '../types';
import {
  conflict,
  invalidCredentials,
  noSuchAccount,
  notFound,
} from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/password';
import { signToken } from '../lib/token';
import { assertValid, checkEmail, checkPassword } from '../lib/validation';
import { isUniqueViolation } from '../repositories/db';
import * as seed from '../repositories/seedRepository';
import * as users from '../repositories/userRepository';

function toSession(id: string, email: string): AuthSession {
  return { token: signToken({ id, email }), user: { email } };
}

export async function signIn(body: Record<string, unknown>): Promise<AuthSession> {
  assertValid(checkEmail(body.email), 'email');
  assertValid(checkPassword(body.password), 'password');

  const email = String(body.email).trim();
  const user = await users.findByEmail(email);

  /**
   * A dummy hash used to run here, so that a missing address and a wrong
   * password took the same time to answer. It is gone because the two now
   * return different messages anyway. Equalising the timing while the response
   * body states which case it is would defend nothing.
   */
  if (!user) throw noSuchAccount();

  if (!(await verifyPassword(String(body.password), user.password_hash))) {
    throw invalidCredentials();
  }

  return toSession(user.id, user.email);
}

export async function register(
  body: Record<string, unknown>,
): Promise<AuthSession> {
  assertValid(checkEmail(body.email), 'email');
  assertValid(checkPassword(body.password), 'password');

  const email = String(body.email).trim().toLowerCase();

  try {
    const user = await seed.createUserWithSeededBag(
      email,
      await hashPassword(String(body.password)),
    );
    return toSession(user.id, user.email);
  } catch (error) {
    // Let the unique index decide, rather than checking first and racing.
    if (isUniqueViolation(error, 'users_email_unique')) {
      throw conflict('That email is already registered.', 'email');
    }
    throw error;
  }
}

/** The token carries the email, but a deleted account should stop working. */
export async function currentUser(userId: string): Promise<User> {
  const user = await users.findById(userId);
  if (!user) throw notFound('Account');

  return { email: user.email };
}
