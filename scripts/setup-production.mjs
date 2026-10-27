import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const destination = new URL('../deploy/.env.production.local', import.meta.url);
const content = `# Private values for Vercel Production Environment. Never commit or paste into chat.
NODE_ENV=production
SERVE_WEB=false
TRUST_PROXY_HOPS=1
JWT_ACCESS_SECRET=${randomBytes(48).toString('hex')}
JWT_REFRESH_SECRET=${randomBytes(48).toString('hex')}
CRON_SECRET=${randomBytes(32).toString('hex')}
DATABASE_URL=
DATABASE_URL_UNPOOLED=
PUBLIC_WEB_URL=
CLIENT_URL=
VITE_API_BASE_URL=/api/v1
LOCAL_JOBS_ENABLED=false
LLM_PROVIDER=disabled
LLM_LIVE_CALLS_APPROVED=false
GROQ_API_KEY=
LLM_MODEL=
EMAIL_PROVIDER=disabled
EMAIL_LIVE_CALLS_APPROVED=false
BREVO_API_KEY=
EMAIL_FROM=
GOOGLE_OAUTH_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
`;
try {
  await writeFile(destination, content, { flag: 'wx', mode: 0o600 });
  console.log(
    'Private production template created at deploy/.env.production.local (values hidden).',
  );
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing private production template preserved.');
}
