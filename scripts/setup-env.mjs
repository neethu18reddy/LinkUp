import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
for (const directory of ['', 'backend/', 'frontend/']) {
  const destination = new URL(`${directory}.env`, root);
  let content;
  try {
    content = await readFile(destination, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    content = await readFile(new URL(`${directory}.env.example`, root), 'utf8');
  }
  if (directory === 'backend/') {
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
      const pattern = new RegExp(`^${key}=(.*)$`, 'm');
      const match = content.match(pattern);
      if (!match || !match[1].trim() || /^(""|'')$/.test(match[1].trim())) {
        const entry = `${key}=${randomBytes(48).toString('hex')}`;
        content = match ? content.replace(pattern, entry) : `${content.trimEnd()}\n${entry}\n`;
      }
    }
  }
  await writeFile(destination, content, { mode: 0o600 });
  console.log(`Local environment ready: ${fileURLToPath(destination)} (values hidden)`);
}
