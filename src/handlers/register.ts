import { withErrors } from '../lib/handler';
import { created } from '../lib/response';
import { parseBody } from '../lib/validation';
import * as authService from '../services/authService';

/** POST /auth/users */
export const handler = withErrors(async (event) =>
  created(await authService.register(parseBody(event.body))),
);
