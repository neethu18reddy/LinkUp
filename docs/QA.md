# Career catalog verification — 1 November 2026

## Scope

Verified the repository implementation locally. No production deployment or production database migration was performed. The earlier Gemini model restrictions and request boundaries remain in place. Catalog roadmap generation uses deterministic templates and does not spend the Google API quota.

## Data and compatibility

- 2,252 skills, 326 roles, 42 roadmap families and 12 categories.
- All 287 requested role titles and categories are covered, including documented merge aliases.
- Every role has 6–15 weighted requirements. Every skill has a role reference. The validator checks identifiers, references, prerequisite cycles and all 326 generated roadmap orders.
- Original skill and role UUIDs are preserved. Forward migrations upsert catalog templates; saved learner profiles, goals and roadmap snapshots are retained.
- All 47 database regression tests passed across 14 files. The runner created a fresh loopback PostgreSQL database, applied every migration, exercised the stories, and removed that database afterward. This includes the original learning/account flows and the new catalog, onboarding, custom-skill and completion flows.

## Browser evidence

The production-artifact browser helper exercises two fresh accounts with live AI, email, OAuth and jobs disabled. It removes only its generated accounts after the run.

- Guided onboarding: eight answers saved, suggested goal confirmed, five-stage roadmap generated, topic completion retained after reload.
- Direct entry: alias search (`reactjs`), multiple selected skills saved, recommendations displayed.
- Manual exploration: role search, category filtering, pagination and role details.
- Mobile viewport: 390px wide with no horizontal overflow.
- No browser page errors in the completed flow.

Screenshots: [catalog desktop](screenshots/career-catalog-desktop.png), [roadmap desktop](screenshots/career-roadmap-desktop.png), [catalog mobile](screenshots/career-catalog-mobile.png).

## Quality boundaries

Catalog files stay on the server. Role pages return bounded summaries and load details separately. Matching has a full-catalog performance assertion with a large profile. New status text uses explicit labels as well as color; reviewed status contrast exceeds AA for normal text. Browser and source checks do not constitute a complete assistive-technology audit.

Demand, trending and learning-duration values are editorial estimates. Resources use real official or established entry points; availability and individual course quality require continuing editorial review.

The existing main frontend bundle is above Vite's 500 kB warning threshold. The new career pages are separate lazy chunks; the catalog is absent from the client bundle. Existing third-party annotation and PostgreSQL client deprecation warnings are non-fatal and do not represent verified application failures.

## Closing command results

- `npm run catalog:validate`: passed, including all role roadmap orders and requested-title/category coverage.
- `npm run format:check`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run typecheck`: passed for frontend and backend.
- `npm run build`: passed, including Prisma client generation and the production frontend build. Career browser and detail chunks are approximately 6.7 kB and 6.4 kB respectively before compression.
- `npm run test:database`: 47 tests passed in 14 files; disposable database removed.
- Frontend isolated unit run: 102 tests passed in 21 files.
- `npm run test:career-browser`: passed against the final production artifacts; both entry paths, reload persistence, mobile overflow and browser errors checked.
- Backend isolated unit rerun: 178 tests passed in 18 files. Its 47 database tests were skipped in this unit run and passed separately in the disposable database run above. The initial threaded Windows worker exited with native status `3221226505` before reporting results; the local helper now uses process isolation for the backend and thread isolation for frontend tests.

The unit and database runs cover 327 passing tests in total. Browser assertions are additional. During development, VM/shared-worker attempts exposed test-environment limitations; the closing unit results use per-file isolation. The slow-machine helper allows longer functional scheduling deadlines without changing CI defaults or removing the scoring performance assertion.
