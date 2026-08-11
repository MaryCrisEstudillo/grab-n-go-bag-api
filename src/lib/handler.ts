import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';
import type { Actor } from '../types';
import { AppError, unauthorized } from './errors';
import { failure } from './response';
import { readToken, verifyToken } from './token';

/**
 * The two wrappers every handler is built from. They own the parts that would
 * otherwise be copy-pasted sixteen times: turning a thrown `AppError` into a
 * response, keeping anything unexpected from leaking, and resolving the token.
 */

type Result = APIGatewayProxyStructuredResultV2;

export type Handler = (event: APIGatewayProxyEventV2) => Promise<Result>;

export type AuthedHandler = (
  event: APIGatewayProxyEventV2,
  actor: Actor,
) => Promise<Result>;

function toResponse(error: unknown): Result {
  if (error instanceof AppError) {
    return failure(error.status, error.message, error.field);
  }

  // A bug, not a rejection. Log it in full; tell the caller nothing.
  console.error('Unhandled error', error);
  return failure(500, 'Something went wrong on our end.');
}

export function withErrors(handler: Handler) {
  return async (
    event: APIGatewayProxyEventV2,
    context: Context,
  ): Promise<Result> => {
    /**
     * Without this the invocation waits for the pool's idle socket to close
     * before returning — every request pays a few extra seconds, and the pool
     * is meant to stay open across invocations anyway.
     */
    context.callbackWaitsForEmptyEventLoop = false;

    try {
      return await handler(event);
    } catch (error) {
      return toResponse(error);
    }
  };
}

/** Same, plus a verified actor — the token is the only thing that grants one. */
export function withAuth(handler: AuthedHandler) {
  return withErrors(async (event) => {
    const header = event.headers.authorization ?? event.headers.Authorization;
    const token = readToken(header);
    if (!token) throw unauthorized();

    return handler(event, verifyToken(token));
  });
}
