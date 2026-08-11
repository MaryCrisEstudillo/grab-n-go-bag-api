import { withErrors } from '../lib/handler';
import { badRequest } from '../lib/errors';
import { ok } from '../lib/response';
import { verifyUnsubscribeToken } from '../lib/token';
import * as digestService from '../services/digestService';

/**
 * POST /notifications/unsubscribe
 *
 * The token in the link is the whole authorisation — someone acting on a link
 * from their own inbox shouldn't have to sign in first, and requiring it would
 * break the one-click unsubscribe mail clients expect.
 *
 * POST rather than GET on purpose: scanners and link previewers follow GETs,
 * and turning someone's reminders off because their mail provider prefetched a
 * link would be its own kind of bug.
 */
export const handler = withErrors(async (event) => {
  const token = event.queryStringParameters?.token;
  if (!token) throw badRequest('This unsubscribe link is missing its token.');

  await digestService.unsubscribe(verifyUnsubscribeToken(token));

  // Answers the same either way — a valid token that names a deleted account
  // has still achieved what the person wanted.
  return ok({ message: 'You will not get any more expiry reminders.' });
});
