# SkillPath: Master Build Prompt

> Paste this whole file into your AI coding tool (Claude Code, Cursor, etc.) as the project brief.
> Build the project **phase by phase** (see Section 10), and **commit after every phase**.

---

## 0. Role and Instructions for the AI Builder

You are a senior full-stack engineer. Build **SkillPath**, an AI-powered personalised learning and career-gap dashboard, as a **portfolio / end-term project**.

Rules you must follow throughout:

1. Build a **functional, deployed application**, not a tutorial demo.
2. **Separate the codebase into `frontend/` and `backend/`** (monorepo). They communicate only through a REST API.
3. The AI must NOT be just "text box → LLM → display". All LLM calls must be wrapped in real engineering: input validation, structured output, schema validation, retries, persistence, and context building.
4. Choose complexity only where the product needs it. Do not add tech for the sake of a checklist.
5. Handle **loading, empty, success, and error states** in every screen.
6. Never hard-code or commit secrets. Use `.env` files and provide `.env.example`.
7. Make **small, meaningful Git commits** with clear messages (Conventional Commits, e.g. `feat(auth): add refresh token flow`). Never dump everything in one commit.
8. Write clean, typed, modular code with a sensible folder structure.
9. **Zero-budget constraint: every service, API, library and hosting platform used must be open source or have a genuinely free tier that needs no payment.** Do not add any paid API. If something needs a credit card or a trial that expires, pick an alternative.
10. Ask me before making any major deviation from this brief.

---

## 1. Product Overview

**Problem:** People who want a new job role or a new skill do not know *what* to learn, *in what order*, or *how much time it will take*. Existing resources are generic and not tied to the learner's current skills or available time.

**Target users:** Students, career switchers, and working professionals who want a structured, personalised path to a role or skill.

**Solution:** SkillPath takes the user's current skills, interests, and weekly time, then generates a role-specific roadmap, a week-by-week study plan, tracks everything they learn and build, offers an AI mentor chatbot aware of their progress, and issues verifiable certificates on completion.

### Core user flow

```
Sign up / Login
   ↓
Enter current skills (+ proficiency)
   ↓
Choose a target role  ──or──  take a short interest quiz (skippable)
   ↓
Role recommendation / confirmation
   ↓
Gap analysis (skills user has vs skills role requires)
   ↓
Roadmap generation (phases → topics → resources → projects)
   ↓
Set weekly hours + flexibility → personalised weekly plan
   ↓
Dashboard: do tasks, log learning, submit projects → progress updates
   ↓
Chat with AI mentor about progress
   ↓
Complete roadmap → generate shareable certificate
```

---

## 2. Key Features

1. **Authentication**: email/password signup and login, plus optional Google OAuth.
2. **Skill profile**: add skills with a proficiency level (Beginner / Intermediate / Advanced).
3. **Goal selection**:
   - Direct: pick a role or custom skill (e.g. "Backend Developer", "Learn Figma").
   - Guided: 6–8 question interest quiz → AI recommends top 3 matching roles with reasons. Skippable.
4. **Gap analysis**: compares user skills against the role's required skills and outputs a ranked list of gaps, with "strong areas to focus on" highlighted.
5. **Roadmap generation**: phases → topics → subtopics, with estimated hours, difficulty, curated resource suggestions, and capstone/mini projects.
6. **Personalised weekly plan**: built from hours per week, target deadline (optional), and flexibility mode (see Section 6).
7. **Progress tracking**: task completion, learning logs, project submissions (link/notes), streaks, per-skill and overall progress percentages, charts.
8. **AI mentor chatbot**: knows the user's profile, roadmap, and recent progress. Streaming responses, saved history.
9. **Re-planning**: if the user falls behind or changes weekly hours, regenerate the remaining plan without losing completed work.
10. **Certificates**: PDF generated on 100% roadmap completion (with required projects done), with a unique ID and a **public verification page**.
11. **Notifications**: weekly reminder / behind-schedule email via a background job.

---

## 3. Tech Stack

### 3.1 Frontend (`/frontend`)

| Concern | Technology |
|---|---|
| Framework | **React 18 + Vite + TypeScript** |
| Styling | **Tailwind CSS** + **shadcn/ui** components |
| Routing | **React Router v6** |
| Server state / data fetching | **TanStack Query (React Query)** |
| Client state | **Zustand** (auth session, UI state) |
| Forms + validation | **React Hook Form + Zod** |
| Charts | **Recharts** (progress, weekly hours, skill radar) |
| Chat streaming | Native `fetch` + `ReadableStream` (SSE) |
| Icons / toasts | **lucide-react**, **sonner** |
| HTTP client | **Axios** with interceptors (auth + error handling) |
| Testing | **Vitest + React Testing Library** |
| Deployment | **Vercel Hobby (free)** or **Cloudflare Pages (free, unlimited bandwidth)** |

### 3.2 Backend (`/backend`)

| Concern | Technology |
|---|---|
| Runtime / framework | **Node.js 20 + Express + TypeScript** |
| Database | **PostgreSQL** (open source). Local: Docker. Hosted: **Neon free tier** (512 MB, scales to zero) or **Supabase free tier**. Do NOT use Render's free Postgres (it expires). |
| ORM / migrations | **Prisma** |
| Authentication | **JWT** (short-lived access token + refresh token in httpOnly cookie), **bcrypt** for password hashing, optional **Google OAuth** via Passport.js |
| Authorization | Middleware: `requireAuth`, resource-ownership checks, `role` field (`USER` / `ADMIN`) |
| Validation | **Zod** on every request body, query, and param |
| LLM integration (free) | A **provider-agnostic `LLMProvider` interface** with these implementations, selected by env var: **(1) Groq free tier** running open-weight models (Llama 3.3 70B / Llama 4 Scout) via its OpenAI-compatible API, no credit card needed; **(2) Google Gemini free tier** (Flash / Flash-Lite models) as automatic fallback; **(3) Ollama** (open source, runs models locally, 100% free and offline) for development and tests. Use the official `openai` npm SDK pointed at Groq's base URL, and `@google/generative-ai` for Gemini. |
| Background jobs / scheduling | **node-cron** locally. In production, free hosts sleep when idle, so trigger jobs through a **GitHub Actions scheduled workflow** (free) that calls a secret-protected `POST /internal/jobs/weekly` endpoint. No Redis or BullMQ needed. |
| Email (optional, free) | **Nodemailer** with **Gmail SMTP (app password)** or **Brevo free SMTP tier**. Also build **in-app notifications** (stored in the DB), so email is a nice-to-have, not a dependency. |
| PDF certificates | **pdf-lib** or **PDFKit** + **qrcode** (QR links to verification page) |
| Security | **helmet**, **cors** (allow-list), **express-rate-limit**, input sanitisation |
| Logging | **pino** |
| API docs | **Swagger / OpenAPI** (`swagger-ui-express`) |
| Testing | **Vitest/Jest + Supertest** |
| Deployment | **Render free web service** (750 free hours/month; sleeps after ~15 min idle and cold-starts on the next request, so show a "waking up the server" loading state and keep it warm with the free GitHub Actions cron ping). Alternative: **Railway** ($5 monthly free credit, no credit card, always-on). |

### 3.2.1 Zero-Cost Summary

| Need | Free / open-source choice | Catch to handle in code |
|---|---|---|
| LLM | Groq free tier (open-weight Llama), Gemini Flash free tier as fallback, Ollama locally | Rate limits and daily quotas change often; free-tier prompts may be used for training |
| Database | Neon or Supabase free Postgres, Docker Postgres locally | 512 MB storage cap (Neon); Supabase pauses inactive projects |
| Backend hosting | Render free web service or Railway $5 monthly credit | Render sleeps when idle (cold start); Railway credit can run out |
| Frontend hosting | Vercel Hobby or Cloudflare Pages | None for a portfolio project |
| Email | Gmail SMTP or Brevo free tier, plus in-app notifications | Daily send limits |
| Scheduling | GitHub Actions cron | Minimum interval of about 5 minutes |
| PDFs, QR codes, auth, charts, ORM | pdf-lib / PDFKit, qrcode, bcrypt, JWT, Recharts, Prisma (all open source) | None |
| CI | GitHub Actions free tier | Minutes cap on private repos; keep the repo public |

Free-tier limits change without notice, so check the provider pages for current numbers before you build.

### 3.3 DevOps / Tooling

- **Git + GitHub** (meaningful history), **GitHub Actions** (lint + test on push)
- **Docker + docker-compose** for local Postgres and the backend
- **ESLint + Prettier + Husky** (pre-commit lint)

---

## 4. Repository Structure

```
skillpath/
├── frontend/
│   ├── src/
│   │   ├── components/      # reusable UI (ui/, charts/, layout/)
│   │   ├── pages/           # Login, Onboarding, Dashboard, Roadmap, Plan, Progress, Chat, Certificates, Verify
│   │   ├── features/        # auth/, skills/, roadmap/, plan/, progress/, chat/
│   │   ├── hooks/
│   │   ├── lib/             # api client, utils, zod schemas
│   │   ├── store/           # zustand stores
│   │   └── routes/          # route guards
│   ├── .env.example
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── config/          # env loader (validated with Zod)
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── skills/
│   │   │   ├── roles/
│   │   │   ├── quiz/
│   │   │   ├── roadmap/
│   │   │   ├── plan/
│   │   │   ├── progress/
│   │   │   ├── chat/
│   │   │   └── certificates/
│   │   ├── ai/              # llm client, prompts, schemas, context builder
│   │   ├── jobs/            # cron jobs
│   │   ├── middleware/      # auth, validate, rateLimit, errorHandler
│   │   ├── utils/
│   │   └── app.ts / server.ts
│   ├── prisma/schema.prisma
│   ├── tests/
│   ├── .env.example
│   └── package.json
├── docker-compose.yml
├── .github/workflows/ci.yml
└── README.md                # the PROJECT README (see Section 12)
```

Each backend module follows `routes → controller → service → repository (Prisma)`.

---

## 5. Data Model (Prisma, suggested)

- **User**: id, email, passwordHash, name, role, createdAt
- **Skill**: id, name, category (global catalogue; normalised names, e.g. "ReactJS" → "React")
- **UserSkill**: userId, skillId, level
- **Goal**: id, userId, targetRole, source (`DIRECT` | `QUIZ`), status
- **QuizResponse**: id, userId, answers (JSON), recommendedRoles (JSON)
- **Roadmap**: id, userId, goalId, title, totalEstimatedHours, status, version
- **Phase**: id, roadmapId, order, title, description
- **Topic**: id, phaseId, order, title, skillId, estimatedHours, difficulty, resources (JSON), isProject (bool), status
- **Plan**: id, roadmapId, hoursPerWeek, flexibilityMode, startDate, targetEndDate
- **PlanWeek**: id, planId, weekNumber, startDate, plannedHours, focusSummary
- **PlanItem**: id, planWeekId, topicId, allocatedHours, status (`TODO` | `IN_PROGRESS` | `DONE` | `SKIPPED`)
- **LearningLog**: id, userId, topicId?, minutes, note, loggedAt
- **ProjectSubmission**: id, userId, topicId, title, repoUrl/notes, submittedAt
- **ChatSession / ChatMessage**: id, userId, role (`user`/`assistant`), content, createdAt
- **Certificate**: id, userId, roadmapId, verificationCode (unique, unguessable), issuedAt, pdfUrl/storage key
- **Notification**: id, userId, type, sentAt

Add proper indexes (`userId`, foreign keys, `verificationCode`) and cascading deletes where appropriate.

---

## 6. Core Engineering Logic (the "not just an LLM wrapper" part)

### 6.1 Roadmap generation pipeline
1. Validate inputs (role, user skills, level) with Zod.
2. Normalise skill names against the `Skill` catalogue.
3. **Gap analysis** (deterministic): required skills for the role minus the user's skills (weighted by level).
4. Build a prompt with the gap list + user context and request **strict JSON** matching a schema.
5. **Validate the LLM output with Zod**. On failure, retry up to 2 times with the validation error appended.
6. Persist the roadmap, phases, and topics in a **database transaction**.
7. Return the roadmap; surface clear errors if the LLM or DB fails (never a blank screen).
8. Cache role requirement templates so repeated roles don't re-call the LLM unnecessarily.
9. **Free-tier resilience** (open-weight models are less reliable at JSON than paid frontier models, and free tiers are rate-limited):
   - Use the provider's JSON mode where available, keep schemas small, and generate the roadmap **phase by phase** if a single call is too large.
   - Handle HTTP 429 with exponential backoff, then **automatically fall back to the next provider** (Groq → Gemini).
   - Add a **per-user daily quota** (e.g. 3 roadmap generations, 30 chat messages) stored in the DB, with a clear message in the UI when exceeded.
   - Provide a **static fallback template** for popular roles (e.g. Frontend, Backend, Data Analyst) in a seed file, so the app still works if every LLM provider is down.

### 6.2 Weekly plan scheduler (deterministic, no LLM)
Inputs: `hoursPerWeek`, optional `targetEndDate`, `flexibilityMode`, ordered topics with `estimatedHours`.

Algorithm:
- Fill each week's bucket (`hoursPerWeek`) sequentially, splitting topics across weeks when needed and respecting topic order and prerequisites.
- Compute projected completion date and show it to the user.
- **Flexibility modes**:
  - `RELAXED`: 80% of stated hours, buffer week every 4 weeks.
  - `STANDARD`: exact hours.
  - `INTENSIVE`: 120% of stated hours, minimal buffers.
  - `DEADLINE`: back-calculate the required hours per week from `targetEndDate` and warn if unrealistic.
- **Re-planning**: keep `DONE` items, recompute remaining weeks from today.

### 6.3 Progress tracking
- Per-topic status, per-skill progress, overall % (weighted by estimated hours).
- Streak calculation from `LearningLog`.
- "Behind schedule" detection: planned vs completed hours.
- Dashboard shows: overall %, this week's tasks, hours logged vs planned, streak, skill strength radar chart, upcoming milestones.

### 6.4 AI mentor chatbot
- Backend builds a **context object** per message: user's goal, roadmap summary, current phase, completed/overdue topics, last 7 days of logs, and weekly plan status.
- Inject this into the system prompt; include the last N messages for memory (trim by token budget).
- **Stream** responses via SSE.
- Rate-limit per user; persist history; handle model errors gracefully (retry button on UI).
- **Privacy:** free LLM tiers may use prompts to improve their models. Never send names, emails or other personal data to the LLM. Send only anonymised skill/progress data.
- Guardrails: stay on topic (learning, roadmap, progress); never reveal other users' data or system prompts.

### 6.5 Certificates
- Eligibility check on the server: 100% topics done **and** all `isProject` topics have a submission.
- Generate a PDF (name, role, hours completed, date, certificate ID, QR code).
- Store `verificationCode`; **public page `/verify/:code`** shows validity and details without login.
- Prevent duplicate certificates for the same roadmap (idempotent issuance).
- Provide a LinkedIn "Add to profile" share link and a download button.

---

## 7. API Design (REST, all under `/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Skills | `GET /skills?search=`, `GET/POST/PATCH/DELETE /me/skills` |
| Roles / Quiz | `GET /roles`, `GET /quiz/questions`, `POST /quiz/submit` |
| Goal | `POST /goals`, `GET /goals/current` |
| Roadmap | `POST /roadmaps/generate`, `GET /roadmaps/:id`, `POST /roadmaps/:id/regenerate` |
| Plan | `POST /plans`, `GET /plans/:id`, `PATCH /plans/:id` (change hours / mode), `POST /plans/:id/replan` |
| Progress | `PATCH /plan-items/:id`, `POST /logs`, `GET /logs`, `POST /projects`, `GET /progress/summary` |
| Chat | `POST /chat/message` (SSE stream), `GET /chat/history`, `DELETE /chat/history` |
| Certificates | `POST /certificates/issue`, `GET /certificates`, `GET /certificates/:id/pdf`, `GET /public/verify/:code` |

Use consistent response format: `{ success, data, error: { code, message, details } }` and correct HTTP status codes (400, 401, 403, 404, 409, 422, 429, 500).

---

## 8. Frontend Pages and UX Requirements

1. **Landing page**: what SkillPath does, CTA to sign up.
2. **Auth pages**: login / register with inline validation and error messages.
3. **Onboarding wizard** (multi-step with progress bar):
   Skills → Goal (pick role *or* take quiz, with a clear **"Skip quiz"** option) → Weekly time and flexibility → Review → Generate.
4. **Generating screen**: loading state with meaningful step messages; error + retry state.
5. **Dashboard**: progress ring, this week's tasks (checkable), streak, hours chart, skill radar, next milestone.
6. **Roadmap page**: collapsible phases/topics, status badges, resources, project markers.
7. **Plan page**: week-by-week timeline, adjust hours/flexibility, "Re-plan" button with a confirmation dialog and a preview of the new end date.
8. **Progress page**: learning log form, history, charts, project submissions.
9. **Mentor chat**: streaming messages, suggested prompts ("How am I doing this week?"), copy, retry on failure.
10. **Certificates page**: list, download, share; locked state showing what remains.
11. **Public verify page**: `/verify/:code`.
12. **Cross-cutting**: responsive layout, dark mode, route guards, skeleton loaders, empty states, toasts, accessible forms.

---

## 9. Security and Error Handling Checklist

- Hash passwords with bcrypt (cost ≥ 10). Never store plain text.
- Access token in memory, refresh token in an httpOnly, secure, sameSite cookie.
- Validate **all** inputs with Zod (server-side is mandatory).
- Authorization on every resource: users can only access their own roadmaps, logs, chats, and certificates.
- Rate limiting on auth and chat endpoints. Helmet + strict CORS allow-list.
- LLM API key only on the backend, never exposed to the frontend.
- Central error-handling middleware with typed `AppError` classes. No stack traces in production responses.
- Handle: duplicate email, expired token, LLM timeout/invalid JSON, DB failure, duplicate certificate, invalid plan state, network failure on the frontend, empty data states.
- `.env.example` provided; `.env` in `.gitignore`. Add secret scanning (e.g. gitleaks) to CI if possible.

---

## 10. Build Phases (commit after each)

| Phase | Scope |
|---|---|
| 1 | Monorepo setup, linting, Docker Postgres, Prisma schema, CI skeleton |
| 2 | Auth (register/login/refresh/logout), protected routes on both sides |
| 3 | Skill catalogue + user skill profile UI and API |
| 4 | Goal selection + interest quiz + role recommendation |
| 5 | Gap analysis + LLM roadmap generation with validation and retries |
| 6 | Roadmap UI + plan scheduler + flexibility modes + re-plan |
| 7 | Progress tracking: tasks, logs, projects, streaks, dashboard charts |
| 8 | AI mentor chatbot with context builder and streaming |
| 9 | Certificate eligibility, PDF generation, public verification page |
| 10 | Background jobs (reminders), notifications |
| 11 | Tests (service logic: scheduler, gap analysis, eligibility; API tests), error-state polish |
| 12 | Deployment, project README, Swagger docs, demo seed data |

After each phase: run the app, fix errors, and write a clear commit message.

---

## 11. Testing Requirements

- **Unit tests**: scheduler (all flexibility modes, edge cases such as 0 hours), gap analysis, progress percentage, certificate eligibility, LLM output validator.
- **API tests** (Supertest): auth flow, unauthorized access (403/401), validation errors, duplicate certificate.
- **Frontend tests**: onboarding form validation, task toggle, error state rendering.
- Mock the LLM in tests. Never call the real API in CI.

---

## 12. Documentation Deliverables

Generate a **project README** (root `README.md`) containing:

1. **Project Name**
2. **Problem Statement**
3. **Target Users**
4. **Solution**
5. **Key Features**
6. **Tech Stack** (frontend and backend separately)
7. **Architecture** (diagram + explanation of the major components: client, API, DB, LLM service, scheduler, PDF service)
8. **Local Setup** (step-by-step, including Docker and migrations)
9. **Environment Variables** (table with name, purpose, example; no real secrets)
10. **Deployment** (live links + deploy instructions)
11. **API Documentation** link (Swagger)
12. **Screenshots / Demo video link**
13. **AI Usage note** (honestly state where AI tools were used)
14. **Limitations and future work**

If any significant part builds on an existing open-source project, credit it clearly.

---

## 13. Environment Variables (to document in `.env.example`)

**Backend**
```
NODE_ENV=
PORT=
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
CLIENT_URL=
LLM_PROVIDER=            # groq | gemini | ollama
LLM_MODEL=               # e.g. llama-3.3-70b-versatile (Groq) or a Gemini Flash model
GROQ_API_KEY=            # free, from console.groq.com
GEMINI_API_KEY=          # free, from Google AI Studio (fallback)
OLLAMA_BASE_URL=         # e.g. http://localhost:11434 (local dev)
CRON_SECRET=             # protects /internal/jobs/* endpoints
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
```

**Frontend**
```
VITE_API_BASE_URL=
VITE_GOOGLE_CLIENT_ID=
```

---

## 14. Definition of Done (Evaluator Checklist)

- [ ] App is deployed and publicly accessible; evaluators need no setup to try it
- [ ] Full flow works end to end: signup → skills → goal → roadmap → plan → progress → chat → certificate
- [ ] Data persists across sessions
- [ ] Auth and per-user authorization work
- [ ] Loading, empty, success, and error states handled everywhere
- [ ] No secrets in the repo or Git history
- [ ] Git history shows incremental development with meaningful commits
- [ ] README is complete; Swagger docs available
- [ ] Tests pass in CI
- [ ] Demo video (3–5 min) script ready: problem → users → onboarding → roadmap → plan → progress → chatbot → certificate → verify page

---

## 15. Demo Video Outline (for later)

1. 20s: the problem and who it's for
2. 60s: signup, skills, role/quiz, roadmap generation
3. 45s: weekly plan, flexibility change, re-plan
4. 45s: logging progress, dashboard updating
5. 45s: chatting with the mentor about progress
6. 30s: completing a roadmap, certificate download, public verification
7. 15s: tech stack and architecture in one slide

Show the product working. Do not spend the demo reading code.

---

**Now begin with Phase 1. After finishing each phase, summarise what was done, list files created, and wait for confirmation before moving to the next.**
