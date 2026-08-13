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
 * A password that doesn't match an account that does exist.
 *
 * This used to cover the missing-account case too, so that the login form
 * couldn't be used to find out which addresses are registered here. That was
 * traded away deliberately for the clearer message: someone who mistypes their
 * address should be told to register rather than be left doubting a password
 * they got right. See `noSuchAccount`.
 */
export const invalidCredentials = () =>
  new AppError(401, 'That password doesn’t match this account.', 'password');

/**
 * The other half of that split. Attributed to the email field, so the form puts
 * it where the mistake actually is.
 */
export const noSuchAccount = () =>
  new AppError(
    401,
    'No account found for that email. Create one to get started.',
    'email',
  );

export const unauthorized = (message = 'Sign in to continue.') =>
  new AppError(401, message);

export const notFound = (what: string) => new AppError(404, `${what} not found.`);

export const conflict = (message: string, field?: string) =>
  new AppError(409, message, field);
