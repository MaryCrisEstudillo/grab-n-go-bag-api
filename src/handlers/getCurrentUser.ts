import { withAuth } from '../lib/handler';
import { ok } from '../lib/response';
import * as authService from '../services/authService';

/** GET /auth/users/me */
export const handler = withAuth(async (_event, actor) =>
  ok(await authService.currentUser(actor.id)),
);
