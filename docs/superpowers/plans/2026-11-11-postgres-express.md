# PostgreSQL / Express Implementation Plan

> Use subagent-driven-development for bounded implementation and independent review.

Goal: replace runtime Supabase with Next.js frontend and TypeScript Express/PostgreSQL backend while preserving existing game contracts.
Spec: ../specs/2026-11-10-postgres-express-migration-design.md (approved 2026-11-11).

## Constraints and rulings

- Keep current Next.js version, Thai UI, five categories, six-attempt scoring, and mock subscription behavior.
- New dependencies are authorized by the approved Express/pg/JWT/email design; add only those required for it.
- Ruling: implement against a fresh disposable PostgreSQL database; do not access, delete, or alter existing Supabase data. Live account/data transfer remains an operational follow-up requiring an authorized export.
- User explicitly requested a branch; work in the existing checkout on refactor/postgres-express, based on main 05e5227.
- Keep PostgreSQL business functions where useful, replacing auth.uid() with a transaction-local application user UUID. Explicit middleware validates identity before setting it.

## Interface contracts

- Backend config exports config: { port, databaseUrl, frontendUrl, jwtSecret, jwtRefreshSecret, production }.
- backend/src/config/db.ts exports db (pg Pool) and transaction(fn) using one PoolClient with BEGIN/COMMIT/ROLLBACK.
- backend/src/middleware/error.ts exports AppError(code,message,status) and errorHandler.
- backend/src/middleware/auth.ts exports optionalAuth and requireAuth; Request.user = {id:string,email:string}; cookies are fp_access and fp_refresh, path /api.
- backend/src/api/game/routes.ts exports default Express Router mounted at /api. It owns all existing feature endpoints.
- Auth router is mounted at /api/auth. POST signup {email,password,displayName?}; POST signin {email,password}; POST signout; GET me returns {user:{id,email}|null}; POST refresh; POST verify-email {token}; POST resend-verification {email}; POST forgot-password {email}; POST reset-password {token,password}; PATCH change-password {currentPassword,password}.
- Signup returns {emailSent:true}; signin, verify-email and refresh set HTTP-only cookies and return {user:{id,email}}. Auth errors follow {error:{code,message}}. Tokens never enter browser storage.
- Email verification links point to /auth/callback?token=...; password reset links point to /account/password?token=....
- Frontend auth provider keeps ready,user,account,isPlus,refreshAccount,setAccount,signOut and adds refreshUser. Existing /api feature shapes remain unchanged.

## Tasks and checks

- [x] Baseline: npm ci, npm test, record current lint/type/build gaps before moves.
- [x] Root owner: move Next.js files to frontend; configure npm workspaces, root scripts and lint/format config; preserve untracked AGENTS and .omx; add backend package/tsconfig.
- [x] Database executor: initial_schema_1.sql, game_functions_2.sql, migrations ledger/checksum/lock runner, catalog seeds and preview tooling; PostgreSQL regression tests for answers, ownership, concurrency, stats, Plus and migrations.
- [x] Auth executor: config/db/app/router/error/auth/email/token lifecycle; validation, origin protection, cookies, auth rate limits; tests for verification/reset replay/expiry, refresh rotation, logout, missing config, email failure.
- [x] Frontend executor: remove Supabase API routes/middleware/clients, replace login/forgot/password/callback/provider and central API refresh; add rewrite, preserve game UI and tests.
- [x] Integration owner: install dependencies, disposable PG, run migrations and seed twice, backend integration tests, both builds/typechecks/lint/tests/format; add/update README/env and AGENTS for final structure.
- [x] Independent final review: auth/security and behavior parity; fix findings and re-run affected checks.

Review focus: connection identity leaks; stale cookies and refresh races; verification links consumed twice; concurrent first guesses and checkout; guest imports reaching leaderboard. No push, merge, deployment, live email or production database changes.

## Completion evidence (November 12, 2026)

- Frontend: 35 tests pass; backend: 28 tests pass against disposable PostgreSQL 18.
- Both builds, workspace lint/typechecks, Prettier check, and lockfile dry-run pass.
- Fresh CLI migrations and seeds run twice: 2 migrations, 240 songs, 3650 puzzles, 2 plans.
- Real iTunes preview refresh populated all 240 catalog songs.
- Browser smoke: daily audio control, search/guess, longer clips, guest reload persistence, practice audio, and login form verified.
- Independent authentication/security and game/database reviews approved after fixes.
- Live SMTP delivery, existing Supabase account/data transfer, deployment and framework major upgrade were not performed.
- Production requires the documented trusted edge and explicit proxy CIDRs; Next.js 14 dependency advisories remain.
