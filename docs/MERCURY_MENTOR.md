# Mercury mentor and Gemini fallback

The mentor can use Inception Mercury 3 first and Google Gemini second. This is a mentor-only override: existing roadmap generation continues to use `LLM_PROVIDER`. Existing sessions, learning context, ownership, per-user limits and message replay remain intact. No database migration is needed.

## Vercel configuration

In the **linkup** project, open **Settings → Environment Variables**, select **Production**, and set:

| Name                       | Value                           |
| -------------------------- | ------------------------------- |
| `MENTOR_PROVIDER`          | `inception`                     |
| `MENTOR_FALLBACK_PROVIDER` | `gemini`                        |
| `INCEPTION_API_KEY`        | A new private Inception key     |
| `GEMINI_API_KEY`           | The existing private Google key |
| `LLM_LIVE_CALLS_APPROVED`  | `true`                          |

Save, then redeploy the latest production commit. Keep the existing `LLM_PROVIDER` and `LLM_MODEL` values for roadmap configuration. Never prefix these secrets with `VITE_`, commit them or paste them into chat. Revoke any key previously shared in chat and use its replacement. The application does not contain or install a real Inception key.

For local development, put the same values in the ignored `backend/.env` and restart the backend. `MENTOR_PROVIDER=inherit` (the default) preserves the previous provider selection. `MENTOR_PROVIDER=disabled` forces offline mentor guidance. `MENTOR_FALLBACK_PROVIDER=disabled` disables fallback; that is the default. Fallback configuration applies only when the mentor provider is `inception`. `LLM_LIVE_CALLS_APPROVED=false` prevents all live mentor calls regardless of keys.

## Requests and fallback

The existing authenticated `POST /api/v1/chat/message` remains the client entry point. The server sends anonymized learning context, bounded history and the question to `https://api.inceptionlabs.ai/v1/chat/completions` using the existing OpenAI-compatible client. Mercury is pinned to `mercury-3`, `reasoning_effort=low`, streaming enabled and `max_completion_tokens=1800`. No model or base-URL override is accepted from the browser. SDK retries are disabled.

One Mercury attempt has a 10-second deadline covering the request and the complete response stream. If it fails or ends without meaningful text before any answer is emitted, the server makes at most one Gemini attempt with a 15-second deadline. Both respect the existing 30-second overall chat deadline and cancellation signal. Whitespace alone does not count as an answer. Authorization, quota, model, transport and server errors can trigger fallback. Provider diagnostics and credentials are never returned to learners.

Once reply text has been emitted, a later failure returns the existing safe error and does not mix in a second model's answer. Failed partial answers are not committed as successful turns. A retry after a successful saved turn replays the saved answer without another provider call. SSE `meta` updates identify fallback before its first text; the saved assistant message records the actual responding provider. Provider selection is local to each turn, not mutable shared state.

Gemini remains pinned to `gemini-3.5-flash-lite`, with the existing 1,800-token mentor output limit and shared in-process budget: one active Google request, five attempts per rolling minute, 50 per rolling day, and a one-minute cooldown after Google HTTP 429. These are application limits, not a deployment-wide spending guarantee; Google account/model access and provider quotas still apply. A fallback attempt counts against the same budget as other Google calls. Mercury uses the existing durable per-user mentor limit and endpoint rate limit.

If the explicitly enabled provider lacks its required key, startup fails with a configuration error instead of silently presenting an offline reply as live AI. Configure the keys and switches together before redeploying.

## Verification

Tests use fake credentials and controlled SDK/HTTP streams. They cover pinned parameters, no automatic retries, primary success, HTTP failures, empty output, timeout, cancellation, partial-stream failure, Gemini budget denial, safe errors and authenticated SSE/history persistence. No paid inference or real provider key is needed for CI.

Implementation verification on 3 November 2026: 53 targeted provider/chat unit tests and six chat database integration tests passed. Formatting, lint, workspace type checks and the production build passed. Concurrent turns preserved independent provider labels; saved fallback answers replayed without duplicate provider calls. Existing bundle-size advisories remain unchanged.

After adding the replacement key privately, start a fresh mentor conversation. Check a short explanation and a follow-up, then reload to confirm history. Live Mercury account access and answer quality require that final configured deployment; mock tests do not establish them. Do not deliberately exhaust a provider's quota to test fallback.

Official reference: [Inception quick start](https://docs.inceptionlabs.ai/get-started).
