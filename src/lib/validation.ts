/**
 * The same rules the frontend enforces, enforced again here — the client's
 * copy is a courtesy to the person typing, this one is the actual rule.
 *
 * Checkers are pure and return a message or `null`, so they can be tested
 * without touching a request. The `assert*` wrappers turn a message into the
 * `AppError` a handler should throw.
 */

import { badRequest } from './errors';

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_NAME_LENGTH = 80;
export const MIN_QUANTITY = 0;
export const MAX_QUANTITY = 9999;
export const MAX_EXPIRY_YEARS = 50;

// Deliberately loose: an address is only really validated by sending mail to it.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * ─── Pure checkers ───────────────────────────────────────────────────────────
 */

export function checkEmail(email: unknown): string | null {
  if (typeof email !== 'string' || !EMAIL.test(email.trim())) {
    return 'Enter a valid email address.';
  }
  return null;
}

export function checkPassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function checkName(name: unknown, what: string): string | null {
  if (typeof name !== 'string' || !name.trim()) return `Name the ${what}.`;
  if (name.trim().length > MAX_NAME_LENGTH) {
    return `Keep the name under ${MAX_NAME_LENGTH} characters.`;
  }
  return null;
}

export function checkQuantity(quantity: unknown): string | null {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    return 'Enter a quantity.';
  }
  // A packed-but-used-up item is a real state, so 0 is allowed — but 3.5 is
  // not silently truncated to 3.
  if (!Number.isInteger(quantity)) return 'Quantity must be a whole number.';
  if (quantity < MIN_QUANTITY) return "Quantity can't be negative.";
  if (quantity > MAX_QUANTITY) return `Quantity can't be over ${MAX_QUANTITY}.`;
  return null;
}

/**
 * Accepts only 'YYYY-MM-DD', and only if it names a day that exists — the
 * pattern alone would let '2026-02-31' through.
 */
export function checkISODate(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return 'Use a real date.';

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return 'Use a real date.';
  if (parsed.toISOString().slice(0, 10) !== value) return 'Use a real date.';

  return null;
}

/** Compared as calendar days in UTC, never as instants. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function checkDatePacked(
  datePacked: unknown,
  today = new Date(),
): string | null {
  const shape = checkISODate(datePacked);
  if (shape) return shape;

  const now = today.toISOString().slice(0, 10);
  if (daysBetween(now, datePacked as string) > 0) {
    return "You can't pack something in the future.";
  }
  return null;
}

export function checkExpiresOn(
  expiresOn: unknown,
  datePacked: string,
  today = new Date(),
): string | null {
  // No expiry at all is valid.
  if (expiresOn === null || expiresOn === undefined) return null;

  const shape = checkISODate(expiresOn);
  if (shape) return shape;

  if (daysBetween(datePacked, expiresOn as string) < 0) {
    return "Expiry can't be before the date packed.";
  }

  // Catches the mistyped '2206'.
  const limit = new Date(today);
  limit.setUTCFullYear(limit.getUTCFullYear() + MAX_EXPIRY_YEARS);
  if (daysBetween(limit.toISOString().slice(0, 10), expiresOn as string) > 0) {
    return `Expiry can't be more than ${MAX_EXPIRY_YEARS} years out.`;
  }

  return null;
}

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(quantity)));
}

/**
 * ─── Assertions ──────────────────────────────────────────────────────────────
 */

export function assertValid(message: string | null, field: string): void {
  if (message) throw badRequest(message, field);
}

/** A body that isn't an object at all is the caller's mistake, not a crash. */
export function parseBody(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw badRequest('Expected a JSON object.');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AppError') throw error;
    throw badRequest('Expected a JSON object.');
  }
}

export function requirePathParam(
  params: Record<string, string | undefined> | undefined,
  name: string,
): string {
  const value = params?.[name];
  if (!value) throw badRequest(`Missing ${name} in the path.`);
  return value;
}
