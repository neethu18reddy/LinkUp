# Roadmap generation (Phase 5)

The `/roadmap` screen compares the signed-in learner's persisted skills against their current goal. Level values are Beginner=1, Intermediate=2, Advanced=3; missing=0. Gap priority is `max(required-current, 0) * weight`. Skills meeting the requirement appear as strengths. Gaps sort by priority; template topics use prerequisite order independently.

Six seeded roles work offline. Frontend Developer, Backend Developer, and Data Analyst have cached role-specific project blueprints in `backend/prisma/data/roadmap-templates.json`; other roles use a general applied project. Custom goals must resolve to one catalogue skill, including aliases, optionally prefixed with "Learn". Unsupported custom goals return a clear 422 before quota consumption. Requirements come from persisted role mappings and canonical skill IDs; model-provided unknown IDs are rejected.

## API

All endpoints require authentication and return `Cache-Control: no-store`:

| Endpoint                             | Behaviour                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| GET /api/v1/roadmaps/current         | Current goal ID, ranked analysis, latest roadmap or null, active provider                                |
| POST /api/v1/roadmaps/generate       | Strict body `{ "goalId": "uuid" }`; creates a new version (201)                                          |
| GET /api/v1/roadmaps/:id             | Owned roadmap with ordered phases/topics; other owners receive 404                                       |
| POST /api/v1/roadmaps/:id/regenerate | Strict empty body `{}`; generates a version using the current profile, only if that goal is still active |

Hours are numeric and totals are computed by the server. Roadmaps remain DRAFT until the planning phase. Old versions and their future progress records are preserved. Three generation **attempts** per user per UTC date are reserved atomically in DailyUsage before provider calls; failures after reservation consume an attempt. This bounds paid-provider risk even though only free-tier use is intended. Goal changes during generation return 409. Nested writes roll back together. Serializable transactions retry unique/serialization conflicts.

## Prepared Groq adapter — live calls disabled

The owner approved preparing Groq, **not making a live call**. No provider key has been requested or read, and no live inference was performed. The default is `LLM_PROVIDER=disabled` and `LLM_LIVE_CALLS_APPROVED=false`. A key alone cannot enable the adapter.

After explicit approval, place a free-tier Groq key only in the ignored backend `.env`, select a model available to that account using `LLM_MODEL`, and enable both switches. Never paste keys into chat or commit them. Restart the backend. Free-tier models and limits must be checked for that account before activation; no payment or card should be enabled. No default model is hard-coded because availability changes.

The adapter uses the official `openai` SDK with Groq's fixed HTTPS base URL. JSON mode provides syntax constraints; Zod still validates strict shapes, lengths, levels, half-hour estimates, safe HTTPS resources, and at least one project. Unknown skill IDs and missing gap coverage cause a retry. At most three requests occur, with validation feedback for malformed output and exponential backoff on 429. Each request times out after 20 seconds. Provider failure, invalid output, or exhaustion saves a labelled curated fallback. Generated resource URLs outside the curated allowlist are removed. No raw provider errors or prompts are logged or returned.

Prompts contain only canonical role/skill descriptions, current/required levels, and curated resources. They exclude account names, emails, user IDs, quiz answers, and raw custom-goal text. No Gemini/Ollama or other provider is contacted automatically; they require separate approval.

Official references checked while preparing the adapter: [Groq structured output](https://console.groq.com/docs/structured-outputs), [API reference](https://console.groq.com/docs/api-reference), [available models](https://console.groq.com/docs/models). Structured output support varies by model, so this adapter uses JSON mode plus application validation.

## Verification

Mocked provider tests exercise malformed JSON, invalid schemas, unknown IDs, bounded retries, rate-limit backoff, privacy, and fallback. React tests exercise pending, review/cancel/confirm, generation failure/retry, and context-error recovery. PostgreSQL CI tests exercise nested persistence, version preservation, ownership, concurrent daily quota enforcement, stale inputs, and transaction rollback. No real LLM is called in CI.

Local Docker/PostgreSQL is unavailable on this machine, so database tests run against the ephemeral PostgreSQL service in GitHub CI. The in-app browser timed out attaching again; visual browser QA is unverified. Automated UI tests and production builds passed.
