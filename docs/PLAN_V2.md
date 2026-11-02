# Learning Studio implementation plan — 2 November 2026

## Architecture and decisions

Keep the existing stack and routes. Add authenticated `/api/v1` Studio endpoints and lazy frontend routes. Add a shared `UserSkillProgress` authority; retain Topic/PlanItem as compatibility projections and preserve archived snapshots. Project milestones still require evidence. Manual completions take precedence over resource-derived progress. Stable catalog UUIDs are reused for section mappings.

Add owner-scoped resources, ordered sections/items, explicit section-skill mappings, item progress, deduplicated watch heartbeats, notes, snippets/versions/runs, an activity timeline, timezone settings, daily aggregates and immutable recap snapshots. Store wall time and content time separately. An expiring server-side watch lease prevents concurrent tabs from double-counting; request IDs make retries idempotent. Split accepted intervals at local midnight using IANA timezone rules. Dates and credited time are calculated on the server, not accepted from the client.

YouTube uses official Data API v3 pagination and batch metadata, with a short database cache. Imports are previewed and edited before saving. Without a key, manual video links and custom checklists remain usable; unknown duration never qualifies for percentage-based automatic completion. Unavailable videos stay visible and are excluded from totals. Heuristic sectioning is the default. Optional title-only AI grouping is disabled by default so Google free-tier requests are preserved.

The study view has an official IFrame player, opt-in autoplay, timestamped Markdown notes, a lazy CodeMirror editor and sandboxed execution. Execute user code inside a worker created by an opaque-origin sandbox iframe, with a parent-enforced timeout. Block network/storage access to the app. Python lazily loads a pinned Pyodide runtime inside that isolated environment; HTML preview uses a separate sandbox without same-origin permission. No user code runs on the application server. Optional remote runners require an explicitly configured trusted runner URL and server-side limits.

Recaps use the user's stored timezone (browser default on first visit), immutable events and per-local-date aggregates. A new day starts a new bucket; history is never cleared. Generate yesterday's recap lazily and in the existing protected daily job. No recap email is added. Historical learning logs remain distinguishable from newly tracked watch time.

## Migration and verification

Use forward-only migrations. Backfill completed topics and known profile skills idempotently, preserving completion dates where available and labeling undated proficiency as before tracking. Test seeded existing records before/after and rerun the backfill. Validate ownership, concurrent heartbeats, retries, midnight/DST boundaries, resource/skill aggregation and manual precedence with meaningful tests. Run lint, types, unit/database tests, production build and browser walkthroughs. No production migration is run during implementation.

## Phases

1. Audit and plan (complete).
2. Schema, migration and idempotent backfill.
3. Clear next-step roadmap backed by shared skill progress.
4. YouTube/manual import, sectioning and editable preview.
5. Study player, watch tracking, resume and completion.
6. Notes, offline drafts, search and export.
7. Snippets, versions and isolated runners.
8. Resource analytics and overall dashboard.
9. Timezone rollover, recap and daily goals.
10. Resource/roadmap synchronization and compatibility projections.
11. Performance, accessibility and security review.
12. Regression and end-to-end verification; document actual limits.

## Configuration

`YOUTUBE_API_KEY` is optional and server-only. Existing `CRON_SECRET` protects rollover. AI sectioning and remote execution are optional future adapters; neither is enabled by a configuration switch in this release. Unsupported languages remain editable with Run unavailable. Browser runtime versions and deployment CSP requirements are documented in `LEARNING_STUDIO.md`.

## Progress

Phases 1–12 are complete. Formatting, lint, types, 103 frontend tests, 187 backend unit tests, 50 database tests, the production build and both browser walkthroughs passed. All three migrations were rehearsed on an expiring production copy, preserving 20 existing learner tables. See `LEARNING_STUDIO.md` for configuration and `QA_V2.md` for evidence and integration limits.
