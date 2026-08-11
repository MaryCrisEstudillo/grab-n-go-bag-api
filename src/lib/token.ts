import jwt from 'jsonwebtoken';
import type { Actor } from '../types';
import { JWT_EXPIRES_IN, JWT_SECRET } from './env';
import { unauthorized } from './errors';

interface TokenPayload {
  sub: string;
  email: string;
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

export function verifyToken(token: string): Actor {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return { id: payload.sub, email: payload.email };
  } catch {
    // Expired and forged are the same answer to the caller: sign in again.
    throw unauthorized('Your session has expired. Sign in again.');
  }
}
