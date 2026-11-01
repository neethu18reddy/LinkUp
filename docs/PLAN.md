# Career expansion plan — 1 November 2026

## Scope and assumptions

Implement the supplied build brief within the existing stack, phase by phase. Preserve the previous Gemini restrictions. Catalog demand/trending flags are editorial exploration signals, not employment statistics or salary promises. Distinct specialties can share a family template, but must have role-specific skills, project briefs, and readiness criteria. Merge synonymous labels using aliases and record coverage. Do not reset saved user work or deploy an unverified migration to production.

## Architecture

1. Audit and plan: document current flows and compatibility constraints before coding.
2. Add Zod catalog schemas, inferred types, reference/uniqueness/cycle validation, and a CI validator. Store content in domain-split JSON with kebab-case content IDs and a separate stable database UUID. Existing UUIDs remain unchanged.
3. Expand the skill taxonomy by domain, with real concepts/tools, normalized aliases, explicit prerequisites, descriptions, hours, and curated resource collections. Every skill must be relevant to a role; avoid count-only filler.
4. Add 300+ weighted roles, preserving all existing roles; validate 6–15 requirements per role and every listed role/merge. Derive database seed SQL deterministically from the validated catalog, without deleting user records.
5. Build five-stage family roadmaps with role-specific projects, checkpoints, job-readiness content and duration estimates. Expand missing prerequisites and topologically sort; known requirements are shown as strengths and omitted from new study tasks. Retain custom-goal fallback behavior.
6. Add a pure weighted recommendation engine (levels, importance, adjacent credit, stable tie breaking), direct-skill recommendations, three main results, five alternatives, and stretch directions. Extend guided scoring to every domain while retaining old quiz IDs/results.
7. Store the questionnaire as data; include experience, tools, interests, time, timeline and learning preferences. Keep direct search and guided paths. Make alias/fuzzy search, category navigation, selected chips and custom skills usable with large data.
8. Add paginated role browsing, explicit category metadata, sorting/trending, a role detail route, accessible gap indicators, roadmap completion controls and dashboard continuity. Preserve existing card styling and routes.
9. Check bundle boundaries, server-side search/pagination, scoring performance, focus/labels, contrast and mobile overflow. Run the React quality checklist after component changes.
10. Verify validator, lint, typecheck, unit/integration tests, migration on a local database, production build and key browser flows. Record actual results and outstanding verification limits honestly.

## Compatibility and delivery

Use existing tables for catalog skills/roles and requirement weights; keep richer editorial metadata in the validated catalog, joined by stable IDs. Use additive migrations only; no old migration edits. Existing saved roadmaps remain snapshots. Catalog completion uses existing owner-scoped progress transactions and project evidence requirements. Catalog files stay server-side; clients request bounded results and role details. Commit each verified phase, including only files for that phase; preserve unrelated user changes.

## Progress

- Phases 0–4: audit, schemas, validation and domain catalogs implemented. The catalog has 2,252 skills, 326 roles, 42 families and 12 categories; the coverage manifest checks every requested occupation and category.
- Phase 5: five-stage family roadmaps implemented, with six stages for senior roles, role-specific projects, missing prerequisites and proficiency-aware gaps.
- Phase 6: weighted matching implemented with partial levels, adjacent credit, three recommendations, five alternatives and stretch roles; mathematical fixtures and a full-catalog performance assertion cover the engine.
- Phase 7: eight-question guided onboarding and direct multi-select skill entry implemented, including aliases, fuzzy search, private custom skills and saved answers. The legacy quiz remains available.
- Phase 8: paginated browsing, role details, gap indicators, completion controls and dashboard continuity implemented in the existing design language.
- Phase 9: catalogs remain server-side; role summaries and details load separately. Reviewed React component structure, accessible labels/focus, status contrast and 390px mobile overflow. Production browser checks passed for both entry paths and completion after reload.
- Phase 10: final verification passed: 102 frontend unit tests, 178 backend unit tests, 47 database tests, catalog validation, formatting, lint, both type checks, production build and both browser entry paths. Detailed evidence and limits are recorded in `docs/QA.md`.

No deployment or production database changes are included. The local verification helpers disable external AI, email and OAuth calls and remove their own disposable fixtures.
