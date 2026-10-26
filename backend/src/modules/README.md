# Backend feature modules

Add each module in its corresponding build phase: `auth`, `skills`, `roles`, `quiz`, `goals`, `roadmap`, `plan`, `progress`, `chat`, `certificates`, and `notifications`.

Use `routes → controller → service → repository`. Validate route bodies, query strings, and parameters with Zod. Services enforce ownership; repositories contain Prisma queries. Do not add external provider integrations without the owner's approval.
