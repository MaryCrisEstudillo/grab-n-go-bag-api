import { randomBytes, randomUUID } from 'node:crypto';
import type { AuthSession, User } from '../types';
import { conflict, invalidCredentials, notFound } from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/password';
import { signToken } from '../lib/token';
import { assertValid, checkEmail, checkPassword } from '../lib/validation';
import { isUniqueViolation } from '../repositories/db';
import * as demo from '../repositories/demoRepository';
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
   * Hash a throwaway string when there is no account, so a missing address and
   * a wrong password take the same time to answer. Otherwise the response time
   * alone tells you which addresses are registered.
   */
  if (!user) {
    await verifyPassword(String(body.password), '$2a$10$' + 'x'.repeat(53));
    throw invalidCredentials();
  }

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
    const user = await users.insert(email, await hashPassword(String(body.password)));
    return toSession(user.id, user.email);
  } catch (error) {
    // Let the unique index decide, rather than checking first and racing.
    if (isUniqueViolation(error, 'users_email_unique')) {
      throw conflict('That email is already registered.', 'email');
    }
    throw error;
  }
}

/**
 * Mints a throwaway account with a bag already in it, and signs the visitor
 * straight in.
 *
 * One account per visitor rather than one shared demo login: a shared account
 * means the first person to delete a category takes it away from everyone
 * after them. Nobody ever types these credentials — the session comes back
 * with the response — so the password is random and never shown.
 */
export async function createDemoSession(): Promise<AuthSession> {
  const email = `demo-${randomUUID().slice(0, 8)}@grabngo.app`;
  const password = randomBytes(24).toString('base64url');

  const user = await demo.createSeededUser(email, await hashPassword(password));
  return toSession(user.id, user.email);
}

/** The token carries the email, but a deleted account should stop working. */
export async function currentUser(userId: string): Promise<User> {
  const user = await users.findById(userId);
  if (!user) throw notFound('Account');

  return { email: user.email };
}
