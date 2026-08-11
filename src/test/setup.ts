/**
 * `lib/env.ts` reads its variables at module load and throws when one is
 * missing — deliberately, so a misconfigured deploy dies on its first
 * invocation rather than failing one request in ten thousand. Anything
 * importing it transitively therefore needs them present here too.
 *
 * These values are never connected to or signed with: no test in this suite
 * opens a socket. Setting them is what lets a pure function be imported from a
 * module that also happens to know about a database.
 */

process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET ??= 'test-secret-not-used-to-sign-anything-real';
