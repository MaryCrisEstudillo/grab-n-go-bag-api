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
| `npm run email:test -- you@gmail.com` | Send one real reminder, to check the mail setup |
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
| `POST` | `/auth/users` | Register → `201 { token, user }`, with a bag already seeded |
| `GET` | `/auth/users/me` | The user behind the token |

### Notifications

| | | |
| --- | --- | --- |
| `POST` | `/notifications/unsubscribe?token=…` | Stop the expiry reminders. The token is the authorisation — no session needed. |

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

### Expiry reminders

A scheduled job runs daily at 00:00 UTC — 08:00 in Manila, so a reminder about
food worth checking arrives over breakfast rather than overnight. It mails each
user one digest of everything expired or within ten days of expiring. Ten days
is the same threshold the app calls "expiring", so the inbox matches the badge.

**It won't nag.** Each send records a fingerprint of the items it listed and
which bucket each fell into. The next run compares before sending, so a bag
nobody has touched produces one email, not one every morning until the tin of
sardines is finally thrown out. The fingerprint deliberately ignores the day
count — otherwise the countdown alone would change it daily and defeat the
whole thing. Something has to appear, disappear, or cross from "expiring" into
"expired" before another email is worth sending.

Every message carries an unsubscribe link, as a `List-Unsubscribe` header as
well as in the body — Gmail surfaces the header as a one-click control and
counts its absence against bulk senders. That link is a separate long-lived
token carrying `purpose: 'unsubscribe'`; session verification rejects anything
with a purpose, and the unsubscribe route rejects anything without one, so a
link sitting in an inbox for a year can never become a login. The route is a
`POST` because scanners and link previewers follow `GET`s, and turning someone's
reminders off because their mail provider prefetched a link would be its own
kind of bug.

#### Setting up sending

Mail goes out through Gmail's own SMTP server. That needs **no domain**: it
leaves from a real Gmail address, so SPF and DKIM pass on their own and it
reaches other Gmail inboxes instead of their spam folders. The cap is about 500
messages a day, far beyond what this sends.

**`GMAIL_USER` and `GMAIL_APP_PASSWORD` are optional.** Without them the job
still runs, logs how many people it would have mailed, and sends nothing — so
nothing here blocks on mail being set up.

To turn it on:

1. **Use a throwaway Gmail account**, not your main one. An app password
   bypasses 2FA for mail, so it shouldn't sit on an account holding anything
   that matters.
2. Turn on **2-Step Verification** — Google Account → Security. App passwords
   don't exist without it.
3. Go to **[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)**,
   create one named anything, and copy the 16 characters.
4. Put both in `.env`:

   ```sh
   GMAIL_USER=yourapp@gmail.com
   GMAIL_APP_PASSWORD=abcdefghijklmnop
   ```

5. Prove it works before trusting the scheduled job:

   ```sh
   npm run email:test -- you@gmail.com
   ```

   That authenticates, sends one real reminder with made-up items, and names
   the likely cause if it fails.

Only the display name is ours to choose — Gmail sends as the account you
authenticated with, so `EMAIL_FROM_NAME` controls what recipients see beside
the address and nothing else.

One deployment constraint this creates: **the Lambdas must stay outside a
VPC**, or outbound SMTP has nowhere to go without a NAT gateway. They already
are, since Neon is reached over the public internet too.

Moving to a custom domain later means rewriting `send` in `src/lib/email.ts`
and nothing else.

### Registration seeds a bag

A new account arrives with eight categories and nineteen items already in it,
written in the same transaction as the user.

Two reasons. An empty first screen is a poor introduction, and — more
practically — the reminder can only demonstrate itself if there is something
there to expire. The seed always includes items three, six and nine days out,
plus two already past, so the first digest lands the next morning without the
person having to do anything.

Seed dates are offsets resolved at registration rather than fixed dates, so the
bag never drifts into "everything expired" and make the app look broken to
whoever signs up next year.

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

## Deploying to Render

Render runs the API as an ordinary Node server, deploys straight from this
repo, and needs no credit card. `render.yaml` describes the service, so Render
reads it rather than you filling in a form.

The same seventeen handlers serve both targets. `src/lib/router.ts` translates
an incoming Node request into the event shape they already expect and their
result back into a response, so nothing in `handlers/`, `services/` or
`repositories/` knows or cares which it is running under. One route table in
`src/server.ts` means an endpoint can't exist in one target and quietly not in
the other.

1. **Create the service.** At [render.com](https://render.com), sign in with
   GitHub → New → Blueprint → pick `grab-n-go-bag-api`. It finds
   `render.yaml` on its own.

2. **Set the environment variables** it asks for — the ones marked
   `sync: false` are deliberately not in the file, because this repo is public:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | your Neon **pooled** string |
   | `JWT_SECRET` | the one from `.env` |
   | `GMAIL_USER` / `GMAIL_APP_PASSWORD` | as in `.env` |
   | `CORS_ORIGIN` | your GitHub Pages URL, **no trailing slash** |
   | `APP_URL` | the same URL — it's the link inside the emails |
   | `CRON_SECRET` | any long random string |

3. **Note the service URL** Render gives you, something like
   `https://grabngo-bag-api.onrender.com`. That's what the frontend needs.

**The free instance sleeps after ~15 minutes idle** and takes a few seconds to
wake. Neon's free compute does the same, so the first visit after a quiet spell
is slow and everything after it is not. `/health` answers without touching the
database, so a warm-up ping is cheap.

### The daily reminder on Render

Free instances get no scheduler, so the job is also an endpoint:
`POST /internal/run-digest`, guarded by `CRON_SECRET`. Without the right secret
it answers `404` rather than `401` — an attacker shouldn't learn it exists, and
anyone who could call it freely could mail every user repeatedly and burn the
daily sending quota.

Point a free scheduler at it — [cron-job.org](https://cron-job.org) needs no
card:

```
URL     https://your-api.onrender.com/internal/run-digest
Method  POST
Header  x-cron-secret: <your CRON_SECRET>
When    daily, 08:00 Asia/Manila
```

On Lambda this is EventBridge instead, and `serverless.yml` already declares
it. Both call the same code.

## Deploying to AWS instead

```sh
npm run deploy -- --stage prod --region ap-southeast-1
```

Needs AWS credentials, plus `DATABASE_URL` and `JWT_SECRET` in the environment
`serverless.yml` reads from. `useDotenv: true` means a deploy from a laptop
reads `.env` and bakes those values into the function configuration — they
travel to AWS at deploy time without ever entering Git. Deploying from CI
instead means putting them in the CI environment.

Before this is more than a personal project, those two want to come from SSM or
Secrets Manager rather than a local `.env`, and migrations want to run from CI
rather than a laptop.

**Set `CORS_ORIGIN` and `APP_URL` to the real frontend URL before deploying.**
Left at `localhost`, the API works perfectly in curl and is blocked by every
browser, and the reminder emails link somewhere only you can open.

### Keeping the bill at zero

Free tier covers this comfortably, but the two halves expire differently:
Lambda's 1M requests and 400,000 GB-seconds per month are perpetual, while API
Gateway's 1M requests run out after twelve months and cost about $1 per million
after that. Verify current pricing rather than trusting this paragraph.

**AWS has no switch that stops spending.** Budgets alert; they do not halt. So
the ceiling is built from parts, all of them free. Three are in `serverless.yml`
already:

| Guardrail | What it bounds |
| --- | --- |
| `logRetentionInDays: 14` | CloudWatch storage, which otherwise grows forever |
| Stage throttling, 10/s | Requests, before Lambda is invoked at all |
| `reservedConcurrency: 1` on the digest | Overlapping runs mailing people twice |

Throttling is deliberately the crude kind: it caps the rate across every route,
not per caller. Something subtler needs usage plans and API keys, which a public
frontend can't hold secretly anyway.

Two more are account settings rather than code:

- **A zero-spend budget.** Billing → Budgets → the *Zero spend* template. It
  emails you the moment anything exceeds free tier. Free for the first two.
- **A kill switch, optionally.** A billing alarm publishing to SNS, triggering a
  function that sets `reservedConcurrency: 0` on every function in the stack.
  Zero concurrency means invocations stop dead. It is the only true hard stop
  available, and it costs nothing.

**What none of this bounds** is a sustained attack: 10 requests a second is
still 26 million a month if someone keeps it up. The budget alert is what
catches that, which is why it is worth setting up rather than skipping.

The reassuring part is structural. Runaway AWS bills come from functions that
trigger themselves — a write that fires a function that writes again. Nothing
here has that shape: invocations come from an HTTP request or from the daily
schedule, and both terminate.
