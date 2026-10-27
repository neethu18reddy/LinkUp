# linkup

linkup helps students, career switchers and working professionals turn their current skills and career goals into a manageable learning plan.

**Status:** Phases 1–11 are implemented. Phase 12 provides Docker deployment preparation, locally hosted Swagger documentation and opt-in demo data. **No live deployment has been published.** Hosting will be chosen later. External AI, email, OAuth and hosted reminder integrations remain deferred. The original brief uses SkillPath; this application is named **linkup**.

## Problem, users and solution

Learners often know what they want to become but struggle to choose the next skill, sequence their work and fit it into their week. linkup compares a learner's proficiency with role requirements, builds an ordered roadmap, schedules work around available hours and tracks learning and project evidence. It suits students starting a portfolio, professionals filling skill gaps and people exploring a career change.

## Features

- Secure accounts, rotating refresh sessions, owned resources and account-isolated browser caches.
- Searchable skill catalogue, proficiency profiles, 24 career paths, searchable goal cards, custom learning goals and a local interest quiz.
- Weighted gap analysis and curated roadmap templates with practical projects. A Groq adapter is prepared but live calls are disabled.
- Relaxed, Standard, Intensive and Deadline schedules, preview-before-save, replanning and preserved completed work.

- Tasks, private learning logs, project evidence, UTC streaks, progress charts and overdue work summaries.
- Clearly labelled offline mentor with streamed replies, private history, stop/retry and copy.
- Eligibility-gated PDF certificates with QR codes, public verification and LinkedIn share/profile links. Reopened coursework makes a certificate inactive.
- In-app weekly reminders, behind-schedule notices, an owned inbox and reminder preferences. Scheduling is opt-in; email is not connected.
- Accessible loading, empty, error and recovery states, strict server validation, safe errors, tests and CI.

Choose a goal, generate its roadmap, then preview and confirm a weekly plan. Custom goals that match a catalogue skill or role use those requirements. Other custom goals receive a clearly labelled general starter roadmap with exploration, practice and a project; it can be scheduled and tracked without an external API. This is a general structure rather than a subject-specific curriculum.

## Stack

| Frontend                                           | Backend and tooling                                          |
| -------------------------------------------------- | ------------------------------------------------------------ |
| React 18, TypeScript, Vite                         | Node.js 24, Express, TypeScript                              |
| Tailwind CSS, shadcn-compatible components, Lucide | PostgreSQL 16, Prisma 7, PostgreSQL driver adapter           |
| React Router, TanStack Query, Axios, Zustand       | Zod, bcrypt, JWT, Helmet, CORS, rate limiting, Pino          |
| React Hook Form, Zod, Recharts, Sonner             | pdf-lib, Fontsource Noto Sans, qrcode, node-cron, Swagger UI |
| Vitest, React Testing Library                      | Supertest, Docker, ESLint, Prettier, Husky, GitHub Actions   |

## Architecture

```mermaid
flowchart LR
  Browser[React browser app] -->|Same-origin REST and SSE| API[Express API]
  API --> ORM[Prisma / PostgreSQL adapter]
  ORM --> DB[(PostgreSQL)]
  API --> Roadmap[Gap analysis and offline roadmap templates]
  API --> Plan[Deterministic weekly scheduler]
  API --> Mentor[Offline mentor and context builder]
  API --> PDF[Local PDF and QR generation]
  Timer[Opt-in local timer / prepared remote job] --> API
  API -. Approval and credentials required .-> External[Future live AI / email providers]
```

The frontend never holds database or provider secrets. Development uses Vite's API proxy. The prepared Docker image serves the built frontend and API from one origin, retaining the current strict refresh-cookie policy. Feature contracts are documented under [docs](docs/BUILD_PROGRESS.md).

```text
frontend/src/          Pages, components, HTTP clients and UI tests
backend/src/           API modules, docs, jobs, PDF generation and demo seed
backend/prisma/        Schema, catalogue data and tracked migrations
backend/tests/         Unit, API and PostgreSQL integration tests
deploy/                Private deployment environment template
compose.deploy.yml     Prepared PostgreSQL + migrations + app stack
docs/                  Setup, deployment, testing, screenshots and demo notes
```

## Local setup

Install Node.js 24, npm 10+, Git and Docker Desktop with Compose (or provide your own local PostgreSQL 16 database).

```sh
git clone https://github.com/neethu18reddy/LinkUp.git
cd LinkUp
npm ci
npm run setup:env
docker compose up -d postgres
npm run db:generate
npm run db:deploy
npm run dev
```

`setup:env` creates ignored local environment files and fills empty JWT secrets without printing or replacing nonempty secrets. The migrations install skill and role catalogues. No extra catalogue seed is necessary. If using PostgreSQL without Docker, configure the ignored `backend/.env` database URL before applying migrations.

Open [linkup](http://127.0.0.1:5173), [API liveness](http://localhost:4000/api/v1/health), [database readiness](http://localhost:4000/api/v1/health/ready) or [Swagger](http://localhost:4000/api/docs/). Create your account at `/register`. Account and learning features require a migrated database; unavailable persistence returns a safe 503.

### Windows without Docker

An optional portable PostgreSQL 16 runtime supports local development on Windows x64. After `npm ci` and `npm run setup:env`, run:

```sh
npm run db:local:install
npm run db:local:start
npm run db:generate
npm run db:deploy
npm run dev
```

The install command downloads the pinned runtime once into ignored `.local/postgres-runtime`. Startup reads local credentials from `backend/.env`, binds PostgreSQL to loopback and creates the configured database only if absent. It refuses production mode, remote hosts and occupied ports. It does not change system services or existing database installations. Database files and logs remain under ignored `.local/`, excluded from Docker builds and formatting/lint scans.

Stop the API/frontend with Ctrl+C, then run `npm run db:local:stop` for a graceful database shutdown. Restart with `npm run db:local:start` and `npm run dev`; existing records remain intact. Keep database credentials unchanged after initialization. Do not delete `.local/postgres-data` to fix a startup issue: it contains your local accounts and progress. Avoid syncing the active database directory with OneDrive; shut down PostgreSQL before copying/backing up it. Docker remains the prepared deployment path.

For optional sample data, run `npm run setup:demo`, then `npm run db:seed:demo`. The setup command fills an empty `DEMO_SEED_PASSWORD` in ignored `backend/.env` with a private generated password; existing values are preserved. The default email is `demo@linkup.example.invalid`. Read the password locally in that file; never commit or share it. You can also register your own account. See [Demo](docs/DEMO.md).

Common commands:

| Command                                    | Purpose                                                           |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `npm run dev`                              | Start API and frontend                                            |
| `npm run check`                            | Format, lint, types, tests, schema and production builds          |
| `npm run db:deploy`                        | Apply checked-in migrations without resetting data                |
| `npm run db:migrate -- --name change_name` | Create a development migration                                    |
| `npm run db:seed:demo`                     | Opt-in local demo data; credentials required                      |
| `npm run build`                            | Build both workspaces                                             |
| `npm start`                                | Start the compiled API; `SERVE_WEB=true` also serves the frontend |

For a local single-origin preview after building, set `SERVE_WEB=true` and `CLIENT_URL=http://127.0.0.1:4000` in the ignored backend environment and run `npm start`. Open `http://127.0.0.1:4000/login`. The exact preview origin must be allowed for module and API requests. Keep `NODE_ENV=development` for plain local HTTP. Restart after changing environment values. See [testing](docs/TESTING.md) for disposable-database integration tests.

## Environment variables

Examples are in [backend/.env.example](backend/.env.example), [frontend/.env.example](frontend/.env.example), the root [.env.example](.env.example) and [deploy/.env.example](deploy/.env.example). Copy examples to ignored private files. Never place secrets in `VITE_*` variables.

| Variable                                  | Purpose                                                          | Example / default                                              |
| ----------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `NODE_ENV`                                | Runtime mode; production cookies require HTTPS                   | `development` / `production`                                   |
| `PORT`                                    | API listener port                                                | `4000`                                                         |
| `DATABASE_URL`                            | Private PostgreSQL connection string                             | `postgresql://USER:PASSWORD@HOST:5432/linkup`                  |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Distinct private session-signing secrets, at least 32 characters | Generated by local setup; configure separately for deployment  |
| `CLIENT_URL`                              | Exact comma-separated allowed browser origins                    | `http://localhost:5173,http://127.0.0.1:5173`                  |
| `PUBLIC_WEB_URL`                          | Canonical HTTP(S) frontend origin for certificate links          | `https://your-host.example`                                    |
| `SERVE_WEB`                               | Serve `frontend/dist` from Express                               | `false` locally, `true` in prepared runtime image              |
| `TRUST_PROXY_HOPS`                        | Explicit trusted reverse-proxy hop count, 0–5                    | `0`; configure only for the actual network boundary            |
| `LOG_LEVEL`                               | Structured log verbosity                                         | `info`                                                         |
| `LLM_PROVIDER`, `LLM_LIVE_CALLS_APPROVED` | Gate prepared live roadmap integration                           | `disabled`, `false`                                            |
| `LLM_MODEL`, `GROQ_API_KEY`               | Future approved live provider settings                           | Unset; do not add a key yet                                    |
| `LOCAL_JOBS_ENABLED`                      | Opt-in in-app reminder timer while server is awake               | `false`                                                        |
| `CRON_SECRET`                             | Separate secret for prepared remote reminder endpoint            | Unset; at least 32 characters when enabled                     |
| `DEMO_SEED_EMAIL`, `DEMO_SEED_PASSWORD`   | Local/test demo login; no default password                       | `demo@linkup.example.invalid`; privately choose 12+ characters |
| `VITE_API_BASE_URL`                       | Browser API base                                                 | `/api/v1` for development proxy or same-origin deployment      |
| `POSTGRES_PASSWORD`                       | Local/Compose database password                                  | Local example only; generate a new production value            |

OAuth placeholders are reserved for a future approved integration; OAuth and SMTP are not implemented or enabled. Local/example passwords must not be reused in production.

## Deployment

**Live application URL: not published. Live Swagger URL: pending hosting selection.** No host, paid plan or external account has been provisioned.

The [Docker deployment runbook](docs/DEPLOYMENT.md) covers private configuration, migrations, HTTPS, health checks, backups, rollback and smoke checks. The prepared stack uses one web origin, PostgreSQL persistence and a one-shot migration image. Hosting and external integrations remain separate approval steps. Do not expose the plain-HTTP container directly as a production website.

## API documentation

- Local Swagger: [http://localhost:4000/api/docs/](http://localhost:4000/api/docs/)
- OpenAPI JSON: [http://localhost:4000/api/v1/openapi.json](http://localhost:4000/api/v1/openapi.json)
- Contract notes: [roadmaps](docs/ROADMAP_GENERATION.md), [certificates](docs/CERTIFICATES.md), [reminders](docs/NOTIFICATIONS.md), [testing](docs/TESTING.md)

Swagger assets are hosted locally, remote validation is disabled and submit controls are disabled. Request schemas derive from the same Zod input schemas used by the API; operation notes describe cross-field rules, SSE, PDFs, quotas and private/job authentication. JSON results use `{ success, data, error }`, except SSE and PDF responses. Operation-specific data details are also described in the feature documents.

## Demo and screenshots

[Demo setup and 3–5 minute recording script](docs/DEMO.md). No shared password is committed. Demo records are illustrative and local/test only. Rerunning the seed leaves existing demo data and passwords unchanged. No demo video has been recorded or published yet.

![Learning dashboard](docs/screenshots/dashboard.png)
![Offline mentor](docs/screenshots/mentor.png)

Screenshots show disposable local QA accounts; they do not represent live AI output or independent assessment.

## AI usage and credits

Codex assisted with implementation, tests, documentation and local QA. This is distinct from the application's offline mentor: no live AI integration is enabled. Human review is still needed before deployment and enabling providers. Tests use mocked providers or curated local templates.

The implementation follows [LinkUp.md](LinkUp.md), rather than cloning an existing application. It uses the open-source dependencies listed in the package manifests, including React, Express, Prisma, pdf-lib, qrcode and Swagger UI. Noto Sans fonts are distributed under the SIL Open Font License in the Fontsource package. Dependency licenses remain with their respective authors.

## Limitations and future work

- Live deployment, live AI, email, OAuth and hosted reminder scheduling are not enabled.
- The mentor uses offline guidance rules, not a live language model. Custom roadmap goals currently support one catalogue skill.
- Certificates reflect learner-reported completion and evidence, not accreditation or independent project review. PDF script support is documented in [certificates](docs/CERTIFICATES.md).
- Local timers require an awake server; the hosted scheduler exists only as an inactive template. Reminder weeks and streaks use UTC.
- The UI remains intentionally minimal. Dark mode, broader accessibility audits and further visual design are future work.
- Local Docker/PostgreSQL was unavailable during development; GitHub CI verifies PostgreSQL and the prepared Docker image.
- There is no password-reset/email-verification flow or shared public demo account. Choose appropriate operational monitoring, backups and abuse controls before a public launch.

See [build progress](docs/BUILD_PROGRESS.md) for phase commits, created files and validation details.
