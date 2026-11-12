# Repository Guidelines

## Project Structure & Module Organization

Fang Paep is a Thai song guessing game with a Next.js frontend and a TypeScript Express/PostgreSQL backend.

- `frontend/src/app/`: App Router pages, layouts, and global styles.
- `frontend/src/components/` and `frontend/src/hooks/`: UI, providers, audio, and round state.
- `frontend/src/lib/` and `frontend/src/data/`: browser utilities, API client, tests, and fallback catalogs.
- `backend/src/api/`: authentication and game API routes.
- `backend/src/config/`, `middleware/`, and `services/`: database access, validation, authentication, email, and game transactions.
- `backend/migrations/`: immutable SQL migrations; `backend/scripts/`: migration, seed, and catalog tools.

## Build, Test, and Development Commands

Use Node.js 20 or later and PostgreSQL. Run commands from the root:

- `npm ci`: install both workspace packages.
- `npm run dev`: start Next.js on port 3000.
- `npm run dev:backend`: start Express on port 4000.
- `npm run migrate` / `npm run seed`: apply schema changes / load catalog data.
- `npm run build`: build both packages.
- `npm test`: run both packages' Vitest suites.
- `npm run typecheck` / `npm run lint`: check TypeScript / ESLint.
- `npm run format:check`: check Prettier; `npm run format` applies formatting.

## Coding Style & Naming Conventions

Use two-space indentation, double quotes, semicolons, trailing commas, and a 110-character print width. Keep PascalCase components, `useSomething.ts` hooks, and matching CSS Modules. Frontend `@/` imports resolve to `frontend/src/`. Avoid imports between package source directories.

## Testing Guidelines

Colocate `*.test.ts` with the behavior tested. Preserve tests for scoring, Bangkok date boundaries, storage compatibility, and safe redirects. Backend PostgreSQL integration suites require `TEST_DATABASE_URL` targeting a disposable test database; never supply production credentials. Cover token replay/expiry, ownership, answer secrecy, concurrent guesses, migrations, and subscription changes. No coverage threshold is configured.

## Commit & Pull Request Guidelines

Use concise descriptive English subjects, following existing “Fix…” and “Refactor…” commits. Include behavior changes, related issues, validation results, and screenshots for UI changes. Explain migrations and environment changes.

## Security & Configuration

Keep secrets in `backend/.env`; proxy overrides belong in `frontend/.env.local`. Never expose database or signing secrets to browser code. Preserve HTTP-only cookies, origin checks, parameterized queries, transactional identity, and server-side answer validation. Add migrations using unique numeric suffixes such as `add_feature_3.sql`; never modify applied files. Checkout remains a mock and charges no money.
