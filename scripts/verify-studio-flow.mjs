import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parse } from 'dotenv';
import pg from 'pg';
const root = new URL('../', import.meta.url),
  local = parse(await readFile(new URL('backend/.env', root), 'utf8'));
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(local.DATABASE_URL).hostname))
  throw new Error('Studio browser QA requires a local database.');
const base = 'http://127.0.0.1:4018',
  emails = [],
  errors = [],
  results = {};
const server = spawn(process.execPath, ['dist/server.js'], {
  cwd: fileURLToPath(new URL('backend/', root)),
  windowsHide: true,
  stdio: 'ignore',
  env: {
    ...process.env,
    ...local,
    NODE_ENV: 'development',
    PORT: '4018',
    SERVE_WEB: 'true',
    CLIENT_URL: base,
    PUBLIC_WEB_URL: base,
    LLM_PROVIDER: 'disabled',
    LLM_LIVE_CALLS_APPROVED: 'false',
    EMAIL_PROVIDER: 'disabled',
    EMAIL_LIVE_CALLS_APPROVED: 'false',
    GOOGLE_OAUTH_ENABLED: 'false',
    LOCAL_JOBS_ENABLED: 'false',
    YOUTUBE_API_KEY: '',
  },
});
let browser;
async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/api/v1/health/ready`, { signal: AbortSignal.timeout(2000) })).ok)
        return;
    } catch {
      /* startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Local Studio server did not start.');
}
try {
  await ready();
  browser = await chromium
    .launch({ channel: 'chrome', headless: true })
    .catch(() => chromium.launch({ channel: 'msedge', headless: true }));
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: 'Asia/Kolkata',
    }),
    page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/register`, { waitUntil: 'domcontentloaded' });
  const email = `studio-browser-${randomUUID()}@example.test`,
    password = `Qa!${randomBytes(18).toString('hex')}`;
  emails.push(email);
  await page.locator('#name').fill('Studio Browser QA');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  const registration = page.waitForResponse(
    (response) =>
      response.url().endsWith('/auth/register') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const session = (await (await registration).json()).data;
  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };
  const call = async (path, body, method = 'POST') => {
    const response = await context.request.fetch(`${base}/api/v1${path}`, {
      method,
      headers,
      ...(body ? { data: body } : {}),
    });
    const payload = await response.json();
    if (!response.ok()) throw new Error(`${path}: ${response.status()} ${payload.error?.code}`);
    return payload.data;
  };
  const roles = await call('/career-catalog/roles?search=Frontend%20Developer', null, 'GET');
  const role = roles.roles.find((row) => row.title === 'Frontend Developer');
  const goal = await call('/goals', { kind: 'ROLE', roleId: role.id, expectedGoalId: null });
  await call('/roadmaps/generate', { goalId: goal.goal.id });
  await page.goto(`${base}/roadmap`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Your next step', { exact: true }).waitFor();
  if ((await page.locator('.journey-stage[open]').count()) !== 1)
    throw new Error('Only the current roadmap stage should initially expand.');
  await page.getByRole('button', { name: 'Show only my next 3 skills', exact: true }).click();
  if ((await page.locator('.journey-skill').count()) > 3)
    throw new Error('Focus mode must show at most three steps.');
  await page.getByRole('button', { name: 'Show full roadmap', exact: true }).click();
  await mkdir(new URL('docs/screenshots/', root), { recursive: true });
  await page.screenshot({
    path: fileURLToPath(new URL('docs/screenshots/studio-roadmap-desktop.png', root)),
    fullPage: true,
  });
  await page.goto(`${base}/studio`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Learning Studio', level: 1, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Add a learning resource', exact: true }).click();
  await page.locator('#resource-provider').selectOption('custom');
  await page.locator('#resource-title').fill('JavaScript practice');
  await page.locator('#resource-import').fill('JavaScript arrays\nJavaScript functions');
  await page.getByRole('button', { name: 'Preview learning plan', exact: true }).click();
  await page.getByRole('heading', { name: 'Make this plan yours', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await page.waitForURL('**/studio/*/study');
  const resourceId = /\/studio\/([^/]+)\/study/.exec(page.url())[1];
  await page.locator('#note-body').fill('# A small win\nArrays keep my examples together.');
  await page
    .getByRole('status')
    .filter({ hasText: /^Saved$/ })
    .waitFor();
  await page.reload();
  await page.locator('#note-body').waitFor();
  await page.getByText('Arrays keep my examples together.', { exact: true }).first().waitFor();
  await context.setOffline(true);
  await page.locator('#note-body').fill('Offline draft: try one more example.');
  await page
    .getByRole('status')
    .filter({ hasText: /Offline/ })
    .waitFor();
  await context.setOffline(false);
  await page
    .getByRole('status')
    .filter({ hasText: /^Saved$/ })
    .waitFor();
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await page.locator('.cm-content').waitFor();
  await page.locator('.cm-content').fill('console.log(2 + 3);');
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await page.getByRole('heading', { name: /Output · success/ }).waitFor();
  if (!(await page.locator('.studio-output').innerText()).includes('5'))
    throw new Error('JavaScript output missing.');
  results.javascript = true;
  await page.locator('#snippet-language').selectOption('typescript');
  await page.locator('.cm-content').fill('const total: number = 7; console.log(total);');
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await page.getByRole('heading', { name: /Output · success/ }).waitFor();
  if (!(await page.locator('.studio-output').innerText()).includes('7'))
    throw new Error('TypeScript output missing.');
  results.typescript = true;
  await page.locator('#snippet-language').selectOption('javascript');
  await page.locator('.cm-content').fill('while (true) {}');
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await page.getByRole('heading', { name: /Output · timeout/ }).waitFor();
  results.timeout = true;
  await page
    .locator('.cm-content')
    .fill(
      'console.log(typeof document, typeof localStorage); try { await fetch("http://127.0.0.1:4018/api/v1/health"); console.log("UNEXPECTED_NETWORK"); } catch { console.log("app network blocked"); }',
    );
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await page.getByRole('heading', { name: /Output · success/ }).waitFor();
  const isolated = await page.locator('.studio-output').innerText();
  if (
    !isolated.includes('undefined undefined') ||
    !isolated.includes('app network blocked') ||
    isolated.includes('UNEXPECTED_NETWORK')
  )
    throw new Error('Sandbox isolation failed.');
  results.isolation = true;
  await page.locator('#snippet-language').selectOption('python');
  await page.locator('.cm-content').fill('print(6 * 7)');
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await page.getByRole('heading', { name: /Output · success/ }).waitFor({ timeout: 90000 });
  if (!(await page.locator('.studio-output').innerText()).includes('42'))
    throw new Error('Python output missing.');
  results.python = true;
  await page.locator('#snippet-language').selectOption('html');
  await page.locator('.cm-content').fill('<h1>My isolated preview</h1>');
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await page.getByRole('heading', { name: /Output · success/ }).waitFor();
  await page
    .frameLocator('iframe.studio-code-preview')
    .frameLocator('iframe')
    .getByRole('heading', { name: 'My isolated preview' })
    .waitFor();
  results.html = true;
  await page.getByRole('button', { name: 'Mark complete', exact: true }).click();
  await page.getByRole('button', { name: 'Mark incomplete', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Mark incomplete', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await page.locator('.cm-content').waitFor();
  await page.screenshot({
    path: fileURLToPath(new URL('docs/screenshots/studio-study-desktop.png', root)),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth + 1,
    )
  )
    throw new Error('Study page overflows mobile.');
  await page.screenshot({
    path: fileURLToPath(new URL('docs/screenshots/studio-study-mobile.png', root)),
    fullPage: true,
  });
  await page.goto(`${base}/studio/${resourceId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Your learning rhythm', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit chapters and skills', exact: true }).click();
  await page.getByRole('button', { name: 'Split after this', exact: true }).first().click();
  await page.getByRole('button', { name: 'Save chapter changes', exact: true }).click();
  await page.getByRole('button', { name: 'Edit chapters and skills', exact: true }).waitFor();
  await page.screenshot({
    path: fileURLToPath(new URL('docs/screenshots/studio-tracker-mobile.png', root)),
    fullPage: true,
  });
  const data = await call(`/resources/${resourceId}`, null, 'GET');
  if (data.done !== 1 || data.sections.length !== 2)
    throw new Error('Section editing changed saved progress.');
  const notes = await call(`/notes?resourceId=${resourceId}`, null, 'GET');
  if (!notes.some((note) => note.bodyMd.includes('Offline draft')))
    throw new Error('Offline note did not sync.');
  const settings = await call('/studio/settings', null, 'GET');
  if (settings.timezone !== 'Asia/Calcutta' && settings.timezone !== 'Asia/Kolkata')
    throw new Error('Browser timezone not stored.');
  results.core = {
    roadmapFocus: true,
    manualImport: true,
    notesAfterReload: true,
    offlineDraftSync: true,
    chaptersPreserveProgress: true,
    mobileOverflow: false,
    timezone: settings.timezone,
  };
  results.browserErrors = errors;
  if (errors.length) throw new Error(`Unexpected browser errors: ${errors.join('; ')}`);
  await writeFile(new URL('.local/studio-qa-results.json', root), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  server.kill();
  if (emails.length) {
    const db = new pg.Client({ connectionString: local.DATABASE_URL });
    try {
      await db.connect();
      await db.query('DELETE FROM "User" WHERE email = ANY($1::text[])', [emails]);
    } finally {
      await db.end();
    }
  }
}
