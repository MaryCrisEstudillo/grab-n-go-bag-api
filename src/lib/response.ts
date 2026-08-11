import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

/**
 * The four shapes every handler returns. The frontend's fetch wrapper reads
 * `message` off a failure body and treats 204 as "no body at all", so those
 * two details are contract, not style.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function ok(body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

export function created(body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 201, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

export function noContent(): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 204 };
}

export function failure(
  status: number,
  message: string,
  field?: string,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: status,
    headers: JSON_HEADERS,
    body: JSON.stringify(field ? { message, field } : { message }),
  };
}
