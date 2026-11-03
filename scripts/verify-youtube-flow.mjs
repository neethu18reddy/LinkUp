import { spawn } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { chromium } from 'playwright';
import pg from 'pg';
const root = new URL('../', import.meta.url),
  local = parse(await readFile(new URL('backend/.env', root), 'utf8'));
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(local.DATABASE_URL).hostname))
  throw Error('YouTube browser QA requires a local database.');
const base = 'http://127.0.0.1:4019',
  email = `youtube-browser-${randomUUID()}@example.test`,
  errors = [];
const server = spawn(process.execPath, ['dist/server.js'], {
  cwd: fileURLToPath(new URL('backend/', root)),
  windowsHide: true,
  stdio: 'ignore',
  env: {
    ...process.env,
    ...local,
    NODE_ENV: 'development',
    PORT: '4019',
    SERVE_WEB: 'true',
    CLIENT_URL: base,
    PUBLIC_WEB_URL: base,
    LLM_PROVIDER: 'disabled',
    MENTOR_PROVIDER: 'disabled',
    LLM_LIVE_CALLS_APPROVED: 'false',
    EMAIL_PROVIDER: 'disabled',
    EMAIL_LIVE_CALLS_APPROVED: 'false',
    GOOGLE_OAUTH_ENABLED: 'false',
    LOCAL_JOBS_ENABLED: 'false',
    YOUTUBE_API_KEY: '',
  },
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/api/v1/health/ready`)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for the local API to start. */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!ready) throw Error('Local app did not start.');
  browser = await chromium
    .launch({ channel: 'chrome', headless: true })
    .catch(() => chromium.launch({ channel: 'msedge', headless: true }));
  const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      timezoneId: 'Asia/Kolkata',
    }),
    page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/v1/youtube/recommendations?*', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          videos: [
            {
              id: 'aaaaaaaaaaa',
              title: 'JavaScript arrays tutorial',
              channel: 'QA teaching channel',
              url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
              thumbnailUrl: null,
              publishedAt: '2026-01-01T00:00:00Z',
              durationSec: 1800,
              views: '12000',
              likes: '650',
              comments: '50',
              language: 'en',
              languageVerified: true,
            },
          ],
          cached: false,
          fetchedAt: new Date().toISOString(),
        },
      },
    }),
  );
  await page.route('**/api/v1/youtube/videos/*/comments', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          comments: [
            {
              id: 'qa',
              text: 'A useful worked example. <script>not executed</script>',
              author: 'QA learner',
              likes: 3,
              url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa',
            },
          ],
          cached: false,
          unavailable: false,
        },
      },
    }),
  );
  await page.goto(`${base}/register`);
  await page.locator('#name').fill('YouTube QA learner');
  await page.locator('#email').fill(email);
  const password = `QA!${randomBytes(18).toString('hex')}`;
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await page.goto(`${base}/mentor`);
  await page.getByRole('heading', { name: 'Find videos for your topic' }).waitFor();
  await page.getByLabel('Learning topic', { exact: true }).fill('JavaScript arrays');
  await page.getByLabel('Preferred language', { exact: true }).selectOption('both');
  await page.getByRole('button', { name: 'Find videos', exact: true }).click();
  await page.getByRole('heading', { name: 'JavaScript arrays tutorial' }).waitFor();
  await page.getByRole('button', { name: 'Show top comments' }).click();
  await page
    .getByText('A useful worked example. <script>not executed</script>', { exact: true })
    .waitFor();
  await mkdir(new URL('docs/screenshots/', root), { recursive: true });
  await page.locator('.youtube-finder').evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.evaluate(() => globalThis.scrollTo(0, 0));
  await page.screenshot({
    path: fileURLToPath(new URL('docs/screenshots/youtube-mentor-desktop.png', root)),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth + 1,
    )
  )
    throw Error('Mentor discovery overflows mobile.');
  await page.screenshot({
    path: fileURLToPath(new URL('docs/screenshots/youtube-mentor-mobile.png', root)),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByRole('link', { name: 'Build my study plan', exact: true }).click();
  await page.getByLabel('Favorite video or playlist URL').waitFor();
  await page.getByRole('button', { name: 'Load my video or playlist' }).click();
  await page.getByLabel('What do you want to learn?').waitFor();
  await page.getByLabel('What do you want to learn?').fill('Understand JavaScript arrays');
  await page.getByLabel(/— minutes/).fill('30');
  await page.getByRole('button', { name: 'Preview study schedule' }).click();
  await page.getByRole('heading', { name: 'Your study schedule' }).waitFor();
  const savedTitle = await page.getByLabel('Plan title', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Save study plan', exact: true }).click();
  await page.waitForURL(/\/studio\/[\w-]+\/plan$/);
  const planUrl = page.url();
  await page.getByRole('heading', { name: 'Your study schedule' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Your study schedule' }).waitFor();
  await page.screenshot({
    path: fileURLToPath(new URL('docs/screenshots/youtube-plan-desktop.png', root)),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth + 1,
    )
  )
    throw Error('YouTube plan overflows mobile.');
  await page.screenshot({
    path: fileURLToPath(new URL('docs/screenshots/youtube-plan-mobile.png', root)),
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Open learning session', exact: true }).first().click();
  await page.waitForURL(/\/studio\/[\w-]+\/study\?/);
  await page.getByRole('button', { name: 'Mark complete', exact: true }).waitFor();
  await page.goto(`${base}/studio?view=youtube`);
  await page.getByRole('heading', { name: 'Your saved YouTube plans' }).waitFor();
  await page.getByRole('link', { name: savedTitle, exact: true }).waitFor();
  await page.goto(planUrl);
  await page.getByRole('heading', { name: 'Your study schedule' }).waitFor();
  const resourceId = new URL(planUrl).pathname.split('/')[2];
  await page.goto(`${base}/youtube/${resourceId}`);
  await page.waitForURL(`**/studio/${resourceId}/plan`);
  await page.getByRole('heading', { name: 'Learning Studio', level: 1 }).waitFor();
  await page.goto(`${base}/youtube?topic=arrays&language=hi`);
  await page.waitForURL(/\/studio\?.*view=youtube/);
  if (new URL(page.url()).searchParams.get('topic') !== 'arrays')
    throw Error('Legacy link lost its parameters.');
  if (
    await page
      .getByRole('navigation', { name: 'Your workspace' })
      .getByRole('link', { name: 'YouTube Learning', exact: true })
      .count()
  )
    throw Error('Separate YouTube navigation still exists.');
  if (errors.length) throw Error(errors.join('; '));
  const result = {
    mentorDiscovery: true,
    commentsSafe: true,
    favoriteLink: true,
    previewSaveReload: true,
    studioHandoff: true,
    unifiedStudio: true,
    legacyLinksPreserved: true,
    mobileOverflow: false,
    browserErrors: errors,
    liveGoogleCalls: false,
  };
  await writeFile(
    new URL('.local/youtube-browser-results.json', root),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  server.kill();
  const db = new pg.Client({ connectionString: local.DATABASE_URL });
  try {
    await db.connect();
    await db.query('DELETE FROM "User" WHERE email=$1', [email]);
  } finally {
    await db.end();
  }
}
