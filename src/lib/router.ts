/**
 * Runs the Lambda handlers on a plain Node HTTP server.
 *
 * The handlers stay exactly as they are. This translates an incoming Node
 * request into the event shape they already expect, and their result back into
 * a response — so the same code runs on a long-lived server or on Lambda,
 * without either knowing which.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';
import { CORS_ORIGINS } from './env';

export type LambdaHandler = (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyStructuredResultV2>;

export interface Route {
  method: string;
  /** Segments, with `:name` capturing one. */
  path: string;
  handler: LambdaHandler;
}

/**
 * Lambda gives handlers a context object with far more on it than any of them
 * touch — they use exactly one field. Filling in the rest would be inventing
 * facts, so the stub carries what's real and nothing else.
 */
function stubContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'local',
    functionVersion: '1',
    invokedFunctionArn: 'local',
    memoryLimitInMB: '512',
    awsRequestId: crypto.randomUUID(),
    logGroupName: 'local',
    logStreamName: 'local',
    getRemainingTimeInMillis: () => 30_000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };
}

function segmentsOf(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/** Returns the captured params, or null when the pattern doesn't apply. */
export function matchPath(
  pattern: string,
  actual: string,
): Record<string, string> | null {
  const want = segmentsOf(pattern);
  const got = segmentsOf(actual);
  if (want.length !== got.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < want.length; i += 1) {
    if (want[i].startsWith(':')) {
      params[want[i].slice(1)] = decodeURIComponent(got[i]);
    } else if (want[i] !== got[i]) {
      return null;
    }
  }

  return params;
}

async function readBody(req: IncomingMessage): Promise<string | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);

  const body = Buffer.concat(chunks).toString('utf8');
  return body || undefined;
}

const ALLOWS_ANY_ORIGIN = CORS_ORIGINS.includes('*');

/** Constant for the life of the process, so they are built once. */
const STATIC_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
} as const;

function corsHeaders(origin: string | undefined): Record<string, string> {
  /**
   * Echoing the request's origin only when it's an allowed one keeps this
   * honest: a wildcard would let any site call the API with a user's token.
   * An origin that matches nothing still gets a header naming the first allowed
   * one, which is what the browser needs to see in order to block the response.
   */
  const allowed =
    origin && (ALLOWS_ANY_ORIGIN || CORS_ORIGINS.includes(origin))
      ? origin
      : CORS_ORIGINS[0];

  return { 'Access-Control-Allow-Origin': allowed, ...STATIC_CORS_HEADERS };
}

export function createRequestListener(routes: Route[]) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const cors = corsHeaders(req.headers.origin);

    // Preflight never reaches a handler.
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors).end();
      return;
    }

    const route = routes.find(
      (candidate) =>
        candidate.method === req.method && matchPath(candidate.path, url.pathname),
    );

    if (!route) {
      res
        .writeHead(404, { ...cors, 'Content-Type': 'application/json' })
        .end(JSON.stringify({ message: 'No such endpoint.' }));
      return;
    }

    const pathParameters = matchPath(route.path, url.pathname) ?? {};

    const event = {
      version: '2.0',
      routeKey: `${route.method} ${route.path}`,
      rawPath: url.pathname,
      rawQueryString: url.search.slice(1),
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(',') : (value ?? ''),
        ]),
      ),
      queryStringParameters: Object.fromEntries(url.searchParams),
      pathParameters,
      body: await readBody(req),
      isBase64Encoded: false,
      requestContext: {
        http: { method: req.method, path: url.pathname },
      },
    } as unknown as APIGatewayProxyEventV2;

    try {
      const result = await route.handler(event, stubContext());

      res.writeHead(result.statusCode ?? 200, {
        ...cors,
        ...(result.headers as Record<string, string> | undefined),
      });
      res.end(result.body ?? '');
    } catch (error) {
      // The handlers own their errors; reaching here means one escaped, which
      // is a bug worth logging loudly and saying nothing about.
      console.error('Unhandled error escaped a handler', error);
      res
        .writeHead(500, { ...cors, 'Content-Type': 'application/json' })
        .end(JSON.stringify({ message: 'Something went wrong on our end.' }));
    }
  };
}
