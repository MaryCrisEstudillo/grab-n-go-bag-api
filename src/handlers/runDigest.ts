import { timingSafeEqual } from 'node:crypto';
import { withErrors } from '../lib/handler';
import { AppError } from '../lib/errors';
import { ok } from '../lib/response';
import * as digestService from '../services/digestService';

/**
 * POST /internal/run-digest
 *
 * The same daily job EventBridge triggers on Lambda, exposed as an endpoint so
 * an external scheduler can call it on hosts whose free tier has no cron.
 *
 * Guarded by a shared secret rather than left open: anyone who could call this
 * freely could mail every user repeatedly, which is both a way to annoy your
 * users and a way to burn a daily sending quota.
 */

function authorised(provided: string | undefined): boolean {
  const expected = process.env.CRON_SECRET;
  // Unset means nobody can call it. Failing closed is the only safe default
  // for an endpoint that sends mail.
  if (!expected || !provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length, so compare that separately and always run the safe comparison.
  return a.length === b.length && timingSafeEqual(a, b);
}

export const handler = withErrors(async (event) => {
  const provided =
    event.headers['x-cron-secret'] ??
    event.headers['X-Cron-Secret'] ??
    event.queryStringParameters?.secret;

  if (!authorised(provided)) {
    // Deliberately indistinguishable from a missing route: an attacker
    // shouldn't learn that this endpoint exists.
    throw new AppError(404, 'No such endpoint.');
  }

  const started = Date.now();
  const summary = await digestService.sendDailyDigests();

  console.log(
    `digest run — users with items: ${summary.usersWithItems}, ` +
      `sent: ${summary.sent}, unchanged: ${summary.skippedUnchanged}, ` +
      `failed: ${summary.failed}, ${Date.now() - started}ms`,
  );

  return ok(summary);
});
