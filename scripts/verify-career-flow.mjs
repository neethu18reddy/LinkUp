import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { parse } from 'dotenv';
import pg from 'pg';

const root = new URL('../', import.meta.url);
const local = parse(await readFile(new URL('backend/.env', root), 'utf8'));
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(local.DATABASE_URL).hostname))
  throw new Error('Browser QA requires a local database.');
const base = 'http://127.0.0.1:4017';
const server = spawn(process.execPath, ['dist/server.js'], {
  cwd: fileURLToPath(new URL('backend/', root)),
  windowsHide: true,
  stdio: 'ignore',
  env: {
    ...process.env,
    ...local,
    NODE_ENV: 'development',
    PORT: '4017',
    SERVE_WEB: 'true',
    CLIENT_URL: base,
    PUBLIC_WEB_URL: base,
    LLM_PROVIDER: 'disabled',
    LLM_LIVE_CALLS_APPROVED: 'false',
    EMAIL_PROVIDER: 'disabled',
    EMAIL_LIVE_CALLS_APPROVED: 'false',
    GOOGLE_OAUTH_ENABLED: 'false',
    LOCAL_JOBS_ENABLED: 'false',
  },
});
const emails = [],
  errors = [],
  results = {};
let browser;
async function ready(url) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) return;
    } catch {
      /* startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Local server did not become ready: ${url}`);
}
async function register(page) {
  const password = `Qa!${randomBytes(18).toString('hex')}`;
  const email = `career-qa-${randomUUID()}@example.test`;
  emails.push(email);
  await page.goto(`${base}/register`, { waitUntil: 'domcontentloaded' });
  await page.locator('#name').fill('Career Browser QA');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/auth/register') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  if ((await response).status() !== 201) throw new Error('Browser registration failed');
  await page.waitForURL('**/dashboard');
}
try {
  await ready('http://127.0.0.1:4017/api/v1/health/ready');
  await ready(base);
  browser = await chromium
    .launch({ channel: 'chrome', headless: true })
    .catch(() => chromium.launch({ channel: 'msedge', headless: true }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.on('pageerror', (error) => errors.push(error.message));
  await register(page);
  await page.goto(`${base}/roles`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Explore career paths' }).waitFor();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await page.getByText(/career paths · page 2/).waitFor();
  await page.getByRole('button', { name: 'Finance & Accounting', exact: true }).click();
  await page.locator('#career-search').fill('Financial Analyst');
  await page
    .getByRole('link', { name: /Financial Analyst.*Guided roadmap/ })
    .first()
    .waitFor();
  await mkdir(new URL('docs/screenshots/', root), { recursive: true });
  await page.screenshot({
    path: fileURLToPath(new URL('docs/screenshots/career-catalog-desktop.png', root)),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Find my direction', exact: true }).click();
  const form = page.getByRole('form', { name: 'Career questionnaire' });
  for (const answer of [
    'Finance & Accounting',
    'I am getting started',
    'Excel',
    'Analyzing evidence',
    'About 5 hours',
    'In 6 months',
    'Reading documentation and examples',
    'Changing career direction',
  ]) {
    await form.getByLabel(answer, { exact: true }).check();
    await form.getByRole('button', { name: /^(Continue|Find my directions)$/ }).click();
  }
  await page.getByRole('heading', { name: 'Your starting directions' }).waitFor();
  const guided = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Your starting directions', exact: true }) });
  await guided.getByRole('link', { name: 'Review role and roadmap' }).first().click();
  await page.getByRole('button', { name: 'Start roadmap', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm and start roadmap', exact: true }).click();
  await page.waitForURL('**/roadmap');
  await page.getByRole('button', { name: 'Generate roadmap', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm generation', exact: true }).click();
  await page.getByText('Your next step', { exact: true }).waitFor();
  if ((await page.locator('details.journey-stage').count()) < 5)
    throw new Error('Expected five role stages');
  await page
    .getByRole('button', { name: /^Complete / })
    .first()
    .click();
  await page
    .getByRole('button', { name: /^Reopen / })
    .first()
    .waitFor();
  await page.reload();
  await page
    .getByRole('button', { name: /^Reopen / })
    .first()
    .waitFor();
  await page.screenshot({
    path: fileURLToPath(new URL('docs/screenshots/career-roadmap-desktop.png', root)),
    fullPage: true,
  });
  results.guided = {
    savedAnswers: true,
    goalConfirmed: true,
    stages: await page.locator('details.journey-stage').count(),
    completionSurvivesReload: true,
  };
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/roles`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Browse roles' }).waitFor();
  await page.getByRole('button', { name: 'Next page', exact: true }).waitFor();
  const overflow = await page.evaluate(
    () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth + 1,
  );
  if (overflow) throw new Error('Career catalog overflows the mobile viewport');
  await page.screenshot({
    path: fileURLToPath(new URL('docs/screenshots/career-catalog-mobile.png', root)),
    fullPage: true,
  });
  results.mobile = { width: 390, horizontalOverflow: false };
  await context.close();
  const directContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const direct = await directContext.newPage();
  direct.setDefaultTimeout(60_000);
  direct.on('pageerror', (error) => errors.push(error.message));
  await register(direct);
  await direct.goto(`${base}/skills`, { waitUntil: 'domcontentloaded' });
  await direct
    .getByRole('button', { name: 'Browse all domains and select multiple skills' })
    .click();
  await direct.locator('#explore-skill-search').fill('reactjs');
  await direct.getByRole('checkbox', { name: /^React / }).check();
  await direct.locator('#explore-skill-search').fill('sql');
  await direct.getByRole('checkbox', { name: 'SQL backend services', exact: true }).check();
  await direct.locator('#batch-skill-level').selectOption('INTERMEDIATE');
  await direct.getByRole('button', { name: 'Save 2 skills', exact: true }).click();
  await direct.getByText('Your selected skills were saved.').waitFor();
  await direct.goto(`${base}/roles`, { waitUntil: 'domcontentloaded' });
  await direct.getByRole('heading', { name: 'Three directions from your skills' }).waitFor();
  await direct
    .getByText(/% skill match/)
    .first()
    .waitFor();
  results.direct = { aliasSearch: true, multiSelectSave: true, recommendations: true };
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  results.browserErrors = errors;
  await writeFile(new URL('.local/career-qa-results.json', root), JSON.stringify(results, null, 2));
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
