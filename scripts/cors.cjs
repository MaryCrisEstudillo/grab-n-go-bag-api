/**
 * Splits CORS_ORIGIN into the list API Gateway expects.
 *
 * `serverless.yml` cannot split a string, so `allowedOrigins: [${env:CORS_ORIGIN}]`
 * would put a comma-separated value in as one malformed entry that matches no
 * origin at all, taking CORS down for every caller including the real site.
 *
 * CommonJS because package.json declares `"type": "module"` and Serverless
 * loads this with `require`.
 *
 * Note this is the only CORS that runs in production: on Lambda the gateway
 * answers preflights and adds the headers, and `lib/router.ts` is the local
 * server's shim, which never executes there. The two read the same variable so
 * that local and deployed behaviour stay described in one place.
 */

module.exports.allowedOrigins = () =>
  (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
