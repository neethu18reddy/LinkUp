import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const runner = fileURLToPath(new URL('node_modules/vitest/vitest.mjs', root));
const env = {
  ...process.env,
  NODE_ENV: 'test',
  RUN_DATABASE_TESTS: 'false',
  LINKUP_SLOW_TESTS: 'true',
  LLM_PROVIDER: 'disabled',
  LLM_LIVE_CALLS_APPROVED: 'false',
  EMAIL_PROVIDER: 'disabled',
  EMAIL_LIVE_CALLS_APPROVED: 'false',
  GOOGLE_OAUTH_ENABLED: 'false',
  LOCAL_JOBS_ENABLED: 'false',
};
const requested = process.argv.slice(2);
const workspaces = requested.length ? requested : ['frontend', 'backend'];
if (workspaces.some((workspace) => !['frontend', 'backend'].includes(workspace)))
  throw new Error('Choose frontend, backend, or omit workspace arguments.');
for (const workspace of workspaces) {
  // Native authentication modules use a process boundary on Windows.
  const pool = workspace === 'frontend' ? 'threads' : 'forks';
  console.log(`Verifying ${workspace} with one local worker.`);
  execFileSync(
    process.execPath,
    [
      runner,
      'run',
      `--pool=${pool}`,
      '--maxWorkers=1',
      '--testTimeout=60000',
      '--hookTimeout=60000',
    ],
    {
      cwd: fileURLToPath(new URL(`${workspace}/`, root)),
      env,
      windowsHide: true,
      stdio: 'inherit',
    },
  );
}
