# Reminders and notifications

Phase 10 implements database-backed in-app notifications. Email delivery and hosted scheduling remain deferred at the owner's request; no SMTP/API account is connected and no external reminder request is sent.

## Rules

The job uses the active goal's latest roadmap and its active plan. Archived/completed roadmaps, future plans, empty/completed allocations and opted-out accounts are skipped. A topic already DONE does not trigger reminders through stale allocations. A weekly check-in is created when unfinished work has reached its start date. A behind-schedule notice is also created when an entire seven-day plan week has elapsed with unfinished allocations. SKIPPED allocations remain unfinished, matching dashboard progress. Behind-schedule hours are planned hours, not logged time.

Weeks are Monday–Sunday in UTC. Each user receives at most one notification of each reminder type per UTC week, even across replans, concurrent workers, repeated requests or application restarts. Unique database deduplication keys enforce this. Re-running a partially completed batch safely fills remaining notices. No email `sentAt` is written. These are historical check-ins, so completing work later does not rewrite an existing message; open the plan for current progress.

The inbox shows unread count, newest-first cursor pages (20 entries), retry states and idempotent mark-as-read. Reads, cursors and preferences are scoped to the authenticated owner. The opt-out stops future job inserts; existing notifications remain. A row lock coordinates preference writes with reminder inserts. Notifications are plain React text, never HTML.

## Local scheduling

Set `LOCAL_JOBS_ENABLED=true` in the ignored backend environment and restart the backend to enable local scheduling. It is disabled by default. `node-cron` runs one batch at the top of each UTC hour while the server is awake. Weekly database keys make these hourly ticks catch-up checks, not hourly messages. Each batch processes up to 100 accounts in UUID order. A continuation cursor moves to the next batch on the next tick; it resets after the final batch. Restarting resumes from the beginning safely. A failed batch retains the previous cursor and retries next hour. Larger deployments should use the paginated remote runner below.

Overlapping batches on one server return `JOB_BUSY`/409, and `node-cron` also has overlap prevention. Separate servers remain safe through database uniqueness and per-account locking. The server stops scheduling during shutdown. Configure either the local timer or hosted runner for normal operation; deduplication protects accidental overlap.

## Prepared remote endpoint

`POST /api/v1/internal/jobs/weekly` accepts `{}` or `{ "cursor": "last-user-uuid" }`. It returns processed/created counts and `nextCursor` (null when finished). It uses server time; callers cannot choose a future week. Continue with returned cursors to process more than 100 accounts. Keep requests at least seven seconds apart (10 authenticated job requests/minute plus the normal API limit). Failures can safely retry the same cursor. Counts contain no account details; cursors are protected by job authentication.

The endpoint is disabled unless `CRON_SECRET` contains at least 32 random characters. Pass it as `Authorization: Bearer <secret>` over HTTPS. Normal login tokens do not authorize jobs. The comparison hashes both values and uses constant-time comparison; authentication headers are redacted from logs. Do not put the secret in a URL, frontend variables or Git. An in-process guard releases on success and failure. Inputs are strict and bounded. Database/runtime failures leave committed earlier users intact and allow retries.

The example at `docs/templates/weekly-reminders.yml.example` can be copied into `.github/workflows/` **after the owner approves external integration and deployment**. It is intentionally outside active workflows and has not been enabled. It needs a deployed HTTPS `REMINDER_JOB_URL` secret and matching `CRON_SECRET` secret. It runs weekly, follows cursor pages, retries transient failures and stops on non-success. No SMTP code or credentials are required for in-app delivery. Optional email is still a later integration.

## API

- `GET /notifications?cursor=<owned-notification-id>`: entries, unread count, next cursor.
- `PATCH /notifications/:id/read` with `{}`: mark an owned entry read; retries preserve the first read time.
- `GET /notifications/preferences`: `remindersEnabled`.
- `PATCH /notifications/preferences` with `{ "remindersEnabled": false }`: update in-app preference.

All inbox, preference and job responses use `Cache-Control: no-store`. Inbox pages share the existing account-isolated query cache. Local tests cover weekly boundaries, overdue rules, secret authentication, strict inputs, job overlap/recovery and UI loading/read/preferences/pagination/error states. PostgreSQL CI covers durable concurrent deduplication, opt-out, versions and completed/future work, ownership, cursor ties and read retries.
