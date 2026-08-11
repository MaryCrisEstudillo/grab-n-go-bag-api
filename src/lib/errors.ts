/**
 * Every failure the API reports on purpose is an `AppError`. Anything else
 * reaching the handler wrapper is a bug, and is logged and reported as a 500
 * with no detail — internals are not the caller's business.
 */

export class AppError extends Error {
  readonly status: number;

  /** Which form field the message belongs against, when it belongs to one. */
  readonly field?: string;

  constructor(status: number, message: string, field?: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.field = field;
  }
}

export const badRequest = (message: string, field?: string) =>
  new AppError(400, message, field);

/**
 * Deliberately vague, and used for both a missing account and a wrong
 * password: saying which is which turns the login form into a way to find out
 * whether an address has an account here.
 */
export const invalidCredentials = () =>
  new AppError(401, 'Those details don’t match an account.');

export const unauthorized = (message = 'Sign in to continue.') =>
  new AppError(401, message);

export const notFound = (what: string) => new AppError(404, `${what} not found.`);

export const conflict = (message: string, field?: string) =>
  new AppError(409, message, field);
