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

1. Sign in at [Groq Console](https://console.groq.com/) and open [API keys](https://console.groq.com/keys). Create a key for linkup. Keep the account on its free tier; do not add billing or enable a paid model unless you later choose to pay.
2. In Vercel's private Production Environment settings, set `GROQ_API_KEY` to that key and `LLM_MODEL` to a text model available to your account. Confirm its access and free quota in the provider console; model availability can change. See [supported models](https://console.groq.com/docs/models).
3. Set `LLM_PROVIDER=groq` and `LLM_LIVE_CALLS_APPROVED=true`, then redeploy. These same settings enable the approved roadmap and mentor adapters. A key alone does not enable external calls.
4. Verify the mentor page reports AI mode before sending an ordinary test learning question. Questions, recent history and anonymised learning context go to Groq. Do not send credentials or private information.
5. If quota or provider availability is exhausted, the mentor returns a safe retry error; roadmap generation can use its validated template fallback. Switch `LLM_PROVIDER=disabled` and redeploy to restore fully offline guidance.

The mentor adapter is implemented and tested with mocked streaming, bounded output, cancellation and safe provider errors. No live API call has been made without valid owner-supplied configuration. AI free quotas are separate from free app hosting.

The provider code and exact callback/environment details are being completed separately. Do not enable a provider flag before its corresponding code, credentials and configuration checks are ready. You will need to create a provider account/API key for AI, verify an email sender with the email provider, and create a Google OAuth web application. Secrets stay in private platform Environment settings.
