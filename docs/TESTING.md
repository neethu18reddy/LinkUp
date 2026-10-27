# Tests and recovery behavior

The Phase 11 suite combines frontend interaction tests, backend unit/API tests and PostgreSQL integration tests. These are targeted regression checks, not a claim of complete code or browser coverage.

## Commands

- `npm run check`: formatting, lint, strict TypeScript, local tests, Prisma validation and both production builds.
- `npm test`: frontend and backend Vitest suites. Database suites skip without explicit database-test configuration.
- `RUN_DATABASE_TESTS=true` and a **disposable** PostgreSQL `DATABASE_URL`: enables database integration suites. Apply migrations with `npm run db:deploy` first. CI creates its own PostgreSQL 16 container and runs all checks plus a readiness smoke test.

Use a dedicated test database. Fixture cleanup deletes only test-created users and their cascading records. Do not point integration tests at production. Backend Vitest explicitly disables live LLM calls and local cron timers even if a developer's private environment enables them. Providers used in generation tests are mocks; the complete flow uses curated templates and the offline mentor. No paid service or external API is required.

Each workspace caps test execution at four workers to bound jsdom/bcrypt/PDF CPU contention and database pools. The default per-test timeout is ten seconds; the complete HTTP flow explicitly allows twenty. This keeps unrelated suites from overwhelming the host while preserving per-file isolation.

## Coverage inventory

| Area             | Key checks                                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication   | Registration/login/refresh/logout, secure cookie behavior, expiry/replay, private resource access, concurrent refresh and account-cache isolation                            |
| Skills and goals | Catalogue/profile validation, role/custom goals, quiz constraints and owned goal replacement                                                                                 |
| Gap analysis     | Weighted deficits, missing/matching/exceeding proficiency, deterministic ranking and curated template validation                                                             |
| Scheduler        | All four modes, zero/invalid settings, buffers, deadline capacity, leap dates, fractional hours, partial completion, exact per-topic hour conservation and preview conflicts |
| Progress         | Completion/evidence gates, weighted percentages, logs and request deduplication, date/time limits, replanning and concurrent PostgreSQL conflicts                            |
| Mentor           | Context filtering, offline responses, stream framing, retry/stop, history ownership, request replay, quotas and lease/deletion races                                         |
| Certificates     | Server eligibility, private PDF ownership, concurrent idempotency, public verification, reopened work, unsupported PDF glyphs and malformed client responses                 |
| Reminders        | UTC weeks, overdue boundaries, opt-out, inactive/future/completed plans, concurrent deduplication, secret authentication and cursor paging                                   |
| Recovery         | Render/lazy-load failures, public verification retry, stale validity suppression, safe database/unknown errors, existing form and network-error states                       |

`learning-flow.database.test.ts` exercises the application through HTTP: registration → catalogue/profile → custom goal → offline roadmap → plan preview/save → log → offline mentor stream → required project evidence → task completion → certificate/PDF/public verification → reopen coursework → inactive verification and blocked PDF. It uses the real Prisma repositories and migrations, not a memory substitute. Separate suites cover cross-account access and concurrency.

## Recovery changes

The app wraps pages in an error boundary with reload and return-home controls. Navigation or account changes reset it. It shows no exception text or stack traces.

Certificate responses are validated before rendering. Null/invalid envelopes, invalid dates/statuses and non-HTTP(S) verification URLs fail into query error states. Public verification distinguishes malformed/missing links from transient service failures and offers retry for the latter. It rechecks on mount/focus; while rechecking it says so, and a failed refresh hides cached certificate details. The private certificate list also hides stale results after an error and disables issuance/download while checking. The backend remains the authority for every download.

Changing task status invalidates certificate and public-verification caches alongside progress/plan caches. This prevents a reopened task from leaving a cached certificate marked valid in the same account session.

## Practical limits

Portable local PostgreSQL is available. Persistence tests run in a separate disposable database; they must never target the persistent learner/demo database or production. CI also runs PostgreSQL integration and Docker smoke checks. New coverage includes single-use/expired account links, reset-session revocation, Google state/PKCE guards and identity collision handling, email configuration gates, verified-recipient/opt-out delivery claims, recovery forms and AI mode disclosure. Google/email/AI transports are mocked: these tests do not claim a live provider sign-in, email delivery or production deployment. PDF script support and localhost verification-link limits remain documented in `CERTIFICATES.md`.
