# linkup build progress

Source of scope: [LinkUp.md](../LinkUp.md). Product name: **linkup**. Keep the UI minimal. Ask the owner before any external API integration. Commit and push after every completed phase, then wait for confirmation before starting the next phase.

| Phase | Scope                                                   | Status                                          |
| ----- | ------------------------------------------------------- | ----------------------------------------------- |
| 1     | Monorepo, tooling, Docker PostgreSQL, Prisma schema, CI | Implemented; local checks passed                |
| 2     | Auth and protected routes                               | Implemented; local checks passed                |
| 3     | Skill catalogue and profiles                            | Implemented; local checks passed                |
| 4     | Goals, interest quiz, recommendations                   | Implemented; local checks passed                |
| 5     | Gap analysis and validated roadmap pipeline             | Implemented; Groq prepared, live calls disabled |
| 6     | Roadmap UI, scheduler, flexibility, replanning          | Implemented; offline scheduling                 |
| 7     | Progress, logs, projects, streaks, charts               | Implemented; local checks passed                |
| 8     | Mentor context and streaming                            | Implemented offline and approved Groq adapter   |
| 9     | Certificates, PDFs, public verification                 | Implemented; local and PostgreSQL checks passed |
| 10    | Reminders and notifications                             | In-app, scheduled and email code implemented    |
| 11    | Service/API tests and error-state polish                | Implemented; regression suite maintained        |
| 12    | Deployment, README completion, Swagger, seed demo       | Prepared; Vercel/Neon owner connection required |

## Phase 1 file groups

- Root workspace: `package.json`, `package-lock.json`, shared TypeScript/ESLint/Prettier configuration, EditorConfig, Git ignores and line-ending settings, `.nvmrc`, Husky hook.
- Frontend: Vite and TypeScript configuration, React application and routes, landing page and CSS, reusable button, HTTP client, favicon, shadcn component configuration, environment example, test setup and connection-state tests.
- Backend: Express app and server, validated environment settings, logger and database client, error/validation middleware, response utilities, package/TypeScript/test configuration, environment example, foundation API tests.
- Database: Prisma schema, Prisma CLI configuration, generated initial SQL migration, migration lock file. Generated client source stays ignored.
- Operations: root Docker environment example, `docker-compose.yml`, `.dockerignore`, backend multi-stage `Dockerfile`, GitHub Actions CI.
- Documentation: `README.md`, this phase log, the original unchanged `LinkUp.md` brief.

## Phase 1 verification

Passed: formatting, ESLint, strict TypeScript in both workspaces, all 11 tests (3 frontend and 8 backend), Prisma schema validation, client generation, and both production builds. npm reports zero known dependency vulnerabilities. The live frontend and proxied health endpoint return HTTP 200, and the unconfigured database readiness endpoint correctly returns HTTP 503. The landing page was visually checked in the in-app browser. Docker Desktop is absent on the build machine; local container startup and live PostgreSQL migration checks cannot run here. CI is configured to apply the migration and probe database readiness against its own PostgreSQL service.

No external LLM, OAuth, email, hosted database, or hosting service has been connected. Only the application's own local REST endpoint is used by the frontend.

## Files created in Phase 1

The original LinkUp.md is preserved unchanged and included in the initial commit.

```text
.dockerignore
.editorconfig
.env.example
.gitattributes
.github/workflows/ci.yml
.gitignore
.husky/pre-commit
.nvmrc
.prettierignore
.prettierrc.json
README.md
backend/.env.example
backend/Dockerfile
backend/package.json
backend/prisma.config.ts
backend/prisma/migrations/20261027000100_init/migration.sql
backend/prisma/migrations/migration_lock.toml
backend/prisma/schema.prisma
backend/src/app.ts
backend/src/config/database.ts
backend/src/config/env.ts
backend/src/config/logger.ts
backend/src/middleware/errorHandler.ts
backend/src/middleware/validate.ts
backend/src/modules/README.md
backend/src/server.ts
backend/src/utils/AppError.ts
backend/src/utils/response.ts
backend/tests/app.test.ts
backend/tsconfig.build.json
backend/tsconfig.json
backend/vitest.config.ts
docker-compose.yml
docs/BUILD_PROGRESS.md
eslint.config.js
frontend/.env.example
frontend/components.json
frontend/index.html
frontend/package.json
frontend/public/favicon.svg
frontend/src/App.tsx
frontend/src/components/ui/button.tsx
frontend/src/index.css
frontend/src/lib/api.ts
frontend/src/lib/utils.ts
frontend/src/main.tsx
frontend/src/pages/LandingPage.test.tsx
frontend/src/pages/LandingPage.tsx
frontend/src/test/setup.ts
frontend/tsconfig.json
frontend/vite.config.ts
package-lock.json
package.json
tsconfig.base.json
```

## Phase 2: authentication

Implemented register/login/refresh/logout and protected /auth/me; bcrypt cost 12; in-memory access JWTs; hashed refresh-token rotation, replay detection and logout revocation; strict cookie/origin/request-header safeguards; role/ownership middleware; minimal auth pages and a protected dashboard shell. Added local environment setup with ignored random secrets. No external service integrations were added.

Local verification: formatting, lint, strict TypeScript, schema validation, and both production builds pass. All 36 local tests pass (16 frontend and 20 backend). Three PostgreSQL integration tests cover persisted auth, concurrent rotation/replay, and logout/refresh races; CI runs these after applying the migration. Browser QA checks inline registration validation and anonymous dashboard redirection. Docker/PostgreSQL remain unavailable locally. Phase 1 CI is confirmed successful, including its migration/readiness checks.

Phase 2 created files:

```text
backend/src/middleware/requireAuth.ts
backend/src/modules/auth/auth.controller.ts
backend/src/modules/auth/auth.repository.ts
backend/src/modules/auth/auth.routes.ts
backend/src/modules/auth/auth.schemas.ts
backend/src/modules/auth/auth.service.ts
backend/src/modules/auth/auth.tokens.ts
backend/src/modules/auth/auth.types.ts
backend/tests/auth.database.test.ts
backend/tests/auth.test.ts
backend/tests/helpers/memory-auth-repository.ts
frontend/src/features/auth/SessionBoundary.tsx
frontend/src/features/auth/auth.client.test.ts
frontend/src/features/auth/auth.client.ts
frontend/src/features/auth/auth.schemas.ts
frontend/src/lib/http.ts
frontend/src/pages/AuthPage.test.tsx
frontend/src/pages/AuthPage.tsx
frontend/src/pages/DashboardPage.tsx
frontend/src/routes/ProtectedRoute.tsx
frontend/src/store/auth.ts
scripts/setup-env.mjs
```

## Phase 3: catalogue and skill profiles

Implemented a 32-skill catalogue and data migration; canonical/alias/category search; authenticated profile CRUD using composite owner/skill keys; duplicate, validation and missing-resource errors; a minimal /skills screen with debounced search, proficiency selection, confirmation before removal, and all request states. Added shared account navigation and a dashboard link to the profile. Fixed cache clearing to happen before the new account mounts queries, with a regression test. No external APIs or dependencies were added.

Verification: formatting, lint, strict TypeScript, schema validation and both builds pass. All 51 local tests pass (25 frontend, 26 backend). Six PostgreSQL tests run in CI, including three new tests for catalogue migration/search, profile persistence/ownership and concurrent duplicates. Browser QA used a disposable in-memory backend to verify login return, add, update, reload, removal confirmation and empty states; production defaults continue to use Prisma/PostgreSQL. Phase 2 CI passed all 39 tests including PostgreSQL.

Phase 3 created files:

```text
backend/prisma/data/skills.json
backend/prisma/migrations/20261027000300_skill_catalogue/migration.sql
backend/src/modules/skills/skills.controller.ts
backend/src/modules/skills/skills.repository.ts
backend/src/modules/skills/skills.routes.ts
backend/src/modules/skills/skills.schemas.ts
backend/src/modules/skills/skills.service.ts
backend/src/modules/skills/skills.types.ts
backend/src/utils/asyncHandler.ts
backend/tests/helpers/memory-skills-repository.ts
backend/tests/skills.database.test.ts
backend/tests/skills.test.ts
frontend/src/components/layout/AccountLayout.tsx
frontend/src/features/auth/SessionBoundary.test.tsx
frontend/src/features/skills/skills.api.ts
frontend/src/pages/SkillsPage.test.tsx
frontend/src/pages/SkillsPage.tsx
```

## Phase 4: goals and interest quiz

Implemented six role templates and 33 required-skill mappings in a migration, direct role/custom learning goals, a skippable seven-question quiz, three locally scored suggestions with reasons, saved private quiz results, retakes and explicit confirmation. Goal replacement preserves history, guards stale changes, and uses a SQL partial unique index plus serializable transactions to keep one current goal per user. The overview displays the chosen goal; the goal page loads in a separate bundle. No dependencies or external API integrations were added. AI-enhanced quiz recommendations remain deferred until provider approval.

Verification: formatting, lint, strict TypeScript, schema validation and both production builds pass. There are 75 local tests (36 frontend and 39 backend), including an additional targeted test of stale-goal recovery. Eleven PostgreSQL integration tests run in CI, including five new tests for role seeds, goal/quiz persistence, ownership, historical preservation, concurrent goal creation and the unique index. A live disposable HTTP check through the frontend proxy passed login, custom goal creation, quiz submission, suggested-role confirmation and restoring saved results. The in-app browser repeatedly timed out attaching, so Phase 4 visual browser QA could not be completed; automated React UI tests cover the user flow. Production defaults remain Prisma/PostgreSQL. Phase 3 CI passed all 57 tests.

Phase 4 created files:

```text
backend/prisma/data/roles.json
backend/prisma/migrations/20261027000400_roles_and_current_goal/migration.sql
backend/src/modules/goals/goals.controller.ts
backend/src/modules/goals/goals.repository.ts
backend/src/modules/goals/goals.routes.ts
backend/src/modules/goals/goals.schemas.ts
backend/src/modules/goals/goals.service.ts
backend/src/modules/goals/goals.types.ts
backend/src/modules/quiz/quiz.controller.ts
backend/src/modules/quiz/quiz.data.ts
backend/src/modules/quiz/quiz.repository.ts
backend/src/modules/quiz/quiz.routes.ts
backend/src/modules/quiz/quiz.schemas.ts
backend/src/modules/quiz/quiz.service.ts
backend/src/modules/quiz/quiz.types.ts
backend/src/modules/roles/roles.controller.ts
backend/src/modules/roles/roles.repository.ts
backend/src/modules/roles/roles.routes.ts
backend/src/modules/roles/roles.service.ts
backend/src/modules/roles/roles.types.ts
backend/tests/goals-quiz.database.test.ts
backend/tests/goals-quiz.test.ts
backend/tests/helpers/memory-career-repositories.ts
frontend/src/features/goals/CurrentGoalCard.tsx
frontend/src/features/goals/InterestQuiz.tsx
frontend/src/features/goals/goals.api.ts
frontend/src/pages/GoalsPage.test.tsx
frontend/src/pages/GoalsPage.tsx
```

## Phase 5: gap analysis and roadmap generation

Implemented deterministic weighted gaps/strengths, canonical role/skill context, cached free role blueprints, prerequisite-ordered offline templates, projects, curated official resources, strict schema validation, provider retries and rate-limit backoff, transactional nested persistence, owned reads, immutable versions, and three persisted attempts per UTC day. A minimal roadmap screen supports review/confirmation, generation, saved results, error/retry, and fallback notices. The owner approved preparing Groq; the official OpenAI-compatible SDK adapter is ready but live calls remain disabled behind two environment switches. Gemini/Ollama remain deferred pending separate approval. No secrets or real provider responses were used. The current Prisma schema already supports this phase, so no migration was necessary.

Verification: local formatting, lint, strict types, schema validation, production builds, and automated unit/UI tests pass. PostgreSQL integration tests are included in GitHub CI for nested persistence, ownership, version history, concurrent quotas, invalid/stale input and transaction rollback. Local Docker/PostgreSQL remains unavailable. Browser attachment timed out, so visual QA is unverified. See [Roadmap generation](ROADMAP_GENERATION.md) for API contracts, privacy, quota semantics, provider limitations and activation procedure. Weekly scheduling remains Phase 6.

Phase 5 created files:

```text
backend/prisma/data/roadmap-templates.json
backend/src/ai/roadmap.provider.ts
backend/src/modules/roadmap/roadmap.controller.ts
backend/src/modules/roadmap/roadmap.gaps.ts
backend/src/modules/roadmap/roadmap.repository.ts
backend/src/modules/roadmap/roadmap.routes.ts
backend/src/modules/roadmap/roadmap.schemas.ts
backend/src/modules/roadmap/roadmap.service.ts
backend/src/modules/roadmap/roadmap.templates.ts
backend/tests/roadmap.database.test.ts
backend/tests/roadmap.test.ts
docs/ROADMAP_GENERATION.md
frontend/src/features/roadmap/roadmap.api.ts
frontend/src/pages/RoadmapPage.test.tsx
frontend/src/pages/RoadmapPage.tsx
```

## Phase 6: roadmap UI and weekly plans

Implemented collapsible phases, topic status/difficulty/project markers, roadmap-topic links, exact deterministic scheduling, four flexibility modes, partial-week deadline calculations, buffer weeks, workload warnings, projected completion, preview/confirmation and versioned replanning. Completed allocations and their timestamps survive replans; old plans remain intact. Serializable confirmation checks a state-derived preview token and expected active-plan ID; a SQL partial unique index enforces one active plan per roadmap. The owner deferred API setup, and local live-call switches are disabled. No dependencies or external integrations were added.

Verification: 112 local tests pass (49 frontend, 63 backend), with formatting, lint, strict TypeScript, Prisma validation and production builds passing. Nineteen PostgreSQL integration tests run in CI, including four new plan tests covering persistence/ownership, completion preservation across repeated replans, expired previews, concurrent confirmation and the active-plan index. Local browser QA passed disposable sign-in, initial preview/save, relaxed replanning, changed finish date, buffer weeks, expanded allocations and roadmap-topic navigation. Production defaults remain Prisma/PostgreSQL; local Docker is unavailable. See [Weekly planning](WEEKLY_PLANNING.md) for API contracts and algorithm details. Progress actions remain Phase 7.

Phase 6 created files:

```text
backend/prisma/migrations/20261027000600_one_active_plan/migration.sql
backend/src/modules/plan/plan.controller.ts
backend/src/modules/plan/plan.repository.ts
backend/src/modules/plan/plan.routes.ts
backend/src/modules/plan/plan.scheduler.ts
backend/src/modules/plan/plan.schemas.ts
backend/src/modules/plan/plan.service.ts
backend/tests/plan.database.test.ts
backend/tests/plan.test.ts
docs/WEEKLY_PLANNING.md
frontend/src/features/plan/plan.api.ts
frontend/src/pages/PlanPage.test.tsx
frontend/src/pages/PlanPage.tsx
```

## Phase 7: learning progress, logs, projects and charts

Implemented owned active-plan task status controls, project-evidence completion gates, weighted overall/per-skill progress, roadmap completion/reopening, UTC streaks, learning logs with stable retry request IDs, cursor pagination, daily time limits, project upserts and an account dashboard. The minimal dashboard includes a progress ring, weekly checkboxes/status selectors, logged/planned time, overdue warnings, milestones, a Recharts time chart and skill radar with text equivalents. Dashboard/charts are loaded separately. Completed allocations remain counted only in the active version after replanning. No external APIs were added or called; live provider setup remains deferred.

Verification: 136 local tests pass (61 frontend, 75 backend), plus formatting, lint, strict types, Prisma validation and production builds. Twenty-four PostgreSQL integration tests run in CI, including five new tests covering progress persistence/ownership, replanning, evidence-gated completion/reopening, concurrent log deduplication and daily limits, cursor privacy, dates and project updates. The first CI run exposed an unhandled concurrent-log conflict; retries now also recognize PostgreSQL adapter COMMIT conflicts, with a unit regression and the unchanged concurrent database assertion. Browser QA with a disposable API verified sign-in, checkbox-driven progress, log save/history, project evidence, updated streak/submission counts and both chart renders. Runtime defaults remain Prisma/PostgreSQL; local Docker is unavailable. Recharts installation was temporarily blocked by approval-review usage limits, then succeeded after the reported reset; npm audit reports zero vulnerabilities. See [Learning progress](LEARNING_PROGRESS.md) for contracts and semantics.

Phase 7 created files:

```text
backend/prisma/migrations/20261027000700_learning_log_requests/migration.sql
backend/src/modules/progress/progress.controller.ts
backend/src/modules/progress/progress.logic.ts
backend/src/modules/progress/progress.repository.ts
backend/src/modules/progress/progress.routes.ts
backend/src/modules/progress/progress.schemas.ts
backend/src/modules/progress/progress.service.ts
backend/src/modules/progress/progress.types.ts
backend/src/utils/transactionConflict.ts
backend/tests/progress.database.test.ts
backend/tests/progress.test.ts
docs/LEARNING_PROGRESS.md
frontend/src/features/progress/DashboardProgress.test.tsx
frontend/src/features/progress/DashboardProgress.tsx
frontend/src/features/progress/ProgressCharts.tsx
frontend/src/features/progress/TaskControl.tsx
frontend/src/features/progress/progress.api.ts
frontend/src/pages/ProgressPage.test.tsx
frontend/src/pages/ProgressPage.tsx
frontend/src/test/progress-fixture.ts
```

## Phase 8: contextual offline mentor and streaming chat

Implemented per-turn skill/progress context, bounded/redacted history, a provider-agnostic streaming interface, clearly labelled offline learning guidance, authenticated SSE, owned ordered conversation history and paging, suggested questions, copy, stop/retry and confirmed deletion. Persisted per-user quotas and short-window rate limits bound requests. Fresh lease tokens, expected versions and atomic message-pair writes protect concurrent turns, expired writers, deletion races and retries. The owner deferred live APIs, so no external mentor integration is enabled or called; the original plan's live AI explanations remain deferred until approval and credentials are available. No dependencies were added.

Verification: 165 local tests pass (75 frontend, 90 backend), including a targeted delayed-history isolation regression. Formatting, lint, strict types, Prisma validation and both production builds pass. Twenty-nine PostgreSQL integration tests run in CI, including five new tests for durable ordered pairs/replay/pagination/privacy, concurrent quota claims and reservations, provider failure without partial saves, deletion during a turn and expired-lease commits. Browser QA with a disposable offline API passed sign-in, suggested progress/next-topic questions, streamed saved replies, copy and history restoration after reload. Production defaults remain Prisma/PostgreSQL; local Docker is unavailable. See [Learning mentor](LEARNING_MENTOR.md) for contracts, quotas, privacy and offline limitations.

Phase 8 created files:

```text
backend/prisma/migrations/20261027000800_mentor_turns/migration.sql
backend/src/ai/mentor.context.ts
backend/src/ai/mentor.provider.ts
backend/src/modules/chat/chat.controller.ts
backend/src/modules/chat/chat.repository.ts
backend/src/modules/chat/chat.routes.ts
backend/src/modules/chat/chat.schemas.ts
backend/src/modules/chat/chat.service.ts
backend/src/modules/chat/chat.types.ts
backend/tests/chat.database.test.ts
backend/tests/chat.test.ts
backend/tests/helpers/memory-chat-repository.ts
docs/LEARNING_MENTOR.md
frontend/src/features/chat/chat.api.test.ts
frontend/src/features/chat/chat.api.ts
frontend/src/pages/ChatPage.test.tsx
frontend/src/pages/ChatPage.tsx
frontend/src/test/chat-fixture.ts
```

# Phase 9: certificates and public verification

Implemented server-side topic/project eligibility, serializable idempotent issuance, immutable recipient/role/hour/date snapshots, private PDF downloads, embedded fonts, QR verification links, public verification and LinkedIn share/profile links. The minimal certificate page shows remaining requirements and requires acknowledgement of public name disclosure. Reopened coursework makes certificates inactive until completion is restored. No external API integration was enabled or called.

Validation: 170 local tests (76 frontend, 94 backend), formatting, lint, types, Prisma validation and production builds pass. Thirty PostgreSQL tests run in CI, including concurrent certificate issuance, evidence gates, download ownership, reopening/restoration and stable IDs. The first CI run identified two new test fixtures relying on local authentication configuration; both now inject explicit test secrets, matching the existing suites. Browser QA with a disposable local API checked sign-in, listing, PDF download and public verification. A sample PDF was rendered and visually inspected. Local PostgreSQL is unavailable. Set the canonical public frontend origin before sharing outside localhost; PDF script coverage is documented in [Certificates](CERTIFICATES.md).

Phase 9 created files:

```text
backend/src/modules/certificates/certificates.repository.ts
backend/src/modules/certificates/certificates.routes.ts
backend/src/modules/certificates/certificates.pdf.ts
backend/tests/certificates.test.ts
backend/tests/certificates.database.test.ts
frontend/src/features/certificates/certificates.api.ts
frontend/src/pages/CertificatesPage.tsx
frontend/src/pages/CertificatesPage.test.tsx
frontend/src/pages/VerifyPage.tsx
docs/CERTIFICATES.md
```

## Phase 10: in-app reminders and notifications

Implemented weekly check-ins and behind-schedule notices based on the latest active learning plan, UTC week deduplication, an owned paginated inbox, unread counts, idempotent read actions and reminder preferences. A bounded database job handles concurrent workers safely. Local node-cron scheduling is opt-in and stops during shutdown; a separate bearer-secret endpoint supports paginated remote runs. The GitHub scheduler template is prepared outside active workflows. Email and external scheduling remain deferred, with no live integration enabled or called.

Validation: 182 local tests (80 frontend, 102 backend), formatting, lint, strict types, Prisma validation and production builds pass. Thirty-four PostgreSQL tests run in CI, including four new tests for bounded batch continuation, concurrent weekly deduplication, opt-out/plan eligibility, private cursor paging and read retries. Browser QA with a disposable API checked sign-in, both reminder types, unread updates and read-state restoration after reload. Production uses Prisma/PostgreSQL; no local database is available. See [Notifications](NOTIFICATIONS.md) for configuration, contracts and deferred integration setup.

Phase 10 created files:

```text
backend/prisma/migrations/20261027001000_reminder_preferences/migration.sql
backend/src/jobs/weekly.ts
backend/src/modules/notifications/notifications.types.ts
backend/src/modules/notifications/notifications.logic.ts
backend/src/modules/notifications/notifications.repository.ts
backend/src/modules/notifications/notifications.routes.ts
backend/tests/notifications.test.ts
backend/tests/notifications.database.test.ts
frontend/src/features/notifications/notifications.api.ts
frontend/src/pages/NotificationsPage.tsx
frontend/src/pages/NotificationsPage.test.tsx
docs/NOTIFICATIONS.md
docs/templates/weekly-reminders.yml.example
```

## Phase 11: regression coverage and error recovery

Added page-level recovery for render/lazy-load failures, actionable public-verification retry, missing-link errors, validated certificate response envelopes and safe verification URLs. Failed certificate refreshes hide stale results; background checks disable actions and avoid claiming current validity. Task changes now invalidate certificate caches alongside progress and plans. Backend tests explicitly disable live providers and local timers. No dependencies, external integrations or database migrations were added.

Validation: 209 local tests pass (88 frontend, 121 backend), plus formatting, lint, strict types, Prisma validation and production builds. Thirty-five PostgreSQL tests run in CI. New coverage includes scheduler conservation across modes/partial completion, proficiency boundaries, safe server errors, page recovery, certificate response failures, stale validity and an HTTP learning flow from signup through offline mentor/project evidence to certificate verification and reopening. Browser QA with a disposable API confirmed a forced 503 followed by successful retry without sign-in. See [Testing](TESTING.md) for commands, coverage and limitations; local PostgreSQL remains unavailable.

Phase 11 created files:

```text
backend/tests/errorHandler.test.ts
backend/tests/learning-flow.database.test.ts
backend/tests/service-invariants.test.ts
frontend/src/components/RouteErrorBoundary.tsx
frontend/src/components/RouteErrorBoundary.test.tsx
frontend/src/features/certificates/certificates.api.test.ts
frontend/src/features/progress/TaskControl.test.tsx
frontend/src/pages/VerifyPage.test.tsx
docs/TESTING.md
```

## Phase 12: deployment preparation, API docs and demo data

Prepared a non-root, single-origin Docker runtime, a migration image and a persistent PostgreSQL Compose stack with private environment examples. Added locally hosted read-only Swagger/OpenAPI documentation derived from runtime Zod inputs, static frontend/deep-link handling, explicit proxy configuration and fail-fast production origin validation. The opt-in local/test demo seed writes related illustrative learning data atomically, refuses account collisions/production mode and leaves existing passwords/progress unchanged on reruns. Rewrote the README and added deployment, backup/rollback and demo-recording guidance plus disposable-QA screenshots.

Validation: 215 local tests pass (88 frontend, 127 backend), plus formatting, lint, strict types, Prisma validation and production builds. Thirty-six PostgreSQL tests run in CI, including new demo persistence/idempotency/password-preservation checks. CI also validates Compose configuration, builds runtime/migration images, applies migrations and smoke-tests bundled frontend, Swagger, readiness and account creation. Browser QA confirmed Swagger rendering and the built login page from one origin; it identified a preview CORS-origin mismatch, now documented and guarded for production. Local Docker/PostgreSQL remains unavailable.

The owner explicitly chose hosting later. **Public deployment, live URLs, HTTPS/domain setup, external integrations and video recording/publication remain pending.** No host, paid resource, API integration or public demo account was provisioned. This phase completes reviewable preparation, not a claim that the application is publicly deployed. See [Deployment](DEPLOYMENT.md) and [Demo](DEMO.md).

Phase 12 created files:

```text
backend/src/docs/openapi.ts
backend/src/docs/docs.routes.ts
backend/src/scripts/seed-demo.ts
backend/src/web.ts
backend/tests/deployment.test.ts
backend/tests/demo-seed.database.test.ts
compose.deploy.yml
deploy/.env.example
docs/DEPLOYMENT.md
docs/DEMO.md
docs/screenshots/dashboard.png
docs/screenshots/mentor.png
```

## Local run follow-up

Added optional Windows x64 portable PostgreSQL 16 install/start/stop commands for development without Docker. The runtime, persistent database and logs stay in ignored `.local/`, excluded from Docker context and tool scans. The helper accepts only a local database URL, refuses production mode and occupied ports, preserves existing records and uses `pg_ctl` for graceful shutdown. Added opt-in private demo-password generation that preserves nonempty secrets. Docker deployment and deferred external integrations remain unchanged.

Applied all seven migrations to the local database and seeded the illustrative demo account. Verified graceful stop/start, seed idempotency after restart, successful authenticated demo login, database readiness and the registration page. Checked that repeated demo environment setup preserves credentials, production startup is rejected and an occupied port leaves the running database ready. The API and Vite frontend are available locally; this does not publish the application.

Changed files: `.gitignore`, `.dockerignore`, `.prettierignore`, `eslint.config.js`, `package.json`, `scripts/setup-env.mjs`, `scripts/local-postgres.mjs`, `README.md`, `docs/DEMO.md`, and this progress log. No API integration was enabled.

Validation: all 215 local tests pass (88 frontend, 127 backend), along with formatting, lint, strict types, Prisma validation and production builds. The 36 disposable PostgreSQL integration tests remain part of CI; they were not run against the persistent local demo database.

## Workspace redesign and goal expansion

Replaced the crowded workspace navigation with a responsive sidebar and mobile navigation, added a shared three-step goal/roadmap/weekly-plan guide, and refreshed typography, spacing, cards, inputs and schedule summaries. Goals now offer searchable/filterable career cards plus an independent custom-goal form, available even when catalogue loading fails. Expanded the role catalogue from six to 24 with an additive migration; existing goals and progress are preserved.

Fixed arbitrary custom goals being saved successfully but rejected by roadmap generation. Exact catalogue skill/role matches retain skill-based roadmaps. Unmatched goals receive a clearly labelled general starter roadmap with three actionable topics including a project, no invented subject resources or proficiency claims, and normal weekly scheduling. Added immediate dashboard refresh after goal changes, roadmap generation and plan saves. Missing-goal states now guide learners to choose a goal rather than retrying an unmet prerequisite. Plan previews show the first four weeks before confirmation and saved schedules open the first unfinished week.

Validation: 92 frontend tests, 145 backend unit/API tests and all 38 PostgreSQL integration tests pass. Database tests ran in a separate newly created database that was removed afterwards. Live HTTP checks also verified registration, arbitrary custom and expanded career goal generation, weekly preview/save/reload, progress linkage and exact allocation-hour conservation. Temporary QA accounts were removed; learner data was not used. Formatting, lint, strict types, schema validation and production builds passed. Browser checks covered desktop/mobile navigation, goals search, custom-goal entry and the missing-goal plan state. No external integration was enabled.

New files: `frontend/src/workspace.css`, `frontend/src/components/layout/LearningSteps.tsx`, `backend/prisma/migrations/20261027001300_expand_goal_catalogue/migration.sql`, `backend/tests/custom-goal.database.test.ts`, and `docs/screenshots/goals.png`. Existing goals, roadmap, plan, layout, catalogue, quiz scoring and regression tests were updated.

## Launch step 1: Vercel and Neon

The owner selected free hosting and requested a provider without Render's fixed free-database expiry. Prepared a same-origin Vercel frontend/API deployment and Neon PostgreSQL connection separation: pooled runtime queries, direct production-only build migrations, no automatic production migrations from previews. Added a serverless Express export, required runtime data/font/Swagger packaging, SPA routes, CDN asset caching and private-file exclusions. Production origins use explicit settings or platform-provided canonical URLs, never an incoming Host header. Render origin support remains available for an optional future move.

Eight deployment tests pass, including Vercel/Render origin defaults, explicit custom domains, invalid origin rejection, frontend/API handling, local Swagger and private demo restrictions. Hosting is not connected yet; no live URL or new cloud database is claimed. AI, email and Google integrations were explicitly approved and are separate implementation steps. Owner setup instructions are in `docs/LAUNCH.md`.

## Launch step 2: approved AI mentor adapter

Added a Groq streaming mentor adapter using the existing chat completion client, with a bounded reply length, anonymised context/history, cancellation, no automatic network retries and safe provider errors. It shares the existing explicit AI provider/approval switches with roadmap generation. A private key alone cannot enable calls. The mentor now reads authenticated server configuration and shows the active mode and external-processing disclosure before enabling questions. Offline mode remains the default.

Added transport regression tests using mocked responses; no real AI request or credential validation was performed. Updated Swagger and owner instructions with exact private environment fields. Live AI verification requires a valid provider key, available model and owner-side account setup.

## Launch step 3: account access and scheduled email

Implemented Brevo transactional email, email verification, password recovery, Google sign-in and Vercel scheduled reminders. Account links are random, hashed in PostgreSQL, expiring and single-use. Resetting a password revokes existing sessions; password-based session creation rechecks the validated hash under a user row lock to prevent a concurrent old-password login from surviving a reset. Reset requests have generic responses, a uniform response delay and request-lifecycle-aware background delivery. Verification is an explicit action and resend issuance is bounded.

Google sign-in uses Google's official client, signature/audience/expiry verification, verified email, nonce, PKCE, signed state cookies and a server callback. Existing password accounts are not silently linked just by email. Refresh credentials remain in private cookies; callback query values and redirect locations are removed/redacted from application logs. Incomplete provider configuration is rejected and defaults stay disabled. Live account integrations require HTTPS in production.

Added public recovery screens, conditional Google buttons and owned account-verification status/actions. Vercel's daily authenticated request persists a pagination cursor, creates idempotent weekly notices, delivers bounded batches to verified opted-in recipients, claims delivery against overlap and cleans expired account tokens. Private production setup generates new JWT/cron secrets in an ignored file without printing them or overwriting existing settings. Provider/account instructions, exact callback URI and environment fields are in `docs/LAUNCH.md`.

Local format, lint, strict types, schema validation, 100 frontend tests, 155 backend unit/API tests and production builds pass. All 42 PostgreSQL integration tests also pass in a newly created disposable database, removed after the run: 297 tests in total. The local learner database was not used for test fixtures. Browser QA confirmed the recovery screen. Live provider delivery/login and public deployment are not claimed: Vercel/Neon are not connected and provider credentials have not been configured.
