import type { Context } from 'aws-lambda';
import * as digestService from '../services/digestService';

/**
 * Scheduled daily. Not an HTTP endpoint — EventBridge invokes it, so there is
 * no request to parse and nothing to return to a caller.
 *
 * It doesn't use `withErrors`: throwing is the right behaviour here, because a
 * thrown error is what makes the invocation show up as failed in CloudWatch
 * rather than passing silently.
 */
export const handler = async (_event: unknown, context: Context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const started = Date.now();
  const summary = await digestService.sendDailyDigests();

  console.log(
    `digest run — users with items: ${summary.usersWithItems}, ` +
      `sent: ${summary.sent}, unchanged: ${summary.skippedUnchanged}, ` +
      `failed: ${summary.failed}, ${Date.now() - started}ms`,
  );

  return summary;
};
