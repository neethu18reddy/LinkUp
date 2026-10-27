import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Preview builds must never migrate the production database.
if (process.env.VERCEL_ENV === 'production') {
  if (!process.env.DATABASE_URL_UNPOOLED)
    throw new Error('Configure the private Neon DATABASE_URL_UNPOOLED for production migrations.');
  const result = spawnSync(
    process.execPath,
    ['../node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    {
      cwd: fileURLToPath(new URL('../backend', import.meta.url)),
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  if (result.error || result.status !== 0) process.exit(1);
} else {
  console.log('Production database migrations skipped outside a Vercel production build.');
}
