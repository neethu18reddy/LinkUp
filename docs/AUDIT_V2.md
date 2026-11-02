# Learning Studio audit — 2 November 2026

The app uses React 18, Vite, React Router, TanStack Query and Zustand, with an Express/Zod API and Prisma/PostgreSQL. The working tree was clean at the start of this work. The existing catalog contains 2,252 skills and 326 careers with stable database UUIDs and prerequisite-aware roadmaps.

`RoadmapPage` renders a long gap list followed by every stage expanded. Completion lives in `Topic.status` and active `PlanItem.status`; profile proficiency lives separately in `UserSkill`. `PrismaProgressRepository` provides owner-scoped, serializable completion transactions and requires project evidence. Existing saved roadmaps are versioned snapshots. The dashboard reads the current roadmap and weekly plan; its learning streak currently uses UTC learning logs.

There are no imported learning resources, watch sessions, timestamped notes, snippet versions, per-resource analytics, user timezone preferences or daily recaps. Adding independent counters to the UI would create conflicting progress sources. The existing daily job is secret-protected and has a bounded cursor; it can also finalize Studio recaps without replacing reminders.

Compatibility constraints: preserve authentication, original quiz, role catalog, Gemini limits, learning logs, weekly planning, project verification, certificates and historical roadmap snapshots. Do not reset, rename or recycle existing IDs. Keep provider API keys server-side. Code execution needs an isolated origin plus a terminable worker; an ordinary same-origin worker alone cannot protect application storage or credentials.
