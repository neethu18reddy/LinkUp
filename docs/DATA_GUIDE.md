# Maintaining the career catalog

## Files and identifiers

`backend/prisma/data/catalog/skills` and `roles` contain domain-split, validated JSON. Content IDs are kebab-case. `databaseId` is the permanent UUID used by user skills, goals and saved roadmap topics. Never change or recycle a database UUID. The original 32 skill and 24 role IDs remain valid.

`scripts/catalog-source.mjs` holds the editorial family taxonomy, `catalog-focus.mjs` holds role-specific focus skills and ownership hints, and `catalog-questionnaire.mjs` holds the guided questions. `catalog-resources.mjs` supplies selected official reference entry points. `npm run catalog:build` materializes formatted domain JSON. Review the generated diffs; generation is deterministic and does not make external AI calls.

The catalog currently has 2,252 skills, 326 roles, 42 families and 12 categories. A role must have 6–15 unique weighted requirements. Every skill must be referenced by at least one role. Synonyms belong in aliases; for example, Ethical Hacker is included under Penetration Tester. Keep broader occupations and narrower specialties separate only when their focus differs.

## Add or change content

1. Add a real skill to its family with a concise description, aliases, category, learning resources and estimated effort. Add prerequisites only when genuinely required. Use existing canonical IDs rather than alternate spellings.
2. Give a new role an appropriate family, explicit focus skills, one-line description, experience band, related roles and a concrete project brief. Review all generated optional requirements for relevance; ownership hints route platform-specific tools to appropriate specialists.
3. Run `npm run catalog:build` and `npm run catalog:validate`. The validator rejects duplicate names/IDs, missing skill/role references, orphan skills, cycles, count regressions and prerequisite-order errors in every roadmap.
4. Review a beginner and an experienced learner's roadmap. Known requirements must appear as strengths and be absent from newly scheduled skill tasks. Missing prerequisites are inserted automatically. Family templates produce five stages, with an additional judgment/leadership stage for senior roles. Every stage has a project and checkpoint; the final stage includes portfolio, resume and interview work.
5. Run tests, lint, typecheck and a production build. Add matching fixtures for materially different skill relationships or scoring behavior.

## Database changes

The first catalog migration inserts skills/roles and replaces only role-template requirements. It retains user profiles, goals, existing roadmap snapshots and learning progress. It has been tested against local PostgreSQL. Do not edit a migration after it has been applied to any shared environment. For later changes, run `npm run catalog:seed -- 20261102000100_catalog_update` with a new timestamped name, then review the diff before deployment. The generator refuses to overwrite a different existing migration. The seed generator is a build tool, not a runtime endpoint.

The richer editorial metadata stays server-side in JSON; existing database tables and public UUID contracts remain compatible. Custom skills are saved in a learner's profile and excluded from public search. They do not receive invented role mappings.

## Search, matching and delivery

The paginated `/career-catalog/roles` endpoint returns at most 48 summaries. Role details and stages are fetched on demand; the taxonomy is never imported into a frontend bundle. Skill search uses a prebuilt normalized index, aliases and bounded edit distance. `/roles?summary=true` keeps the original goal picker lightweight, while `/roles/:id` returns requirements only when selected. Original unfiltered API routes remain available for compatibility.

Matching multiplies weight by importance (core 3, important 2, nice-to-have 1) and the learner's proficiency ratio, capped at one. A missing requirement receives at most 15% credit from an explicitly related skill, and remains a gap. Results provide three main directions, five alternatives and up to three stretch roles. A profile with no recognized skills receives interest-led starting suggestions with 0% skill match.

Questionnaire answers are stored in the existing private quiz history. Self-reported tools are added at beginner level without downgrading existing levels. Interest, experience, weekly time, timeline and learning style remain available in saved answers. Weekly plans continue to require explicit pace selection. The original seven-question quiz and saved results remain compatible.

Completion is owner-scoped, transactionally updates the topic and active plan allocations, and survives reload. Stale changes and historical roadmaps are rejected; project milestones still require submitted evidence. Marking a topic complete does not erase or downgrade a previously reported skill.

## Local verification commands

Run `npm run catalog:validate`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. On machines with slow worker startup, `npm run test:local` limits concurrency, preserves per-file isolation and allows slower functional assertion scheduling without changing CI defaults or the matching performance assertion.

`npm run test:database` creates and removes a disposable loopback PostgreSQL database. `npm run test:career-browser` requires local migrations, a fresh production build and Chrome or Edge; it starts an isolated local server on port 4017, exercises both entry paths and completion after reload, captures screenshots, and removes only its own generated QA accounts. Both commands disable live AI, email and Google sign-in. Neither command deploys or changes production data.

## Editorial limitations and sources

Hours, durations and demand/trending labels are editorial learning estimates, not measured job-market rankings or hiring guarantees. Certification tracks do not grant credentials. Resources include official documentation homepages and established learning libraries; some offer both free and paid material. Check availability and subject relevance when adding or revising a skill; do not fabricate tutorial links.

Useful primary references for periodic review include the [O*NET Resource Center](https://www.onetcenter.org/database.html), [BLS Occupational Outlook Handbook](https://www.bls.gov/ooh/), and [Skills England occupational maps](https://occupational-maps.skillsengland.education.gov.uk/). These are background references, not a claim that every specialty has a separately measured demand forecast. The catalog taxonomy and descriptions are editorial content; no external dataset has been silently imported.
