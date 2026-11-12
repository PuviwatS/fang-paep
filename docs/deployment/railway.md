# Railway deployment

Project: [fang-paep](https://railway.com/project/2d0f3189-89f1-41aa-80b6-a401d76cdbe5), production environment.

- Frontend: `frontend`, https://frontend-production-08b17087.up.railway.app
- API: `backend`, reached through the frontend's same-origin `/api` proxy and Railway private DNS.
- Database: `Postgres`, PostgreSQL 18 with persistent volume storage.

All services use Railway Serverless (sleep-on-idle), configured through `serviceInstanceUpdate.sleepApplication` and applied by a fresh deployment. This setting is maintained in Railway, not `railway.json`. Cold starts can delay the first request. Next.js telemetry is disabled; PostgreSQL pool connections close when idle. Persistent storage remains allocated while services sleep.

Both code services build from this repository root as npm workspaces. Frontend build: `npm run build --workspace frontend`; start: `npm start --workspace frontend -- --hostname ::`. Backend build: `npm run build --workspace backend`; start: `npm run start:backend`. Railway supplies `PORT=8080`.

The backend pre-deploy command, from the repository root, is:

```sh
cd backend && node dist/scripts/migrate.js && node dist/scripts/seed.js && node dist/scripts/refresh-previews.js
```

Health checks are `/` for the frontend and `/api/plans` for the backend. Variables are stored in Railway, not the repository. `DATABASE_URL` references `Postgres.DATABASE_URL`; `API_INTERNAL_URL` references `backend.RAILWAY_PRIVATE_DOMAIN`. JWT secrets are independently generated. Resend credentials and the verified sender were copied from Tutio with the owner's authorization. `RESEND_API_KEY` plus `MAIL_FROM` select Resend; SMTP remains an alternative.

Only services in this project environment belong to the private trust boundary. Railway's public edge sanitizes forwarding headers before Next.js forwards requests privately to Express. Keep backend access private and configure only the known internal proxy networks in `TRUST_PROXY_CIDRS`; do not add unrelated services to this environment or forward unsanitized headers from another ingress.

Both application services are connected to `PuviwatS/fang-paep`, branch `main`, with GitHub autodeploy enabled. Every push to `main` rebuilds both services from the repository root, using their separate workspace build/start commands. No path-based watch filters are applied. PostgreSQL remains a persistent database service and is not rebuilt from the repository.

Normal releases use `git push origin main` after changes are reviewed and verified. Check both Railway deployment statuses afterward; the backend runs migrations, idempotent seeds and preview refresh before becoming healthy. Keep the root directory as `/` so the shared npm lockfile and both workspace manifests remain available. `railway up --service backend --detach` and `railway up --service frontend --detach` remain manual recovery options.

The public deployment uses Next.js 15 / React 19 and a patched PostCSS override. Regenerate and verify the root lockfile whenever framework versions change, keeping a single shared React installation.

## Verified deployment

On November 12, 2026, frontend, backend and PostgreSQL deployments were all SUCCESS with `sleepApplication: true` in each deployed service manifest. The backend public domain was removed after the private API path passed. The public website, login screen, catalog (240 songs), plans (2), daily puzzle/audio URL and unauthenticated account rejection were verified. Live browser audio playback and guest skip progression passed.

The final production dependency audit reports zero vulnerabilities. Resend request construction and failure handling have mocked tests; no live verification or recovery email was sent during deployment. Existing Supabase account/progress data remains untouched and was not imported into the fresh Railway database.
