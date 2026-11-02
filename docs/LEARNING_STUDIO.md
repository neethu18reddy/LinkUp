# Learning Studio

Learning Studio builds on the existing career catalog and saved roadmaps. It adds a learning shelf, editable chapters, YouTube or custom learning items, timestamped notes, versioned snippets, progress tracking, analytics and daily recaps. The roadmap now puts the next step first and expands the current stage.

## Local setup

1. Install workspace dependencies with `npm ci`.
2. Keep the existing `backend/.env` credentials. Optionally add `YOUTUBE_API_KEY` on the server. Never use a `VITE_` prefix for this key.
3. Run `npm run db:generate`, then `npm run db:deploy` against the intended **local** database. Do not use reset or force-push schema commands. The three Studio migrations add tables and preserve existing profiles, goals, plans and roadmap snapshots.
4. Run `npm run dev`, or `npm run build` followed by the existing server command.
5. Open `/studio`. Import a resource, review chapters and skill mappings, then click **Save plan**. A preview is not a saved learning plan.

New local databases and disposable test databases use UTF-8. Existing portable PostgreSQL databases are not recreated or converted automatically. If an older local database uses a Windows code page, it cannot store all Unicode note content; use a separate UTF-8 development database or a reviewed dump/restore procedure. Production Neon uses PostgreSQL UTF-8.

## Configuration and provider boundaries

| Setting                | Purpose                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `YOUTUBE_API_KEY`      | Optional server-only YouTube Data API v3 key. Enable that API in the owning Google project. Restrict the key appropriately. |
| Existing `CRON_SECRET` | Protects the existing daily job and `/api/v1/cron/daily-rollover`.                                                          |
| Existing JWT secrets   | Continue protecting sessions; also sign short-lived, narrowly scoped preview/watch tokens.                                  |

Without a YouTube key, single video URLs, pasted lists of video URLs and custom checklists work. Their unknown durations are labeled; manual completion remains available. Playlist enumeration requires the key. Private/deleted/unembeddable videos stay in the plan as unavailable and do not contribute to totals. Playlist metadata is cached for 15 minutes. Import requests are bounded and time out rather than silently saving a partial playlist.

The optional AI sectioning/polish and optional server code runner described in the brief are not enabled. Heuristic sectioning and templated recaps need no LLM calls, so existing Gemini limits and approval settings remain unchanged. There is no additional LLM key to configure. Java, C, C++ and Go snippets can be saved/exported; Run is unavailable for them. A future remote-runner adapter must provide actual isolation and limits before it can be enabled; an environment variable alone does not enable execution.

## Watch accounting

The official YouTube IFrame API drives playback state, position and sampling. Autoplay is opt-in. The client samples while playing, ignores discontinuous seeks and hidden-tab time, and sends cumulative counters approximately every ten seconds and on pause. Page hide/unload sends a short-lived, session-scoped beacon; it never places the normal access token in a URL.

The server accepts at most the elapsed interval and 30 seconds per heartbeat. A per-user watch lease prevents two devices or tabs from simultaneously claiming study time. Cumulative high-water marks and request IDs prevent retries from adding time twice. Content seconds and wall-clock seconds are separate. The server uses imported durations, not a client-supplied duration. An ENDED event also needs plausible content coverage and a position near the end, preventing a seek-to-end from automatically claiming an entire lesson. Unknown durations require manual completion.

Completion totals count each learning item’s first completion once. Reopening a video does not inflate its historical first-completion count. Current completion percentages can decrease when an item is reopened; manually completed skills remain protected. Item IDs remain stable when chapters are split, merged or reordered, so notes, snippets, positions and completion are retained.

## Shared progress and old data

`UserSkillProgress` holds shared skill status, provenance and percentage. Topic and active PlanItem records are compatibility projections for the current goal; old roadmap versions are retained. Project milestones still require project evidence and cannot be completed by finishing videos.

Progress respects required proficiency. An earlier beginner completion does not silently skip a new advanced roadmap step. Finishing linked sections can advance the current goal’s skill and its profile level. Partial resource progress contributes conservatively to career matching, without downgrading existing proficiency. Manual completion takes precedence over resource-derived percentages. With confirmation enabled, completed linked chapters are ready for the learner to confirm.

The first migration backfills completed topics and starting skills. The second stores dated legacy wins independently, so later reopening cannot erase earlier completion dates. `backend/prisma/studio-backfill.sql` is repeatable and limits legacy import to the recorded start of tracking. Undated starting proficiency is labeled **Before tracking began**. Earlier manual learning logs keep their originally entered calendar dates and are shown separately from measured watch time.

## Timezones and recaps

The browser’s IANA timezone is saved on first Studio use and can be changed in learning preferences. Accepted watch intervals split at actual local midnight, including DST boundaries. Per-day rows are keyed by user, resource and local date; midnight never deletes history. The UI refreshes at the server-reported next local midnight and also refreshes when activity is revisited.

`GET /api/v1/recap/today` means yesterday’s local recap. It is generated lazily and idempotently, and the existing protected daily job also processes Studio recaps in bounded batches. The first minute after midnight is provisional so an in-flight heartbeat can finish splitting the prior day; the finalized recap is saved afterward. No recap email is sent. Emoji use, daily goals, autoplay and skill-confirmation preferences are user-controlled.

Deleting a resource explicitly removes its notes, snippets, versions, watch sessions, resource events and daily aggregates. Derived recaps for affected days are invalidated and can be regenerated from remaining data. Independent skill history, manually completed skills and other resources stay saved. Export JSON first for a full resource copy; Markdown exports can cover one video, one chapter or the entire resource.

## Code and notes security

CodeMirror, Markdown rendering and TypeScript transformation load only when used. JavaScript/TypeScript execute in a worker owned by a sandbox iframe with an opaque origin. Python lazily loads the pinned Pyodide 0.27.7 runtime in that isolated worker. The application enforces a five-second execution timeout and a separate runtime-loading timeout. HTML/CSS previews use a nested sandbox. The runner’s dedicated CSP blocks application network access, forms and top-level navigation; no same-origin sandbox permission is granted. Browser memory limits remain browser-managed.

Do not weaken `/studio-runner.html` headers or add `allow-same-origin`. Vercel and the local server both provide the dedicated CSP and same-origin framing policy. User code is never executed by Express. Run metadata is self-reported browser activity, not an assessment or certification; output is not stored in the database. Markdown ignores raw HTML and uses the renderer’s safe URL handling. Notes and snippets use optimistic versions so a stale device cannot silently overwrite a newer edit. Offline drafts are scoped by signed-in user, resource and item, then reconciled when connectivity returns.

## API overview

All learner endpoints use the existing `/api/v1` prefix and bearer authentication with owner checks:

- `/resources/import/preview`, `/resources`, `/resources/:id`, `/resources/:id/sections`, `/resources/:id/activity`, `/resources/:id/export`
- `/progress/watch`, `/progress/heartbeat`, `/progress/complete`; the beacon endpoint instead requires a short-lived token tied to an active session family and one item
- `/notes`, `/notes/:id`, `/snippets`, `/snippets/:id`, `/snippets/:id/versions`, `/snippets/:id/runs`
- `/studio/settings`, `/studio/skills`, `/studio/skills/:id`
- `/analytics/overview`, `/analytics/resource/:id`, `/recap/today`, `/recap/:date`

Imports, heartbeats, document saves and run reporting have rate limits. Inputs and collection sizes are bounded. Imports use signed previews so browser edits cannot substitute video durations or ownership. Resource and item writes are transactional. Large imports and chapter moves batch writes rather than making one database round trip per video.

## Verification

Run the existing validator, lint, type checks, unit and database suites and production build. `node scripts/verify-studio-flow.mjs` exercises the local production artifacts with disposable QA accounts, disabled live AI/email/Google sign-in, and no YouTube key. It checks the roadmap focus, manual import, notes/reload/offline sync, real sandbox JS/TS/Python/HTML execution, timeout/isolation, mobile overflow and chapter progress retention. Python runtime assets require an Internet connection. `npm run test:career-browser` retains the original career entry-path checks with the redesigned roadmap.

Official integration references: [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference), [playlist pagination](https://developers.google.com/youtube/v3/docs/playlistItems/list), [video metadata](https://developers.google.com/youtube/v3/docs/videos/list), [Pyodide workers](https://pyodide.org/en/0.27.7/usage/webworker.html), [iframe sandboxing](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe).
