# Docker deployment preparation

**Current launch choice:** Vercel Hobby + Neon Free. Follow [Launch](LAUNCH.md) for that platform. The Docker instructions below remain an alternative for a future container host.

The owner chose to select hosting later. These files are prepared and tested locally/through CI; **no public deployment, DNS change, paid resource or external integration has been created**. A live application URL cannot be supplied until hosting and publishing are approved.

## Prepared artifacts

- `backend/Dockerfile`: builds both workspaces; `runtime` serves frontend/API together as non-root `node`. `migrations` contains the Prisma CLI and checked-in migrations. Database secrets are supplied at runtime, never build arguments.
- `compose.deploy.yml`: PostgreSQL 16, persistent named volume, one-shot migration service, then the app. The database has no published port. The app binds to host loopback port 4000 for a future HTTPS reverse proxy.
- `deploy/.env.example`: private production configuration template, copied to ignored `deploy/.env`.
- `/api/docs/` and `/api/v1/openapi.json`: locally served, read-only Swagger documentation and machine-readable input contracts.
- CI builds both image targets, runs the migration image, then checks the runtime frontend, Swagger, database readiness and account registration.

Docker is not installed in the development workspace. The Docker build/runtime checks therefore run on GitHub's Linux runner; local Node production builds and tests run in the workspace. Deployment still needs a chosen host, HTTPS and real operational checks.

## 1. Configure privately, after choosing a host

Copy `deploy/.env.example` to `deploy/.env`. Keep it private; Git and Docker ignore it. Use distinct cryptographically random values for the database password and each JWT secret. Each JWT secret must have at least 32 characters. A hex database password avoids connection-URL escaping problems; otherwise URL-encode it in `DATABASE_URL`.

For the provided Compose stack, the database host is `postgres`, user/database are `linkup`, and the password in the connection string must match `POSTGRES_PASSWORD`. If using managed PostgreSQL later, adapt the stack/configuration and use the provider's verified TLS settings; do not disable certificate validation.

Set both `PUBLIC_WEB_URL` and `CLIENT_URL` to the exact future HTTPS origin, e.g. `https://your-host.example`. Do not leave the placeholder or localhost. Keep `VITE_API_BASE_URL=/api/v1`; the prepared image builds the frontend without local `.env` files. Any custom frontend value requires a new build, and must never contain a secret.

Production `SERVE_WEB=true` fails startup unless the canonical public origin is included in the CORS allowlist. Origin settings reject credentials, paths, queries and fragments; trailing slashes are normalized. This prevents a bundled page from loading while its module/API requests are blocked by a mismatched origin.

Keep `LLM_PROVIDER=disabled`, `LLM_LIVE_CALLS_APPROVED=false`, `LOCAL_JOBS_ENABLED=false`, and `CRON_SECRET` empty while integrations are deferred. Do not add SMTP/OAuth/provider keys during deployment preparation.

## 2. Build and start the stack

On the selected Docker host, from the repository root:

```sh
docker compose --env-file deploy/.env -f compose.deploy.yml build
docker compose --env-file deploy/.env -f compose.deploy.yml up -d
docker compose --env-file deploy/.env -f compose.deploy.yml ps
```

Compose waits for PostgreSQL readiness, runs migrations, and starts the app only if migrations succeed. Inspect migration/app logs if startup fails. Do not use development migration/reset commands against production.

The persistent volume is `linkup-production_production_postgres`. Rebuilding the app does not intentionally delete it. **Never use volume-deletion commands as a deployment/reset shortcut.** Back up the database before schema changes and test restoration separately.

For an existing host, build the new image first, back up data, apply compatible migrations through the migration service, then replace the app. Review schema compatibility before rolling back an application image; Prisma does not automatically undo migrations. Retain the previous image tag and database backup.

## 3. HTTPS and reverse proxy

Publish only after configuring a trusted HTTPS reverse proxy or the hosting platform's TLS termination. Forward requests to `127.0.0.1:4000`. Preserve the Host and client scheme, stream SSE without buffering, and allow a mentor request to run for at least 45 seconds. Do not cache API responses, certificate verification, auth, streaming replies or `index.html`; hashed frontend assets can be cached immutably.

Production refresh cookies are Secure, httpOnly, SameSite=Strict and scoped to `/api/v1/auth`. Plain HTTP is only a local infrastructure smoke check, not a supported public sign-in deployment. Use the same HTTPS origin for browser and API. Splitting unrelated frontend/backend domains would require a separate reviewed cookie/CORS design.

`TRUST_PROXY_HOPS=0` is the safe direct-listener default. Set the exact trusted hop count only when clients cannot bypass that proxy path. Do not blindly trust all forwarded headers. The prepared Compose app is bound to loopback; apply host firewall rules and the chosen platform's network restrictions as well.

## 4. Smoke checks before announcing a live URL

1. `/api/v1/health/ready` returns 200 with database connected.
2. `/login` and a direct `/verify/<code>` deep link return the frontend; `/api/v1/missing` still returns structured JSON 404.
3. Swagger at `/api/docs/` loads its local JavaScript/CSS. It has no external validator or enabled submit controls.
4. In an HTTPS browser, register a personal test account, sign in, reload and confirm session restoration, then sign out and confirm private routes are inaccessible.
5. Run the offline learning flow: skills → goal → roadmap → preview/save plan → evidence/logs/tasks → mentor → certificate → public verification. Confirm a PDF QR contains the chosen public origin. Reopen work and verify INACTIVE.
6. Check logs contain no credentials, verify allowed CORS origins, inspect health/CPU/memory and test backup restoration.

The automated CI smoke uses a disposable database and generated test secrets. It does not replace HTTPS/browser, host security or production backup verification.

## Demo and integration boundaries

`npm run db:seed:demo` is local/test only and refuses `NODE_ENV=production`. No public shared demo account is provisioned. Real evaluators can register their own accounts once a deployment is approved. See [demo setup](DEMO.md).

Email, live AI, OAuth and the hosted reminder workflow remain disabled. The workflow example stays outside `.github/workflows` until approval. Local scheduling can be enabled later on an awake server; sleeping hosts need the separately approved remote scheduler. See [reminders](NOTIFICATIONS.md).

## Status

Prepared Docker/source deployment: ready for review after CI. Hosting, public URL, HTTPS/domain setup, public smoke check, optional integrations and demo video publication: **pending owner decisions**. No deployment claim should be inferred from a green build alone.
