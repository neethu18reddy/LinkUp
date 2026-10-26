# Learning progress (Phase 7)

This phase adds task status, private learning logs, project evidence, UTC streaks and dashboard charts. No external API is called. Recharts is an open-source frontend dependency; its dashboard charts load in a separate bundle. The owner's deferred Groq setup remains disabled.

## Completion and estimated progress

PATCH `/api/v1/plan-items/:id` accepts exactly `{status, expectedStatus}` with TODO, IN_PROGRESS, DONE or SKIPPED values. The caller must own the roadmap and the plan must be active. A different expected status returns 409 TASK_CHANGED; a historical plan returns 409 PLAN_CHANGED. Repeating the already-saved status is idempotent. Tasks can be reopened, started or skipped. Skipped hours are still unfinished learning and return when replanning.

Status changes run inside serializable transactions. Topic status derives from all allocations for that topic in the active plan. DONE allocated hours reaching the topic's estimate completes the topic; partial completion or an in-progress allocation yields IN_PROGRESS. Otherwise the topic is TODO. Project tasks cannot be marked DONE until evidence is submitted. A roadmap becomes COMPLETED only when every topic is DONE and all required projects have evidence; reopening makes it ACTIVE again. The goal remains available so the completed roadmap stays visible. Certificates are a later phase.

Overall progress is earned estimated hours divided by total topic estimates. Earned hours are the topic estimate for DONE topics, otherwise DONE allocations from the active plan capped at the topic estimate. Inactive versions are excluded, so replanning never counts copied history twice. Skill progress groups those hours by canonical skill ID. Percentages stay below 100 until all estimated hours are earned. These are progress measures, not proficiency or quality assessments.

## Learning logs

POST `/api/v1/logs` accepts `requestId` (UUID), nullable `topicId`, integer `minutes` (1–720), `note` (1–2000 trimmed characters), and `loggedOn` (YYYY-MM-DD). The topic, if selected, must belong to the caller. General learning has no topic. Dates are UTC, from the preceding 365 days through today. A serializable daily total check rejects more than 1440 minutes on one date.

Migration `20261027000700_learning_log_requests` adds a request UUID and unique `(userId, requestId)` index. Identical retries return the existing log; reusing an ID for different content returns 409. The UI retains that ID after request failure and changes it when the form changes or succeeds. Old logs receive generated IDs during migration. Logs are stored at UTC midnight on the chosen learning date; the displayed date is the learning date rather than submission time. Logging minutes does not complete topics or tasks.

GET `/api/v1/logs?limit=20&cursor=uuid` returns owned logs and a nullable nextCursor. Limits are 1–50. Results sort by learning date and ID descending. A foreign cursor is rejected before pagination. Each entry includes its topic title, note, minutes and learning timestamp.

Streaks count distinct consecutive UTC learning dates, ending today if there is a log today, otherwise yesterday. A missed yesterday resets the current streak to zero. Duplicate sessions on one day add time without extending the streak. The seven-day chart, streak and logged-minute totals cover all account learning, including general logs and other goals. The dashboard labels that scope. Weekly comparisons use dates in the active plan's current week.

## Project submissions

POST `/api/v1/projects` accepts `topicId`, `title` (1–200 characters), nullable `repoUrl`, and `notes` (up to 5000 characters). Evidence requires a valid HTTPS link without URL credentials or at least ten characters of notes. The topic must be an owned project. Submissions upsert by user/topic, so updates keep the same ID. Links are stored and displayed but never fetched, inspected or sent to another service. Evidence is self-reported and does not automatically complete project tasks.

GET `/api/v1/projects?roadmapId=uuid` returns submissions only for an owned roadmap.

## Dashboard summary

GET `/api/v1/progress/summary` selects the latest roadmap version for the current goal; optional roadmapId selects an explicitly owned roadmap. A learner without a roadmap gets a valid empty summary and can still record general learning. Unknown/foreign explicit IDs return 404. All progress/log/project endpoints require authentication, strict input validation and `Cache-Control: no-store`.

The summary includes weighted overall/per-skill progress, counts, seven daily time totals, streak, current-week tasks, logged/planned time, submitted projects and the first unfinished phase as the next milestone. Past weeks' unfinished allocations count as overdue hours; future work does not. Carried completed history is excluded from current-week tasks. There is no midweek pacing assumption: behind-schedule warnings use fully elapsed weeks.

The dashboard has an accessible progress ring, task checkboxes/status selectors, time chart, skill radar and text equivalents. `/progress` provides forms and paginated history; `/plan` exposes controls for all active weekly allocations. Loading, empty, error, retry and successful-save states are provided. Server state is invalidated after writes; session changes continue clearing all account caches synchronously.

## Verification

Unit tests cover weighted/partial/capped progress, milestones, overdue and carried allocations, UTC/leap-day streaks, date bounds, evidence/URL validation and spoofed fields. UI tests cover summary loading/retry, task completion/failure, general logs, stable request IDs after retry, cursor loading and project notes. PostgreSQL tests cover transactionally persisted progress, private access, replan preservation, project-gated completion/reopening, concurrent log deduplication, daily limits and submission upserts. No real LLM is used in tests.

Local browser QA uses a disposable in-memory API; real runtime defaults remain Prisma/PostgreSQL. It verifies checkbox-driven progress changes, general logs/history, project submissions, updated streak/counts, and the rendered time/radar charts. PostgreSQL migration/integration checks run in GitHub CI because Docker is unavailable locally.
