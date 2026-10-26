# Learning mentor (Phase 8)

The owner deferred API setup until later. `/mentor` therefore uses a clearly labelled **offline rule-based mentor**. It can summarize saved progress and suggest steps for the next topic, scheduling, projects and learning logs. It does not perform AI inference, explain arbitrary subjects in depth or send anything to an external AI service. `MentorProvider` is an asynchronous streaming interface for a future separately approved integration; the runtime always defaults to `OfflineMentorProvider`, independently of roadmap provider settings. No new package or external service was needed.

## Context and privacy

Before every turn, the server reads the caller's owned progress snapshot and skill profile. Existing conversations use their linked roadmap; general conversations use the current roadmap when available. The context includes a role/roadmap title, completion counts/percentage, current phase, five upcoming topics, a small completed-topic sample, overdue hours, current-week tasks, seven daily learning totals, streak, remaining submissions and canonical skill levels.

Provider context excludes user/session/topic IDs, account identity, raw quiz answers, learning notes, project notes and links. Account name/email, email patterns and phone-like numbers are redacted from provider-bound strings. History is trimmed to twelve recent messages and at most 8000 characters; the combined context/question/history budget is bounded to 12000 characters, an approximate token budget rather than a tokenizer guarantee. These filters are preparation for a future integration, not a guarantee to remove every possible personal detail from free text. The UI asks learners to avoid personal data. Original questions and replies remain in the caller's private database history. They are not included in request logs.

Offline rules respond only to local learning/progress intents, decline requests for private data/system instructions, and redirect unsupported questions to learning topics. Replies use a current snapshot rather than making claims about unseen work. More detailed AI mentoring remains deferred.

## REST and SSE contracts

All endpoints are authenticated and ownership-scoped:

| Endpoint                    | Contract                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/v1/chat/sessions   | Latest 20 owned conversations; empty sessions after failed attempts may be included                                               |
| GET /api/v1/chat/history    | Required sessionId UUID; optional before position and limit (1–50, default 40); ascending messages and nullable nextBefore cursor |
| POST /api/v1/chat/message   | `{sessionId: uuid or null, requestId: uuid, expectedVersion: nonnegative integer, message: 1–1000 trimmed characters}`            |
| DELETE /api/v1/chat/history | Strict body `{sessionId: uuid}` deletes one owned conversation; `{}` deletes all owned conversations                              |

The frontend uses native fetch/ReadableStream for messages and Axios for history. It refreshes an expired token once **before** streaming, never automatically restarts a partially received response, aborts on unmount, rejects account changes, decodes fragmented UTF-8/CRLF SSE frames, and bounds frame/output sizes.

Successful message responses use `text/event-stream`, no-store/no-cache/no-transform and disabled proxy buffering. Events are JSON payloads framed with `event:` and `data:` lines:

- `meta`: owned session metadata and `mode` (`offline` in this build).
- `delta`: reply text chunks. These remain labelled unsaved until completion.
- `done`: saved session/version and the user/assistant message pair. This is the persistence acknowledgement.
- `error`: safe code/message if generation or persistence fails after headers. Earlier failures use the normal JSON error envelope.

Heartbeat comments occur every ten seconds. Responses respect backpressure, a 30-second server timeout, 45-second client timeout and a 12000-character output bound. Stop/disconnect cancels generation where possible. A turn already committing may still save; retry or reload recovers it. Abrupt/truncated responses without done are errors, not successful saves.

## Persistence, retries and concurrency

Migration `20261027000800_mentor_turns` adds per-session versions, temporary lease fields, turn request IDs, ordered message positions and unique constraints. Existing message positions are backfilled by timestamp/ID; existing sessions receive the corresponding message count as their version.

New conversation IDs use the first request's UUID so retries can find the same session. The server reserves a per-user daily attempt and a per-conversation lease transactionally, then generates outside the transaction. A second simultaneous turn returns CHAT_BUSY; stale expectedVersion returns HISTORY_CHANGED. Leases expire after 90 seconds and use fresh random tokens, so a replaced/expired stream cannot later commit.

The user question and complete assistant reply save together in one serializable transaction. Partial output and failed questions are not saved as dangling messages; the UI retains the unsaved question for retry. Successful retries with the same requestId replay the original saved reply and do not consume quota or invoke the provider again. Reusing a saved request ID with changed content is rejected. History versions advance by two message positions per saved turn. Conflicts retry with bounded backoff, including PostgreSQL adapter COMMIT conflicts.

There are ten requests per user per minute and **30 reserved attempts per UTC day**, persisted in DailyUsage. Failed/cancelled attempts after reservation consume quota; successful replay does not. The short-window limiter still counts replay requests. Deleting history does not reset quota. Clearing/deleting a session prevents in-flight writes from recreating it; old message rows cascade away. The UI explicitly confirms deletion. Only owned history is ever read or deleted.

## Verification and limits

Unit/API tests cover identity redaction, bounded history, local intent responses, request validation, streaming, replay, cancellation, output limits, quota and ownership. Frontend tests cover fragmented UTF-8/SSE, truncated/error streams, auth refresh, suggestions, history restoration, stop/retry IDs, explicit delete confirmation and ignoring delayed history after switching conversations. PostgreSQL tests cover ordered durable pairs, paging, private reads, quota/concurrent reservations, provider failure without partial messages, deletion during a turn and expired-lease writers. Providers in tests are offline or mocks.

The UI lists twenty recent sessions; full session histories remain addressable by owned IDs and cursor paging. There is no automatic external-provider fallback or live AI chat enabled by env variables. Dark mode and final deployment polish remain later work. Local browser QA uses a disposable in-memory API; production defaults remain PostgreSQL. Database migrations and integration tests run in GitHub CI because Docker is unavailable locally.
