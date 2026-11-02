# Learning Studio verification — 2 November 2026

The release extends the existing React/Express/Prisma application and preserves the original career catalog, saved roadmaps, weekly plans, mentor and account routes.

## Automated checks

- Catalog validation: 2,252 skills, 326 roles and 3,482 role requirements validated during the production build.
- Formatting, ESLint, TypeScript and Prisma schema validation passed.
- Frontend: 103 tests passed across 22 files.
- Backend: 187 unit tests passed across 21 files. The 50 database tests are intentionally skipped in this unit command and passed separately in the database suite below.
- Database: 50 tests passed across 16 files against a disposable UTF-8 database, including all existing integration stories. Studio tests cover ownership, chapter moves, optimistic document version conflicts, exports/deletion, backfill idempotency, historical completion dates, proficiency projections, watch leases, duplicate heartbeats/beacons, manual completion precedence, midnight splits and immutable recaps.
- Production build passed. CodeMirror, Markdown and TypeScript transformation are separate lazy chunks. Vite reports the existing main/chart chunk size advisory and the lazy editor chunk size advisory; these are warnings, not failed builds.

## Browser verification

`npm run test:studio-browser` passed using the built production artifacts and disposable local accounts. It verified import/preview/save, next-step roadmap focus, notes after reload, offline draft synchronization, JS/TS/Python/HTML execution, execution timeout, browser sandbox isolation, completion after reload, chapter edits preserving completion, stored browser timezone and no horizontal overflow at 390 pixels. No unexpected browser errors occurred.

`npm run test:career-browser` passed guided career setup, saved answers and goal, five-stage roadmap, completion surviving reload, direct skill selection/search/recommendations and mobile layout. No unexpected browser errors occurred.

Screenshots were visually reviewed: [roadmap](screenshots/studio-roadmap-desktop.png), [desktop study](screenshots/studio-study-desktop.png), [mobile study](screenshots/studio-study-mobile.png), [mobile tracker](screenshots/studio-tracker-mobile.png).

## Production migration rehearsal

All three additive Studio migrations were applied to an expiring copy of the production Neon branch. Row counts and sorted row-content fingerprints matched before and after for 20 existing learner tables. The rehearsal did not modify the production branch. No reset, destructive conversion or profile/roadmap replacement was used.

## Boundaries

YouTube pagination, batch metadata, cache, unavailable videos, missing-key fallback and quota errors are tested against mocked official API responses. Live playlist import requires a server `YOUTUBE_API_KEY`; no live Google quota was consumed during QA. The browser walkthrough uses custom learning items; it does not certify playback of every external YouTube video. Availability, embedding restrictions and network access remain controlled by YouTube.

AI chapter grouping and a remote code runner are optional future adapters. This release uses deterministic sectioning and isolated browser execution, with no additional mentor/Gemini calls. Python downloads the pinned runtime on first use. Browser-reported practice runs are learning activity, not trusted execution attestations. See [Learning Studio](LEARNING_STUDIO.md) for setup and data behavior.
