# linkup

linkup helps students, career switchers, and working professionals connect their current skills to a career goal through a personalised learning plan.

**Status: Phase 3 skill profiles.** Accounts, protected routes, the skill catalogue, and personal skill profiles are implemented. Learning features follow the order defined in [LinkUp.md](LinkUp.md). The brief uses the working name SkillPath; the application's name is **linkup**.

## Problem and solution

Learners often know the role they want, but need help choosing what to learn, in what order, and how to fit it into their week. linkup will compare existing skills with a target role, produce a roadmap, schedule manageable work, and track progress toward completion.

## Features

Implemented in Phases 1–3:

- Minimal, responsive landing page with accessible navigation and API connection/retry states.
- Separate React frontend and Express REST API in npm workspaces.
- PostgreSQL schema, generated Prisma client, and initial SQL migration.
- Local Docker PostgreSQL and an optional containerised backend.
- Validated environment settings, security headers, strict CORS, rate limiting, structured logging, and consistent API errors.
- Linting, formatting, strict TypeScript, pre-commit checks, test runners, and GitHub Actions CI.
- Email/password registration and login with inline validation, loading/error states, and a protected dashboard shell.
- Bcrypt password hashing (cost 12), 15-minute access JWTs in memory, and seven-day rotating refresh JWTs in httpOnly cookies.
- Hashed refresh-token persistence, replay detection, immediate session revocation on logout, role/ownership middleware, auth rate limits, and request-origin/CSRF protection.
- Session restoration after reload, single-flight refresh/retry, account-cache clearing, and cross-tab logout notifications.
- A searchable 32-skill catalogue with canonical names and aliases, installed by a tracked database migration.
- A protected skill-profile page with Beginner/Intermediate/Advanced levels, add/update/remove actions, removal confirmation, and loading/empty/error/success states.
- Ownership-scoped profile APIs: users can only read and change their own skills; duplicate additions return a conflict.

Planned: goal selection and quiz, gap analysis, roadmaps, weekly plans, progress tracking, mentor chat, certificates, and notifications. **External API integrations require the owner's approval before implementation.** None are configured.

## Stack

| Frontend                                           | Backend and tooling                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| React 18, TypeScript, Vite                         | Node.js 24, Express, TypeScript                                       |
| Tailwind CSS, shadcn-compatible components, Lucide | PostgreSQL 16, Prisma 7 with the PostgreSQL driver adapter            |
| React Router, TanStack Query, Axios                | Zod, Helmet, CORS, express-rate-limit, Pino                           |
| Zustand, React Hook Form, Zod, Sonner              | bcrypt, jsonwebtoken, npm workspaces, Docker, ESLint, Prettier, Husky |
| Vitest and React Testing Library                   | Vitest, Supertest, GitHub Actions                                     |

Maintenance updates relative to the original brief: CI/Docker use supported Node.js 24 instead of the end-of-life Node.js 20. React Router 7 retains the declarative routing approach; Vitest 5 includes dependency security fixes. React remains on version 18 as requested. No paid services are required.

## Architecture

```mermaid
flowchart LR
  Browser[React frontend] -->|REST /api/v1| API[Express backend]
  API --> Prisma[Prisma / pg adapter]
  Prisma --> DB[(PostgreSQL)]
  API -. Later phases .-> Roadmap[Gap analysis / roadmap pipeline]
  API -. Later phases .-> Scheduler[Deterministic weekly scheduler]
  API -. Later phases .-> PDF[Certificate PDF service]
  Roadmap -. Approval required .-> LLM[External or local LLM provider]
```

The frontend does not access the database or hold provider secrets. In development, Vite proxies `/api` to port 4000. Backend feature modules will follow `routes → controller → service → repository`.

```text
frontend/               React app, UI components, HTTP client, frontend tests
backend/src/            Express app, configuration, middleware, backend modules
backend/prisma/         Data model and tracked SQL migrations
backend/tests/          Backend tests
.github/workflows/      CI checks and database migration smoke test
docs/                   Build progress and phase verification notes
```

## Local setup

Prerequisites: **Node.js 24** (or Node.js 22.12+), npm 10+, Git, and **Docker Desktop with Compose** for PostgreSQL. Node 24 is selected in `.nvmrc`.

1. Clone the repository and install the workspace dependencies:

   ```sh
   git clone https://github.com/neethu18reddy/LinkUp.git
   cd LinkUp
   npm install
   ```

2. Prepare local environment files and generate distinct random JWT secrets:

   ```sh
   npm run setup:env
   ```

   This creates ignored `.env` files and fills empty JWT secret fields without printing their values or replacing nonempty secrets. Example database credentials are for local development only. If you change them, update both the root `.env` and `backend/.env`. External-provider fields remain unconfigured.

3. Start PostgreSQL and apply the checked-in migration:

   ```sh
   docker compose up -d postgres
   npm run db:generate
   npm run db:deploy
   ```

4. Start both workspaces:

   ```sh
   npm run dev
   ```

   Frontend: <http://127.0.0.1:5173>. API: <http://localhost:4000/api/v1/health>. Database readiness: <http://localhost:4000/api/v1/health/ready>.

The landing/auth pages and API liveness endpoint also run without PostgreSQL; account and skill operations need the migrated database and return HTTP 503 if unavailable. Visit `/register` to create an account, `/login` to sign in, `/dashboard` for the account overview, and `/skills` to build your skill profile. Database readiness returns HTTP 503 until PostgreSQL is available. Applying `npm run db:deploy` also installs the starter skill catalogue; no separate seed command or external service is needed. Existing Phase 2 checkouts should apply the new migration before using `/skills`.

To create future schema migrations, run `npm run db:migrate -- --name your_change`. Use `npm run db:deploy` to apply existing migrations without resetting data.

### Optional Docker backend

After the normal database setup and migration steps:

```sh
docker compose --profile app up --build -d
npm run dev -w frontend
```

Do not also run the host backend on port 4000. Stop containers with `docker compose --profile app down`; the named PostgreSQL volume persists.

## Development commands

| Command               | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `npm run dev`         | Start API and frontend together                                          |
| `npm run setup:env`   | Create ignored environment files and fill empty JWT secrets              |
| `npm run check`       | Formatting, lint, types, tests, schema validation, and production builds |
| `npm run db:generate` | Generate ignored Prisma client sources before typechecking a fresh clone |
| `npm run db:validate` | Validate the schema without a running database                           |
| `npm run db:deploy`   | Apply tracked database migrations                                        |
| `npm run db:migrate`  | Create a development migration with a running database                   |
| `npm run db:studio`   | Open the local database editor                                           |
| `npm run format`      | Format source files                                                      |
| `npm run build`       | Build both workspaces                                                    |
| `npm start`           | Start the compiled backend                                               |

The pre-commit hook lints and formats staged source files. CI installs from the lockfile, generates Prisma, applies migrations to a temporary PostgreSQL service, runs all checks including real database auth tests, and probes readiness. Tests do not call LLMs or other external APIs. To run database tests locally against a migrated disposable database, set `RUN_DATABASE_TESTS=true` and run `npm test`; they remove only the users they create.

## Environment variables

Real `.env` files are ignored. The complete placeholders are in the root, backend, and frontend `.env.example` files.

| Location / variable                                                        | Purpose                                               | Example                                            |
| -------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| Root: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Local Compose PostgreSQL                              | `linkup`, local-only password, `linkup`, `5432`    |
| Backend: `NODE_ENV`, `PORT`                                                | Runtime mode and API port                             | `development`, `4000`                              |
| Backend: `DATABASE_URL`                                                    | PostgreSQL connection                                 | `postgresql://user:password@localhost:5432/linkup` |
| Backend: `CLIENT_URL`                                                      | Comma-separated exact frontend origin allow-list      | `http://localhost:5173,http://127.0.0.1:5173`      |
| Backend: `LOG_LEVEL`                                                       | Structured log level                                  | `info`                                             |
| Backend: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                         | Distinct signing secrets; at least 32 characters each | Generated locally by `npm run setup:env`           |
| Backend: `LLM_PROVIDER`, `LLM_MODEL`                                       | Reserved provider configuration                       | `disabled`, empty                                  |
| Backend: `GROQ_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_BASE_URL`               | Reserved LLM settings; approval required              | Empty keys; `http://localhost:11434`               |
| Backend: `CRON_SECRET`                                                     | Reserved job endpoint secret                          | Empty                                              |
| Backend: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                        | Optional OAuth; approval required                     | Empty                                              |
| Backend: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`  | Optional email; approval required                     | Empty                                              |
| Frontend: `VITE_API_BASE_URL`                                              | REST API base URL                                     | `/api/v1`                                          |
| Frontend: `VITE_GOOGLE_CLIENT_ID`                                          | Reserved public OAuth client ID                       | Empty                                              |

## API documentation

Current endpoints:

| Method and route             | Result                                          |
| ---------------------------- | ----------------------------------------------- |
| `GET /api/v1/health`         | API liveness; no database required              |
| `GET /api/v1/health/ready`   | Database readiness; HTTP 503 if unavailable     |
| `POST /api/v1/auth/register` | Create an account and session                   |
| `POST /api/v1/auth/login`    | Start a new session                             |
| `POST /api/v1/auth/refresh`  | Rotate the httpOnly refresh cookie              |
| `POST /api/v1/auth/logout`   | Revoke the current session and clear its cookie |
| `GET /api/v1/auth/me`        | Current user; requires a bearer access token    |

Skill endpoints:

| Method and route                    | Result                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/skills?search=ReactJS` | Public catalogue; case-insensitive names/categories and normalized name/alias search; at most 100 results |
| `GET /api/v1/me/skills`             | Signed-in user's skill profile                                                                            |
| `POST /api/v1/me/skills`            | Add `{ skillId, level }`; duplicate returns HTTP 409                                                      |
| `PATCH /api/v1/me/skills/:skillId`  | Change `{ level }` for a skill in the signed-in user's profile                                            |
| `DELETE /api/v1/me/skills/:skillId` | Remove a skill from the signed-in user's profile, preserving the global catalogue                         |

Profile routes require a bearer token. `level` is `BEGINNER`, `INTERMEDIATE`, or `ADVANCED`; IDs are UUIDs from the catalogue. The server derives the owner from the session; supplied `userId` fields are rejected. Missing profile skills return HTTP 404. Search is trimmed, limited to 100 characters, and supports aliases such as ReactJS, node js, and Postgres. The source catalogue is `backend/prisma/data/skills.json`; its migration is an immutable snapshot. Add future catalogue changes through new migrations rather than editing applied migration history.

All JSON responses use `{ success, data, error }`. Errors contain a stable `code` and a safe `message`. Swagger/OpenAPI documentation is planned for Phase 12, alongside the completed endpoints.

Auth POST requests require JSON and `X-Linkup-Request: 1`. Register accepts `{ name, email, password }`; login accepts `{ email, password }`; refresh/logout accept `{}` and use the cookie. Session responses contain `{ user, accessToken, expiresIn }`; refresh tokens are never returned in JSON. Passwords must be at least eight characters at registration and at most 72 UTF-8 bytes (bcrypt's limit). Emails are trimmed and lowercased. Tokens are checked for issuer, audience, algorithm, expiry, and active session ownership.

Refresh cookies are `HttpOnly`, `SameSite=Strict`, scoped to `/api/v1/auth`, and `Secure` in production. Production configuration requires PostgreSQL and distinct signing secrets. Deploy the frontend/API on the same site or through a reverse proxy; cross-site cookie deployment is not configured. Rotation retains the original seven-day expiry. Refresh/logout database transactions use serializable isolation with conflict retries. Reusing a spent refresh token revokes its session family; other signed-in devices remain active. Browser Web Locks serialise cross-tab cookie operations where supported; older browsers without Web Locks can require signing in again if tabs refresh concurrently.

## Deployment and demo

No live deployment is configured yet. Deployment is Phase 12 and requires approval before connecting hosting services or a hosted database. Current preview: run locally using the instructions above.

Screenshots and a 3–5 minute demo video will be added once the core flow is implemented. See the outline in [LinkUp.md](LinkUp.md).

## Build process and limitations

See [docs/BUILD_PROGRESS.md](docs/BUILD_PROGRESS.md) for the phase checklist, file groups, and verification notes. Each completed phase receives a Conventional Commit and a push to GitHub. The owner confirms before the next phase, as required by the brief.

Accounts and skill profiles work with PostgreSQL; goal selection, learning plans, charts, dark mode, and certificates are not implemented yet. The dashboard links to the skill profile. The catalogue is curated; adding arbitrary custom skills and editing the catalogue are not exposed in the UI. Email verification, password reset, and Google OAuth are not implemented; Google and email services require separate approval. Learning-resource ownership checks will be attached as those resource routes are added in subsequent phases.

## AI usage and credits

Codex assisted with the implementation, configuration, tests, and documentation from the owner's project brief. No LLM inference is integrated into the application yet. The app uses the open-source libraries listed in the workspace manifests; the UI component setup follows the shadcn/ui composable pattern and Radix Slot.
