import { withAuth } from '../lib/handler';
import { noContent } from '../lib/response';

/**
 * DELETE /auth/sessions
 *
 * Tokens are stateless, so there is nothing on this side to revoke — the client
 * drops it. The endpoint exists so that signing out is a real request the
 * client can await, and so revocation can land here later without the frontend
 * changing. It still requires a valid token: an unauthenticated caller has no
 * session to end.
 */
export const handler = withAuth(async () => noContent());
