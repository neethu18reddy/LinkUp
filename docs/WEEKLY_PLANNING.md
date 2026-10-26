# Weekly planning (Phase 6)

Weekly scheduling is deterministic and makes no external calls. Live Groq activation has been deferred by the owner; local API switches remain disabled. Earlier key authentication checks were unsuccessful; no roadmap inference was performed.

## Modes and allocation

The scheduler walks roadmap phases/topics in their stored prerequisite order and splits topics across week buckets. It uses integer hundredths of an hour to conserve the exact database estimates without floating-point drift. Weeks are seven-day blocks anchored on the selected start date; all dates are UTC calendar dates.

| Mode      | Weekly capacity                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| STANDARD  | 100% of stated hours                                                                                                                         |
| RELAXED   | 80%, plus an empty catch-up week after every four study weeks when work remains                                                              |
| INTENSIVE | 120%, without buffer weeks                                                                                                                   |
| DEADLINE  | Remaining hours divided by available days × 7, rounded up to the next hundredth of an hour; the final partial week has proportional capacity |

Stated hours must be 0.5–60 in half-hour steps. Deadline mode requires a target date. More than 40 effective hours per week produces a warning; exceeding the stated availability in deadline mode produces another warning. More than 168 hours/week is rejected. Other modes warn when they miss an optional target date. Plans over 520 future calendar weeks are rejected. Initial start dates must be today or later and within two years. A completed roadmap has no future allocations; the projected finish is today/start date. Displayed finish dates are conservative week-end estimates, capped by the target in deadline mode.

## Preview, confirmation and ownership

All endpoints require authentication and return `Cache-Control: no-store`.

| Endpoint                                 | Purpose                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET /api/v1/plans/current?roadmapId=uuid | Active owned plan or null                                                                      |
| POST /api/v1/plans/preview               | Pure preview of ordered weeks, effective hours, remaining hours, warnings and projected finish |
| POST /api/v1/plans                       | Confirm a preview and create a version                                                         |
| GET /api/v1/plans/:id                    | Read an owned version, including historical plans                                              |
| PATCH /api/v1/plans/:id                  | Confirm adjusted settings as a new version                                                     |
| POST /api/v1/plans/:id/replan            | Confirm a replan of the active version                                                         |

Preview bodies have `roadmapId`, numeric `hoursPerWeek`, `flexibilityMode`, `startDate` (YYYY-MM-DD), nullable `targetEndDate`, and nullable `expectedPlanId`. Confirmation includes exactly those fields plus the returned `previewToken`. For a first plan expectedPlanId is null; replacements name the active version. PATCH and replan use the same complete settings/preview contract, rather than mutating old weeks.

The server hashes normalized settings, topic estimates/statuses, completed allocations and the resulting schedule. Confirmation reloads this state and verifies the preview hash inside a serializable transaction. The hash is an optimistic consistency token, not an authorization credential. Changed settings/progress/date produce 409 PREVIEW_EXPIRED; a different active plan produces 409 PLAN_CHANGED. The UI discards the preview after field changes or failed confirmation. A matching preview never bypasses ownership checks.

One active plan per roadmap is enforced by the SQL partial unique index in migration `20261027000600_one_active_plan`. Concurrent confirmations are retried transactionally; one creates a version and the other receives a conflict. Creating a plan marks a DRAFT roadmap ACTIVE.

## Replanning without losing work

Remaining allocations start from today in UTC. DONE items from the active plan are copied into preserved history weeks and their hours are deducted once per topic. Older inactive versions are never summed again. Topic-level DONE work not yet represented by plan items is also preserved. Unfinished and skipped allocations return to the remaining work queue in topic order. Old plan/week/item rows remain intact, including completion timestamps. This phase adds no task-completion controls; those belong to Phase 7.

The minimal `/plan` screen follows the latest roadmap for the current goal. Previous plan versions remain accessible through their owned GET endpoint. Generating a new roadmap version starts a separate planning history and does not remove plans on older roadmaps. Timeline links open the corresponding roadmap topic.

## Verification

Unit tests cover ordered splitting, exact hour conservation, mode capacities, buffer placement, partial deadline weeks, unrealistic deadlines, date/leap boundaries, finished work, stale previews and input bounds. React tests cover loading/empty/error/retry, preview/cancel/confirm, invalidation after editing, deadline warnings and replan confirmation. PostgreSQL CI tests cover persistence, ownership, activation, completed-work preservation across repeated versions, expired previews, concurrent confirmation and the unique active-plan index.

Local browser QA used a disposable in-memory API to verify sign-in, first-plan preview/confirmation, a relaxed replan, the new finish date, buffer weeks, expanded timeline allocations and roadmap navigation. Production defaults remain Prisma/PostgreSQL. No real accounts or external APIs were used. Local Docker is unavailable, so database tests run in CI.
