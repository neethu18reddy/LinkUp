# Career catalog audit — 1 November 2026

The existing application uses React 18, Vite, React Router, TanStack Query for server state, Zustand for authentication, and an Express/TypeScript API. PostgreSQL is accessed through Prisma 7. JWT access/refresh sessions, owner-scoped repositories, and transactional optimistic concurrency already protect saved learning data.

Catalog content is in `backend/prisma/data` and historical SQL migrations, not in components. Skills and role templates have stable UUIDs; user skills, goals, roadmap topics and progress reference them. Roles have weighted proficiency requirements. Rich descriptions, prerequisites, related skills, demand metadata, and role-family stages are missing. The UI guesses a role's category from its title, which misclassifies nontechnical roles.

The seven-question quiz scores five interest dimensions plus the count of existing skills, then returns three roles. It ignores proficiency and adjacent skills and only has affinities for the original roles. Direct skill entry has no recommendation view. Skill search handles normalization and exact aliases but caps results at 100 and has no fuzzy fallback or custom-skill entry.

Gap analysis computes weighted proficiency deficits correctly for direct requirements, but does not expand prerequisites. Template generation uses a hardcoded prerequisite-name list and two generic phases. It can schedule known skills again when no gaps remain. Resource coverage and role-specific projects are limited. Optional Gemini generation is bounded and falls back to templates; the prior Gemini-only model restriction and call budget must be preserved.

Goals, saved roadmaps, weekly plans, task progress, project evidence, learning logs, certificates and conversations are durable and versioned. Existing APIs and the purple card design should remain compatible. New data must be additive and preserve all existing UUIDs, user goals, historical roadmaps, and progress. No production mutation is part of this audit.
