import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
export function serveWeb(app: Express, root: string) {
  const index = join(root, 'index.html');
  if (!existsSync(index))
    throw new Error('Frontend build is missing. Run npm run build before enabling SERVE_WEB.');
  app.use(
    '/assets',
    express.static(join(root, 'assets'), { immutable: true, maxAge: '1y', index: false }),
  );
  app.use(express.static(root, { index: false, maxAge: 0 }));
  app.get('*', (req, res, next) => {
    if (
      /^\/api(?:\/|$)/.test(req.path) ||
      req.path.startsWith('/assets/') ||
      /\.[a-z0-9]+$/i.test(req.path) ||
      !req.accepts('html')
    ) {
      next();
      return;
    }
    res.set('Cache-Control', 'no-store').sendFile(index);
  });
}
