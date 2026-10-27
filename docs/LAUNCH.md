# Vercel + Neon launch

The owner approved free hosting, AI mentor/roadmaps, email features and Google login. Vercel Hobby and Neon Free are the selected path. Both have usage limits; no provider guarantees lifetime-free service. No production service is claimed until deployment and HTTPS smoke checks succeed.

## What you need to do

1. Install/connect **Vercel** and **Neon** in Codex. If connecting manually, sign into https://vercel.com and https://console.neon.tech. Choose personal/free plans, not trials or paid upgrades.
2. In Neon, create a PostgreSQL 16 project near the Vercel region. Keep connection encryption enabled. Copy both the pooled and direct connection strings into private Vercel environment fields, never into chat or Git.
3. Import the GitHub repository neethu18reddy/LinkUp into Vercel. Use the repository root, framework Other, Node.js 24 and the checked-in vercel.json settings. The frontend and API share the same origin.
4. Configure the environment table below for **Production**. Keep previews disconnected from the production database; production build migrations are explicitly skipped on preview builds.
5. Deploy. Share only the resulting public URL. Live registration, login/refresh, streamed mentor, full learning flow, certificate PDF and QR verification still need to be checked against that URL.

## Private Vercel environment settings

| Field                   | Value                                                                         |
| ----------------------- | ----------------------------------------------------------------------------- |
| DATABASE_URL            | Neon pooled connection string with TLS enabled                                |
| DATABASE_URL_UNPOOLED   | Neon direct connection string for checked-in migrations                       |
| JWT_ACCESS_SECRET       | A new cryptographically random secret, at least 32 characters                 |
| JWT_REFRESH_SECRET      | A different new random secret, at least 32 characters                         |
| NODE_ENV                | production                                                                    |
| SERVE_WEB               | false (Vercel CDN serves frontend assets)                                     |
| TRUST_PROXY_HOPS        | 1; verify against the actual platform forwarding behavior during smoke checks |
| PUBLIC_WEB_URL          | Exact production HTTPS origin, e.g. https://your-project.vercel.app           |
| CLIENT_URL              | The same exact production HTTPS origin                                        |
| VITE_API_BASE_URL       | /api/v1                                                                       |
| LLM_PROVIDER            | disabled until AI credentials are configured                                  |
| LLM_LIVE_CALLS_APPROVED | false until AI credentials are configured                                     |
| LOCAL_JOBS_ENABLED      | false; serverless deployments need request-triggered scheduled jobs           |

The origin can default to Vercel's platform-provided stable production URL. Explicit PUBLIC_WEB_URL and CLIENT_URL are recommended for a custom domain. Never derive allowed origins from an incoming Host header. Preview URLs are not automatically trusted.

The build compiles both workspaces, then runs Prisma migrations through the direct Neon connection only for a Vercel production deployment. The single API function exports Express without opening a server or starting background timers. Function packaging includes generated Prisma code, catalogue templates, local Swagger assets and PDF fonts. The CDN serves the built frontend and SPA deep links.

## Costs and limits

- Vercel Hobby is for personal/non-commercial projects and has request, compute and bandwidth quotas: https://vercel.com/docs/plans/hobby.
- Neon Free currently has no fixed trial expiry, but storage/compute quotas apply: https://neon.com/pricing.
- AI and email providers have separate account and usage limits. Free app hosting does not make those providers unlimited.
- Export your database periodically and before changing provider plans. Keep private backups outside Git. A free tier is not a backup strategy or an uptime guarantee.

## External feature setup

### AI mentor and roadmaps

#### Gemini (selected provider)

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
   Confirm the project has free-tier access and keep paid billing disabled for this demo.
2. In Vercel's private **Production** environment settings, set `GEMINI_API_KEY`
   to that key, `LLM_PROVIDER=gemini`, `LLM_LIVE_CALLS_APPROVED=true`, and
   `LLM_MODEL=gemini-3.1-flash-lite` if that text model is available to your account.
   Check the current [models](https://ai.google.dev/gemini-api/docs/models) and
   [free quotas/pricing](https://ai.google.dev/gemini-api/docs/pricing); availability changes.
3. Redeploy the latest `main` commit after saving the settings. Do not put this
   key in `GROQ_API_KEY`, any `VITE_` variable, chat, screenshots or Git.
4. Confirm `/api/v1/auth/options` reports `mentorMode: "gemini"`, then test
   a simple mentor question and a career-role roadmap. Learner questions, recent
   history and anonymised context are sent to Google. Free-tier data handling
   follows Google's terms; avoid private information.

Gemini uses Google's official OpenAI-compatible endpoint through the existing
client. Both provider/approval switches are required; offline mode stays the
default. Structured output is validated before storage, with template fallback.
Custom goals without catalogue skill requirements retain their general starter roadmap.
Google OAuth credentials are separate from the Gemini API key.

#### Groq (alternative)

1. Sign in at [Groq Console](https://console.groq.com/) and open [API keys](https://console.groq.com/keys). Create a key for linkup. Keep the account on its free tier; do not add billing or enable a paid model unless you later choose to pay.
2. In Vercel's private Production Environment settings, set `GROQ_API_KEY` to that key and `LLM_MODEL` to a text model available to your account. Confirm its access and free quota in the provider console; model availability can change. See [supported models](https://console.groq.com/docs/models).
3. Set `LLM_PROVIDER=groq` and `LLM_LIVE_CALLS_APPROVED=true`, then redeploy. These same settings enable the approved roadmap and mentor adapters. A key alone does not enable external calls.
4. Verify the mentor page reports AI mode before sending an ordinary test learning question. Questions, recent history and anonymised learning context go to Groq. Do not send credentials or private information.
5. If quota or provider availability is exhausted, the mentor returns a safe retry error; roadmap generation can use its validated template fallback. Switch `LLM_PROVIDER=disabled` and redeploy to restore fully offline guidance.

The mentor adapter is implemented and tested with mocked streaming, bounded output, cancellation and safe provider errors. No live API call has been made without valid owner-supplied configuration. AI free quotas are separate from free app hosting.

### Email verification, password reset and reminders

1. Create a Free account at [Brevo](https://www.brevo.com/). Complete the provider's account and transactional-email activation steps. The Free plan has daily limits; do not upgrade or add paid capacity for this demo.
2. In Brevo's **Senders, Domains & Dedicated IPs → Senders**, add an email address you control and verify it using the email Brevo sends. Use an authenticated domain if you already own one. Free sender domains may be rewritten by Brevo for delivery compliance; do not buy a domain unless you choose to.
3. Open **SMTP & API → API Keys**, create an API key and copy it privately into Vercel as `BREVO_API_KEY`. Use an API key, not an SMTP password.
4. Set `EMAIL_FROM` to that verified sender, `EMAIL_PROVIDER=brevo` and `EMAIL_LIVE_CALLS_APPROVED=true`. Confirm `PUBLIC_WEB_URL` is the real HTTPS app origin, then redeploy.
5. Register/sign in with your own email, open Overview and click **Send verification email**. The link opens `/verify-email`; click **Verify email** explicitly. On the login page, test **Forgot your password?** using your own account and confirm a reset invalidates previous sessions. Never share or record these private links.

Unknown and registered email addresses receive the same public reset-request message. Tokens expire, are stored as hashes, and can be consumed only once. Verification expires after 24 hours; reset links after 30 minutes. Resends are limited to one token per account/type/minute. Email sending is not a guarantee of inbox delivery: check the provider's transactional logs and your spam folder.

### Google sign-in

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create/select a project called `linkup`. Open **Google Auth Platform**.
2. Configure **Branding** with the app name `linkup` and your support/developer email. Choose **External** audience. For a personal demo, keep Testing status and add the people who will test Google login under **Test users**.
3. Under **Clients**, create an OAuth client of type **Web application**. Set its authorized redirect URI to exactly `https://YOUR-APP.vercel.app/api/v1/auth/google/callback`, replacing the host with the real production host. Do not use a frontend route or a wildcard. If an authorized JavaScript origin is requested, enter only `https://YOUR-APP.vercel.app`.
4. Copy the client ID and client secret privately into Vercel as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then set `GOOGLE_OAUTH_ENABLED=true` and redeploy. The secret never belongs in a `VITE_` variable.
5. Use **Continue with Google** on the login/register page. Test with an account whose email is not already registered through a password. Existing password accounts are deliberately not silently linked by matching email; use password login/recovery for those accounts.
6. To support Google users beyond your test-user list, complete Google's publishing/verification prompts as required. This owner-controlled console step cannot be completed by source code alone.

The server verifies Google token signatures/audience/expiry with Google's official library, plus email verification, state, nonce and PKCE. Only a private refresh cookie is set; no session/access token is placed in a redirect URL. OAuth callback queries and redirect locations are excluded/redacted from application logs.

### Scheduled reminders and private production secrets

Run `npm run setup:production` locally. It creates ignored `deploy/.env.production.local` with new JWT secrets and a separate random `CRON_SECRET`, and leaves an existing file unchanged. Read it privately in your editor and copy the necessary values into **Vercel → Project → Settings → Environment Variables → Production**. Fill connection/provider values there; never paste this file into chat or Git. Redeploy after changing environment variables.

Set the generated `CRON_SECRET` in Vercel. The checked-in daily cron invokes `/api/v1/internal/jobs/daily` at **07:00 UTC (12:30 India time)**. Vercel supplies the bearer secret. `LOCAL_JOBS_ENABLED` stays `false` on serverless hosting. Weekly notices are deduplicated, account pagination persists across restarts, and email sends require a verified address and enabled reminder preference. Users control reminders in Notifications. Failed email attempts are bounded and retry on later scheduled runs; email quotas still apply.

## Troubleshooting installation

On Vercel, set `SERVE_WEB` to exactly `false` without quotes or trailing spaces.
The frontend is served by the CDN. A different value causes startup validation
to fail; after correcting it, redeploy for the new value to take effect.

The API rewrite uses an unnamed path capture. A named `:path*` capture is
forwarded as a query parameter by Vercel, causing strict query validation to
reject otherwise valid catalogue and planning requests.

If an older deployment fails with `husky: command not found`, deploy the latest
`main` commit. The prepare script now skips Git hook installation on Vercel,
in production, in CI, or when `HUSKY=0`, before importing Husky. Keep the project
Root Directory at the repository root (not `frontend`) and retain the checked-in
install/build commands. Redeploy without the previous build cache if needed.

If a database connection string has been shared publicly or in chat, reset that
Neon role's password in the Neon console. Replace both pooled `DATABASE_URL`
and direct `DATABASE_URL_UNPOOLED` in Vercel's private Production environment
settings, then redeploy. Never commit connection strings or paste them in chat.

## Live acceptance checks

After accounts and private credentials are configured: verify HTTPS signup/login/reload/logout, Google login, email verification/reset, AI mentor streaming/cancellation/history, custom and career goal roadmaps, preview/save/replan, progress/project evidence, certificate PDF/QR/public verification, scheduled reminders and opt-out. Check `/api/v1/health/ready`, `/api/docs/`, Vercel logs and provider delivery logs. Automated/mocked tests do not replace these live checks. No live deployment is claimed before these steps actually run.
