import jwt from 'jsonwebtoken';
import type { Actor } from '../types';
import { JWT_EXPIRES_IN, JWT_SECRET } from './env';
import { unauthorized } from './errors';

interface TokenPayload {
  sub: string;
  email: string;
  /** Absent on session tokens. Set on the single-purpose ones below. */
  purpose?: string;
}

export function signToken(actor: Actor): string {
  const payload: TokenPayload = { sub: actor.id, email: actor.email };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * The frontend sends the token raw, but a `Bearer ` prefix is what everything
 * else in the world sends, so accept either rather than making it a support
 * question later.
 */
export function readToken(header: string | undefined): string | null {
  if (!header) return null;

  const value = header.trim();
  if (!value) return null;

  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? match[1].trim() : value;
}

/**
 * A separate, long-lived token for the unsubscribe link.
 *
 * `purpose` is what keeps the two apart: an unsubscribe link sits in an inbox
 * for months and may pass through forwarding and scanners, so it must never be
 * usable as a session. `verifyToken` rejects anything carrying a purpose, and
 * this rejects anything without one.
 */
export function signUnsubscribeToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: 'unsubscribe' }, JWT_SECRET, {
    expiresIn: '365d',
  });
}

export function verifyUnsubscribeToken(token: string): string {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    if (payload.purpose !== 'unsubscribe') {
      throw new Error('wrong purpose');
    }
    return payload.sub;
  } catch {
    throw unauthorized('That unsubscribe link is no longer valid.');
  }
}

export function verifyToken(token: string): Actor {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    // An unsubscribe token must never open a session — see above.
    if (payload.purpose) throw new Error('not a session token');

    return { id: payload.sub, email: payload.email };
  } catch {
    // Expired and forged are the same answer to the caller: sign in again.
    throw unauthorized('Your session has expired. Sign in again.');
  }
}
