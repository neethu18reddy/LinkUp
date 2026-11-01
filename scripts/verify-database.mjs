import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import pg from 'pg';

const root = new URL('../', import.meta.url);
const local = parse(readFileSync(new URL('backend/.env', root)));
const url = new URL(process.env.DATABASE_URL || local.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('Integration verification only creates databases on loopback PostgreSQL.');
const adminUrl = new URL(url);
adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.href });
const name = `linkup_catalog_qa_${randomUUID().replaceAll('-', '')}`;
const identifier = admin.escapeIdentifier(name);
process.on('SIGINT', () => {
  /* Child interruption throws into the cleanup below. */
});
url.pathname = `/${name}`;
const env = {
  ...process.env,
  DATABASE_URL: url.href,
  DATABASE_URL_UNPOOLED: url.href,
  NODE_ENV: 'test',
  RUN_DATABASE_TESTS: 'true',
  LLM_PROVIDER: 'disabled',
  LLM_LIVE_CALLS_APPROVED: 'false',
  EMAIL_PROVIDER: 'disabled',
  EMAIL_LIVE_CALLS_APPROVED: 'false',
  GOOGLE_OAUTH_ENABLED: 'false',
  LOCAL_JOBS_ENABLED: 'false',
};
const patterns = process.argv.slice(2);
let created = false;
await admin.connect();
try {
  await admin.query(`CREATE DATABASE ${identifier}`);
  created = true;
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('node_modules/prisma/build/index.js', root)), 'migrate', 'deploy'],
    { cwd: fileURLToPath(new URL('backend/', root)), env, windowsHide: true, stdio: 'inherit' },
  );
  // Integration stories contain many authenticated requests. Run serially to avoid
  // resource contention and allow a whole story to finish before fixture cleanup.
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('node_modules/vitest/vitest.mjs', root)),
      'run',
      ...(patterns.length ? patterns : ['database']),
      '--maxWorkers=1',
      '--isolate=false',
      '--testTimeout=120000',
      '--hookTimeout=60000',
    ],
    { cwd: fileURLToPath(new URL('backend/', root)), env, windowsHide: true, stdio: 'inherit' },
  );
} finally {
  if (created && /^linkup_catalog_qa_[a-f0-9]{32}$/.test(name))
    await admin.query(`DROP DATABASE ${identifier} WITH (FORCE)`);
  await admin.end();
  console.log('Disposable database removed. Local learner data was not used.');
}
