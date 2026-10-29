# Mentor correction — 29 October 2026

All changes are local; no push or deployment was performed.

## Findings and corrections

- Local `backend/.env` selects the disabled provider, disallows live calls, and has no Gemini key. It was producing keyword-based replies, not model-generated tutoring. Production's public auth options report `mentorMode: gemini`; that is configuration evidence, not proof of model quality.
- Offline mode no longer advertises quizzes or detailed explanations. Unsupported tutoring questions receive an explicit limitation instead of an unrelated next-task checklist.
- AI instructions now prioritize the actual question, worked examples, code diagnosis, follow-up context, and one-question-at-a-time quizzes. Roadmap context is background, not a substitute for an answer.
- Previously, an oversized recent answer could discard the entire history budget. Bounded truncation now retains the preceding learner question.
- The client retains the reserved conversation from the stream metadata so interrupted first replies can be recovered through history.
- Provider quota, authentication, and model errors now have distinct safe messages; provider diagnostics and credentials remain private.

## Verification

- 19 targeted frontend tests passed.
- 26 targeted backend tests passed, including provider transport, conversation lifecycle, history budgeting, and offline behavior.
- Type checks, lint, and backend/frontend production builds passed. The existing large-bundle warning and third-party annotation warnings remain non-blocking.
- Playwright exercised local login, mentor send/save, history after reload, a controlled HTTP 429, successful retry, and mobile overflow at 390px.
- Browser errors were the expected unauthenticated refresh before login and the deliberately simulated quota error.
- Actual Gemini output quality is **not live-verified**. Provider tests use controlled responses; prompt tests do not prove model quality.

## Enabling real tutoring in the local preview

Set the existing server-side fields in `backend/.env`: `GEMINI_API_KEY`, `LLM_PROVIDER=gemini`, `LLM_MODEL` to an available Gemini model, and `LLM_LIVE_CALLS_APPROVED=true`. Restart the local backend. Never put the key in frontend variables or commit it.

After enabling it, start a fresh conversation and check: a worked explanation of closures; a follow-up asking why the example works; and a quiz that waits for each answer. The live site will continue using its previous code until publication is authorized.
