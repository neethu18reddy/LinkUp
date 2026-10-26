# linkup build progress

Source of scope: [LinkUp.md](../LinkUp.md). Product name: **linkup**. Keep the UI minimal. Ask the owner before any external API integration. Commit and push after every completed phase, then wait for confirmation before starting the next phase.

| Phase | Scope                                                   | Status                                                |
| ----- | ------------------------------------------------------- | ----------------------------------------------------- |
| 1     | Monorepo, tooling, Docker PostgreSQL, Prisma schema, CI | Implemented; local checks passed                      |
| 2     | Auth and protected routes                               | Implemented; local checks passed                      |
| 3     | Skill catalogue and profiles                            | Implemented; local checks passed                      |
| 4     | Goals, interest quiz, recommendations                   | Implemented; local checks passed                      |
| 5     | Gap analysis and validated roadmap pipeline             | Implemented; Groq prepared, live calls disabled       |
| 6     | Roadmap UI, scheduler, flexibility, replanning          | Planned                                               |
| 7     | Progress, logs, projects, streaks, charts               | Planned                                               |
| 8     | Mentor context and streaming                            | Planned; provider integration requires approval       |
| 9     | Certificates, PDFs, public verification                 | Planned                                               |
| 10    | Reminders and notifications                             | Planned; email integration requires approval          |
| 11    | Service/API tests and error-state polish                | Planned; foundational tests begin in Phase 1          |
| 12    | Deployment, README completion, Swagger, seed demo       | Planned; hosted service integration requires approval |

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
