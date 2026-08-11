# GrabnGo bag API

The backend for [GrabnGo bag](../grab-n-go-bag-app) — sessions, categories and
items for the emergency-kit tracker.

AWS Lambda behind API Gateway, deployed with the Serverless Framework, over
Postgres. Sixteen endpoints, one handler each.

## Running it

Requires Node 20+ (there's an `.nvmrc`) and Docker.

```sh
nvm use
npm install
cp .env.example .env       # then set JWT_SECRET to anything long
docker compose up -d       # Postgres on :5432
npm run migrate            # create the tables
npm run dev                # http://localhost:3001
```

| Script | Does |
| --- | --- |
| `npm run dev` | serverless-offline on :3001, with hot reload |
| `npm run migrate` | Apply any migrations that haven't run |
| `npm run db:check` | Confirm `DATABASE_URL` connects, and say what's there |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript only |
| `npm run deploy` | `serverless deploy` — needs AWS credentials |

Point the frontend at it with both of its base URLs:

```sh
VITE_AUTH_URL=http://localhost:3001/auth
VITE_BAG_API_URL=http://localhost:3001/bag
```

## Endpoints

Everything except signing in and registering needs an `Authorization` header.
The token is accepted raw or with a `Bearer ` prefix — the frontend sends it
raw.

### Auth

| | | |
| --- | --- | --- |
| `POST` | `/auth/sessions` | Sign in → `{ token, user }` |
| `DELETE` | `/auth/sessions` | Sign out → `204` |
| `POST` | `/auth/users` | Register → `201 { token, user }` |
| `GET` | `/auth/users/me` | The user behind the token |

### Categories

| | | |
| --- | --- | --- |
| `GET` | `/bag/categories` | |
| `GET` | `/bag/categories/:id` | |
| `POST` | `/bag/categories` | `201` |
| `PATCH` | `/bag/categories/:id` | |
| `DELETE` | `/bag/categories/:id` | `204`, and takes its items with it |
| `GET` | `/bag/categories/:id/items` | |

### Items

| | | |
| --- | --- | --- |
| `GET` | `/bag/items` | |
| `GET` | `/bag/items/:id` | |
| `POST` | `/bag/items` | `201` |
| `PATCH` | `/bag/items/:id` | |
| `PATCH` | `/bag/items/:id/quantity` | Its own endpoint — the stepper fires it far more often than any other edit |
| `DELETE` | `/bag/items/:id` | `204` |

Failures answer with `{ "message": string, "field"?: string }`. `field` is set
when the message belongs against a particular form input, so the client can put
it there instead of in a banner.

## How it's laid out

```
serverless.yml         Function → route mapping, one entry per endpoint
migrations/            Plain .sql, applied in filename order
scripts/migrate.ts     The runner — tracks what's applied in schema_migrations
src/
  handlers/            One file per endpoint. Parse, delegate, respond.
  services/            The rules. Validation, ownership, row → wire shape.
  repositories/        The only SQL in the app.
  lib/
    handler.ts         withErrors / withAuth — the two wrappers
    response.ts        ok · created · noContent · failure
    errors.ts          AppError, and the constructors for each status
    validation.ts      Pure checkers, unit-tested
    token.ts           Sign, read and verify the session token
    password.ts        bcrypt, wrapped
    env.ts             Read once at load, fail loudly
```

A handler stays a handler: it pulls the body and path params, calls one service
method, and picks a response shape. Nothing else. Everything worth testing is a
layer down.

### Ownership

Every statement in the repositories filters on `user_id`, including the reads
that already have a primary key. Keeping it in the `WHERE` rather than in a
service-level check means there is no code path to another person's rows, even
if a caller above forgets to look.

For the same reason, an item filed under someone else's category is refused
with "that category does not exist" rather than a permissions error — the
honest answer would confirm the id is real.

### Dates are calendar days

`date_packed` and `expires_on` are Postgres `date`, not `timestamptz`, and
node-postgres is told to hand them back as raw `'YYYY-MM-DD'` strings rather
than JS `Date` objects. Both halves matter: stored with a time, "expires today"
flips to "expired" partway through the afternoon; parsed into a `Date`, it
shifts for anyone whose clock isn't the server's.

### Validation

The rules are the same ones the frontend enforces — 8+ character passwords,
names under 80 characters, whole-number quantities from 0 to 9999, no packing
in the future, no expiry before the date packed or more than 50 years out. The
client's copy is a courtesy to the person typing; this one is the actual rule.

Checkers are pure and return a message or `null`, so they're tested without a
request in sight.

### Auth

Passwords are bcrypt (`bcryptjs` — pure JS, so there's no native module to
build for the Lambda runtime). Sessions are JWTs signed with `JWT_SECRET`,
carrying the user id and email, good for `JWT_EXPIRES_IN` (30 days by default).

Two deliberate details:

- **Sign-in failures don't say which half was wrong.** "Those details don't
  match an account" covers both, and a fake hash is compared when no account
  exists so the two take the same time to answer. Otherwise the response time
  alone tells you which addresses are registered.
- **`DELETE /auth/sessions` doesn't revoke anything.** Tokens are stateless;
  the client drops it. The endpoint exists so signing out is a real request the
  client can await, and so revocation can land here later without the frontend
  changing.

### Lambda and Postgres

These two don't naturally get along: every warm container holds its own pool, so
`max: 10` across 50 concurrent containers is 500 connections against a database
that will accept about 100.

The pool here is created lazily at module scope with `max: 1` and reused across
invocations, and `callbackWaitsForEmptyEventLoop` is set to `false` so the
invocation doesn't wait for the idle socket to close. That's the shape that
works at small scale.

**If concurrency ever climbs past what Postgres will accept, the answer is RDS
Proxy in front of it, not a bigger `max` here.** Worth deciding before the first
real deploy.

## Tests

```sh
npm test
```

Covers `lib/validation.ts` — every boundary that must reject and every one that
must allow: quantity `0`, an expiry already in the past, no expiry at all,
expiring on the day it was packed. Also the cases a regex alone would wave
through, like `2026-02-31`, and the non-strings a request body can always
contain.

The services and repositories aren't covered yet — that needs a test database
and a fixtures story, which is the obvious next piece of work.

## Using Neon instead of local Postgres

Nothing in `src/` changes — only what `DATABASE_URL` points at.

1. Create a project at [neon.tech](https://neon.tech). The free tier is enough
   for roughly 8,000 users' worth of bags.
2. From the dashboard, copy the **pooled** connection string — its host contains
   `-pooler`. Take that one, not the direct one.
3. Put both in `.env`:

   ```sh
   DATABASE_URL=postgres://…-pooler.…neon.tech/…?sslmode=require
   DATABASE_URL_UNPOOLED=postgres://…              # the direct string
   ```

4. Check it, then migrate:

   ```sh
   npm run db:check
   npm run migrate
   npm run dev
   ```

`db:check` prints the host, whether you gave it the pooled or direct endpoint,
and which tables exist. Run it first — a failure there points at the connection
string rather than at whatever you were trying to do next.

**Why the pooled string.** Every warm Lambda container holds its own pool, so
`max: 10` across 50 containers is 500 connections against a database that
accepts about 100. Neon's pooler sits in front and absorbs that. It's the same
problem RDS would need RDS Proxy for — using the pooled endpoint is how it stays
solved for free.

**Why migrations use the direct string.** A transaction pooler is built for
short application queries, not DDL held open across a transaction.
`npm run migrate` prefers `DATABASE_URL_UNPOOLED` when it's set and falls back
to `DATABASE_URL` when it isn't, so a local setup needs only the one variable.

Two things worth knowing:

- **The first request after a quiet spell takes about a second.** Free-tier
  compute scales to zero, and waking it lands on whoever arrives first. The
  pool's connect timeout is set to 15s to leave room for that.
- **If auth fails with `channel_binding=require` in the string, drop that
  parameter.** node-postgres doesn't implement channel binding; TLS is
  unaffected.

## Deploying

```sh
npm run deploy -- --stage prod --region ap-southeast-1
```

Needs AWS credentials, plus `DATABASE_URL` and `JWT_SECRET` in the environment
`serverless.yml` reads from. Before this is more than a personal project, those
two want to come from SSM or Secrets Manager rather than a local `.env`, and
migrations want to run from CI rather than a laptop.
