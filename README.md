# Fang Paep — ฟังแป๊บ

Thai song guessing game: listen to progressively longer clips (0.5, 1, 2, 4, 8, 16 seconds), with six attempts per round.

## Structure

- `frontend/`: Next.js 15 App Router, React, TypeScript, CSS Modules, browser game logic and unit tests.
- `backend/`: TypeScript Express API, PostgreSQL queries/functions, JWT authentication, email and database tools.
- `backend/migrations/`: ordered, immutable SQL migrations (`initial_schema_1.sql`, `game_functions_2.sql`).
- `backend/migrations/seeds/`: repeatable catalog and daily-puzzle seed SQL.

The browser calls same-origin `/api/*`; Next.js proxies those calls to Express. Database credentials and signing secrets stay in the backend. Supabase is no longer required by the application.

## Local setup

Use Node.js 20 or later (`.nvmrc`) and PostgreSQL. From the repository root:

```sh
npm ci
```

Copy `backend/.env.example` to `backend/.env`. Set `DATABASE_URL` to a dedicated application database and set two different random JWT secrets of at least 32 characters. Generate each secret locally with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`; never commit the output. Configure `RESEND_API_KEY` and a verified `MAIL_FROM` sender, or SMTP, for verification and password-reset email.

```sh
npm run migrate
npm run seed
npm run refresh-previews --workspace backend
npm run dev:backend
```

In another terminal:

```sh
npm run dev
```

Open `http://localhost:3000`. Express defaults to port 4000. To override the backend proxy, copy `frontend/.env.example` to `frontend/.env.local` and set `API_INTERNAL_URL` (without `/api`). Set backend `FRONTEND_URL` to the browser origin. These origins must match for authenticated writes.

Verification and password reset require working mail delivery. An unavailable mail provider returns an error; the app does not silently pretend to send email. Verification resends are supported. Tests inject a fake transport and never send real email.

## Commands

| Root command            | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `npm run dev`           | Next.js development server                    |
| `npm run dev:backend`   | Express development server with reload        |
| `npm run build`         | Build both packages                           |
| `npm start`             | Serve the built frontend                      |
| `npm run start:backend` | Serve the compiled backend                    |
| `npm test`              | Run both packages' unit and integration tests |
| `npm run typecheck`     | TypeScript checks in both packages            |
| `npm run lint`          | ESLint checks in both packages                |
| `npm run format:check`  | Check Prettier formatting                     |
| `npm run migrate`       | Apply pending SQL migrations                  |
| `npm run seed`          | Load catalog and daily puzzles                |

Each package also supports its own commands, e.g. `npm test --workspace backend` and `npm run test:watch --workspace frontend`. Start both production processes; the Next.js build alone does not start Express.

## Authentication

Register with email and password, verify the emailed link, then sign in. JWT access credentials are short-lived; refresh credentials rotate and can be revoked. Both travel in HTTP-only cookies through the API proxy. Password recovery uses expiring, one-use links. Password changes require the current password and revoke existing sessions. Verification/reset tokens and refresh credentials are hashed in PostgreSQL.

Set `NODE_ENV=production` behind HTTPS so auth cookies are Secure. Keep PostgreSQL accessible only to the backend; the backend database role must have the privileges needed by the supplied migrations/functions. Preserve certificate verification when configuring PostgreSQL TLS. Authentication writes are rate limited. Cookie-authenticated writes require the configured browser Origin (or matching Referer); foreign or missing origins are rejected.

Production startup also requires `TRUST_PROXY_CIDRS`, a comma-separated list of explicit proxy IPs/CIDRs, e.g. `127.0.0.1/32,::1/128` when the last proxy is local. Put Next.js and Express privately behind a trusted edge that **overwrites** `X-Forwarded-For` with the socket client IP. Next.js 14 preserves incoming forwarded headers and is not that sanitizing edge. Trust only actual proxy addresses; do not expose either service directly while trusting forwarded headers. Trust-all ranges and implicit hop counts are unsupported. Development defaults to no proxy trust, so local proxy traffic shares an IP rate bucket.

## Database changes and catalog maintenance

Add a new SQL file with a unique ascending numeric suffix, e.g. `add_feature_3.sql`. Do not edit or remove applied files. The runner uses a checksum ledger, orders by numeric suffix, locks migration execution, and rolls back a failed migration. Seeds are separate and can be rerun without replacing existing puzzles.

Catalog JSON remains in `frontend/src/data/`. After editing it, run `npm run generate-seed --workspace backend -- 730`, then `npm run seed`. Run `npm run refresh-previews --workspace backend` to populate or refresh daily audio URLs from iTunes; a fresh seed contains no preview URLs, and daily audio requires this step. The preview tool requires PostgreSQL credentials, not browser keys. Audio is streamed from Apple's preview URLs, with full-song links shown after a round.

## Feature and data boundaries

Daily games use Bangkok dates, with game #1 on October 1, 2026. Practice is unlimited. Daily answers stay on the server until a round finishes. Accounts retain progress, statistics and guest-game imports; imported games do not enter live leaderboards. Plus keeps archive access, ad suppression and subscription controls.

**Checkout is a mock:** it charges no money. The database's `payments_mode = 'mock'` setting enables it. Real payment processing is not part of this migration.

Existing Supabase data is not automatically transferred or deleted. Live cutover requires an authorized export, preserved user IDs/relationships, validated row counts, and a password-hash compatibility or password-reset strategy. Do not reset a production database to install this version.

## Verification

Run tests, lint, typecheck, formatting and both builds before submitting changes. PostgreSQL integration tests require `TEST_DATABASE_URL` pointing to a disposable test database; they may reset their test schema. Never supply a live database URL. See backend test files for the accepted test-database naming guard. With no test database configured, integration suites are reported as skipped.

Railway deployment configuration and commands are documented in [docs/deployment/railway.md](docs/deployment/railway.md). The public deployment upgrades the frontend to Next.js 15 / React 19 and pins patched PostCSS; review dependency advisories before future releases.

## Automatic Railway releases

Both Railway application services track `PuviwatS/fang-paep` on `main`. Automatic rebuilds for both frontend and backend are pending the repository owner granting Railway GitHub access and verification of both push triggers. Keep the shared npm lockfile committed; service-specific build commands select the correct workspace. See [deployment settings](docs/deployment/railway.md).
