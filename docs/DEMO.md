# Local demo and recording script

Demo records are clearly illustrative. They are not real learning evidence, accredited results or live AI output. There is no default/shared password, no automatic seed at startup and no production seed route.

## Seed a migrated local database

1. Follow the README local setup and apply migrations.
2. In ignored `backend/.env`, set `DEMO_SEED_EMAIL` (default `demo@linkup.example.invalid`) and a private `DEMO_SEED_PASSWORD` of at least 12 characters. Do not paste credentials into Git or a recording.
3. Run `npm run db:seed:demo` from the repository root, then `npm run dev`.
4. Sign in with those locally configured credentials.

Alternatively, `npm run setup:demo` generates a private password only when `DEMO_SEED_PASSWORD` is missing or empty, then `npm run db:seed:demo` creates the sample records. This does not reset an existing account password. Windows x64 users without Docker can use the optional portable PostgreSQL commands in the README.

The seed creates one dedicated demo user, a Python proficiency/goal, a two-week partial roadmap/plan, three dated logs, illustrative project evidence, an offline chat pair and one reminder. Records are written atomically. Reruns do nothing and do not reset passwords or progress. A collision with another account is rejected. Seeding refuses production mode. If you change the password setting after the first run, the existing login password remains unchanged; normal account records are never overwritten.

No certificate is pre-issued: complete all allocations through Weekly plan and review the illustrative project evidence first. Certificate issuance still requires the UI acknowledgement that the name becomes public to holders of the link. The seed's full name is `linkup Demo Learner` so shared preview results are identifiable as examples. Local QR links work only against the configured local origin until an approved deployment exists.

For a fresh onboarding recording, use a separate newly registered account. Do not change the seeded account's goal midway and expect the same seeded roadmap to remain the current goal; normal goal/version rules still apply.

## Three-to-five-minute recording outline

| Time      | Show                                           | Suggested narration                                                                                                                                        |
| --------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:20 | Landing page                                   | Learners need a clear sequence and a realistic weekly plan. linkup connects starting skills to a goal.                                                     |
| 0:20–1:10 | Fresh signup/profile, goal or quiz, roadmap    | Add skills and proficiency, choose a role or catalogue skill, then review gaps and the curated roadmap. Explain that live AI is not enabled.               |
| 1:10–1:50 | Weekly plan preview/save/replan                | Compare flexibility modes and workload warnings. Saving requires reviewing the preview; completed work survives replanning.                                |
| 1:50–2:35 | Logs, project evidence and dashboard           | Record a short learning session, show project evidence and mark tasks complete. Charts and streaks use the recorded data.                                  |
| 2:35–3:10 | Mentor and inbox                               | Ask about next steps and progress. Label the response as offline guidance; show saved history and reminder preferences.                                    |
| 3:10–3:50 | Finished roadmap, certificate and verification | Complete remaining tasks, acknowledge public name disclosure, download the PDF and open the public verification link. Explain learner-reported completion. |
| 3:50–4:10 | Reopen one task                                | Show that current validity becomes inactive until requirements are met again.                                                                              |

The seeded workspace is an alternative shortcut for the plan/progress/mentor segment; explain that the sample data was seeded. Hide passwords, browser credential prompts, provider dashboards and secrets. Do not claim live deployment, live AI or email delivery until those actually exist.

## Screenshots and video status

README screenshots were captured from disposable local QA accounts. They are committed under `docs/screenshots/`. No demo video has been recorded, uploaded or published. The owner can record this outline locally and provide a video link later; publishing remains a separate decision.
