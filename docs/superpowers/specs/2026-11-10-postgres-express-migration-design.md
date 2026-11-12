# Fang Paep PostgreSQL / Express Migration Design

## Outcome and constraints

Move the existing application into `frontend/` (Next.js) and `backend/` (TypeScript / Express / PostgreSQL). Preserve the current Thai UI and all gameplay and subscription behavior. Use Englup only as a folder-organization reference and Tutio Web as the authentication reference. Work on `refactor/postgres-express`, based on GitHub `main` at `05e5227`. Do not change either reference repository or any live database.

## Proposed repository structure

```text
frontend/
  src/app/                 # existing pages, layouts, styles
  src/components/          # existing UI and providers
  src/hooks/
  src/lib/                 # browser logic, API client, types, tests
  src/data/                # fallback catalog
  package.json             # Next.js commands
backend/
  src/index.ts             # Express startup
  src/router.ts            # API domain registration
  src/config/              # validated environment and pg Pool
  src/middleware/          # authentication, validation, error handling
  src/api/<domain>/        # routes.ts, handler.ts, operation files where useful
  src/services/            # token lifecycle, email, game/database operations
  migrations/              # immutable, ordered SQL files
  scripts/                 # migration runner, seed and preview tools
  package.json             # independent dev/build/test/migrate commands
```

Retain existing naming and formatting inside moved frontend code. Avoid unrelated framework upgrades and UI redesign. Root commands may delegate to the two packages; no monorepo framework is needed.

## API and feature parity

Keep the current `/api` endpoint paths and response contracts from `src/lib/api/types.ts`. Move Next.js API handlers to Express domains for songs, puzzle, guess, leaderboard, stats, guest imports, account, plans, and subscriptions. The frontend API client must handle authentication and retries centrally. Proposed local ports: frontend 3000, backend 4000. Prefer a Next.js rewrite for same-origin `/api` calls; backend URL remains configurable.

Preserve daily puzzles in five categories, unlimited practice, six attempts and progressive audio lengths, Thai date boundaries, server-only daily answers until completion, saved progress, account statistics, guest-progress import, live-only leaderboard eligibility, Plus archive access, ad suppression, and mock checkout/cancel/resume semantics. Real payments remain out of scope.

Authentication middleware and database queries must enforce ownership and Plus access after Supabase session/RLS removal. Parameterize queries and keep per-request identity isolated across pooled connections. Preserve transactional round updates, duplicate-result protection, and atomic subscription changes.

## Authentication matching Tutio

Implement email/password registration with bcrypt password hashes. New users must verify their email through an expiring link before signing in. Support resend verification, JWT access and refresh tokens, session restoration, logout/revocation, forgot/reset password, and authenticated password changes. This is signup email verification, not a recurring two-factor login challenge.

Proposed implementation choices: HTTP-only cookies for token transport through the same-origin API proxy; production Secure cookies, explicit SameSite policy and origin validation for writes; short-lived access tokens and rotating, revocable refresh credentials stored hashed in PostgreSQL. Use distinct validated signing secrets, algorithm and token-purpose checks, and session revocation on password reset. These security details improve on the reference without changing the requested user flows.

Verification/reset secrets must be random, hashed at rest, expiring, and consumed atomically once. Apply rate limits to authentication and recovery routes; do not log passwords or tokens. Email delivery is server-side and configurable. Expose delivery failures honestly and allow resend. Tests use a fake mail transport; no real email is sent during development verification.

## PostgreSQL and migrations

Use raw `pg`, matching the reference architecture. Put the initial schema in `backend/migrations/initial_schema_1.sql`; later changes use unique ascending numeric suffixes, e.g. `add_sessions_2.sql`, following the requested `name_1.sql` convention. The runner orders by numeric suffix and rejects duplicate sequence numbers. Applied files are immutable. A migration ledger records filenames and checksums. Apply pending files in deterministic order, each transactionally, with a database lock to prevent simultaneous runners. Keep seed data separately runnable and repeatable.

Port game schema and business logic from `supabase/migrations/`; replace Supabase-specific `auth.users`, `auth.uid()`, roles, grants, triggers, and SDK/RPC integration with application-owned users and explicit authorization. PostgreSQL functions may be retained when they preserve tested behavior and remain independent of Supabase. Update seed generation and preview refresh to use PostgreSQL and preserve the existing catalogs.

## Existing-data decision

Still unanswered: migrate existing Supabase users, profiles, results, statistics, subscriptions and preview data, or start a fresh PostgreSQL database with the catalog. No source data will be deleted or modified. If transfer is required, preserve UUIDs and relationships, validate counts and constraints, and decide password-hash import versus forced password reset after inspecting an authorized export. Do not assume a public Supabase key can export private records. Live cutover requires database access and a separate, reviewed operational step.

## Delivery and validation

1. Capture the existing unit-test baseline and API/database behavior before moving files. Add regression coverage where current database/auth behavior lacks it.
2. Move the frontend with unchanged behavior and verify its imports, tests and build.
3. Create PostgreSQL migrations, runner, seeds and tests against a disposable local database.
4. Implement and test backend authentication, email lifecycle, ownership and token rotation.
5. Move feature endpoints and connect the frontend/auth pages; replace Supabase maintenance scripts.
6. Remove runtime Supabase dependencies and configuration once equivalent paths pass. Update README, environment examples and AGENTS.md for actual commands and structure.
7. Run frontend and backend tests, typechecks, lint, formatting and builds; smoke-test full account and game flows.

Acceptance requires repeatable fresh-database setup, a no-op second migration run, rollback on migration failure, rejection of changed applied SQL, verification/reset expiry and replay tests, rejected unauthenticated account access, no cross-account data access, no premature answer exposure, concurrent guess protection, and preserved guest/Plus/statistics behavior. Exercise refresh failure/logout, seed reruns, unavailable email, and database errors. Report unavailable PostgreSQL/email/browser checks explicitly; do not claim parity from compilation alone.

## Execution status

Approved by the user on November 11, 2026. Implementation uses a disposable local PostgreSQL database and leaves existing Supabase data untouched. Transferring live accounts and progress remains a separate cutover step requiring an authorized export; no fresh-database operation is run against production.
