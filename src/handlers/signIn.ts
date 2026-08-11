import { withErrors } from '../lib/handler';
import { ok } from '../lib/response';
import { parseBody } from '../lib/validation';
import * as authService from '../services/authService';

/** POST /auth/sessions */
export const handler = withErrors(async (event) =>
  ok(await authService.signIn(parseBody(event.body))),
);
