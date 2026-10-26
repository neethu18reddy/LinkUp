# linkup

linkup helps students, career switchers, and working professionals connect their current skills to a career goal through a personalised learning plan.

**Status: Phase 1 foundation.** Accounts and learning features will be added in the order defined in [LinkUp.md](LinkUp.md). The brief uses the working name SkillPath; the application's name is **linkup**.

## Problem and solution

Learners often know the role they want, but need help choosing what to learn, in what order, and how to fit it into their week. linkup will compare existing skills with a target role, produce a roadmap, schedule manageable work, and track progress toward completion.

## Features

Implemented in Phase 1:

- Minimal, responsive landing page with accessible navigation and API connection/retry states.
- Separate React frontend and Express REST API in npm workspaces.
- PostgreSQL schema, generated Prisma client, and initial SQL migration.
- Local Docker PostgreSQL and an optional containerised backend.
- Validated environment settings, security headers, strict CORS, rate limiting, structured logging, and consistent API errors.
- Linting, formatting, strict TypeScript, pre-commit checks, test runners, and GitHub Actions CI.

Planned: local email/password authentication, skill profiles, goal selection and quiz, gap analysis, roadmaps, weekly plans, progress tracking, mentor chat, certificates, and notifications. **External API integrations require the owner's approval before implementation.** None are configured in Phase 1.

## Stack

| Frontend                                           | Backend and tooling                                        |
| -------------------------------------------------- | ---------------------------------------------------------- |
| React 18, TypeScript, Vite                         | Node.js 24, Express, TypeScript                            |
| Tailwind CSS, shadcn-compatible components, Lucide | PostgreSQL 16, Prisma 7 with the PostgreSQL driver adapter |
| React Router, TanStack Query, Axios                | Zod, Helmet, CORS, express-rate-limit, Pino                |
| Zustand and Sonner available for later features    | npm workspaces, Docker Compose, ESLint, Prettier, Husky    |
| Vitest and React Testing Library                   | Vitest, Supertest, GitHub Actions                          |

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

2. Copy the example environment files. In PowerShell:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item backend/.env.example backend/.env
   Copy-Item frontend/.env.example frontend/.env
   ```

   On macOS/Linux, use `cp` instead of `Copy-Item`. Example database credentials are for local development only. If you change them, update both the root `.env` and `backend/.env`. JWT and external-provider fields remain empty until their implementation phase.

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

The landing page and API liveness endpoint also run without Docker or a database configuration; database readiness correctly returns HTTP 503 until PostgreSQL is available.

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
| `npm run check`       | Formatting, lint, types, tests, schema validation, and production builds |
| `npm run db:generate` | Generate ignored Prisma client sources before typechecking a fresh clone |
| `npm run db:validate` | Validate the schema without a running database                           |
| `npm run db:deploy`   | Apply tracked database migrations                                        |
| `npm run db:migrate`  | Create a development migration with a running database                   |
| `npm run db:studio`   | Open the local database editor                                           |
| `npm run format`      | Format source files                                                      |
| `npm run build`       | Build both workspaces                                                    |
| `npm start`           | Start the compiled backend                                               |

The pre-commit hook lints and formats staged source files. CI installs from the lockfile, generates Prisma, runs all checks, applies migrations to a temporary PostgreSQL service, and probes database readiness. Tests do not call LLMs or other external APIs.

## Environment variables

Real `.env` files are ignored. The complete placeholders are in the root, backend, and frontend `.env.example` files.

| Location / variable                                                        | Purpose                                          | Example                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| Root: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Local Compose PostgreSQL                         | `linkup`, local-only password, `linkup`, `5432`    |
| Backend: `NODE_ENV`, `PORT`                                                | Runtime mode and API port                        | `development`, `4000`                              |
| Backend: `DATABASE_URL`                                                    | PostgreSQL connection                            | `postgresql://user:password@localhost:5432/linkup` |
| Backend: `CLIENT_URL`                                                      | Comma-separated exact frontend origin allow-list | `http://localhost:5173,http://127.0.0.1:5173`      |
| Backend: `LOG_LEVEL`                                                       | Structured log level                             | `info`                                             |
| Backend: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                         | Reserved for Phase 2 auth                        | Leave empty in Phase 1                             |
| Backend: `LLM_PROVIDER`, `LLM_MODEL`                                       | Reserved provider configuration                  | `disabled`, empty                                  |
| Backend: `GROQ_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_BASE_URL`               | Reserved LLM settings; approval required         | Empty keys; `http://localhost:11434`               |
| Backend: `CRON_SECRET`                                                     | Reserved job endpoint secret                     | Empty                                              |
| Backend: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                        | Optional OAuth; approval required                | Empty                                              |
| Backend: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`  | Optional email; approval required                | Empty                                              |
| Frontend: `VITE_API_BASE_URL`                                              | REST API base URL                                | `/api/v1`                                          |
| Frontend: `VITE_GOOGLE_CLIENT_ID`                                          | Reserved public OAuth client ID                  | Empty                                              |

## API documentation

Current endpoints:

| Method and route           | Result                                      |
| -------------------------- | ------------------------------------------- |
| `GET /api/v1/health`       | API liveness; no database required          |
| `GET /api/v1/health/ready` | Database readiness; HTTP 503 if unavailable |

All JSON responses use `{ success, data, error }`. Errors contain a stable `code` and a safe `message`. Swagger/OpenAPI documentation is planned for Phase 12, alongside the completed endpoints.

## Deployment and demo

No live deployment is configured yet. Deployment is Phase 12 and requires approval before connecting hosting services or a hosted database. Current preview: run locally using the instructions above.

Screenshots and a 3–5 minute demo video will be added once the core flow is implemented. See the outline in [LinkUp.md](LinkUp.md).

## Build process and limitations

See [docs/BUILD_PROGRESS.md](docs/BUILD_PROGRESS.md) for the phase checklist, file groups, and verification notes. Each completed phase receives a Conventional Commit and a push to GitHub. The owner confirms before the next phase, as required by the brief.

Phase 1 is a foundation, not a working learning platform. Authentication, per-user authorization, data entry, AI features, charts, dark mode, and certificates are not implemented yet. The schema supports those later phases but is not a promise of available features.

## AI usage and credits

Codex assisted with the implementation, configuration, tests, and documentation from the owner's project brief. No LLM inference is integrated into the application yet. The app uses the open-source libraries listed in the workspace manifests; the UI component setup follows the shadcn/ui composable pattern and Radix Slot.
