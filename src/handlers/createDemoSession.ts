import { withErrors } from '../lib/handler';
import { created } from '../lib/response';
import * as authService from '../services/authService';

/**
 * POST /auth/demo
 *
 * Takes no body and needs no token: it mints a throwaway account with a bag
 * already packed and signs the visitor in, so the app can be tried without
 * anyone signing up first.
 */
export const handler = withErrors(async () =>
  created(await authService.createDemoSession()),
);
