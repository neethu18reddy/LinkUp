import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import request from 'supertest';
import SwaggerParser from '@apidevtools/swagger-parser';
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { openapi } from '../src/docs/openapi.js';
import { demoOptions } from '../src/scripts/seed-demo.js';
import { parseEnv } from '../src/config/env.js';
describe('deployment and local documentation', () => {
  it('validates canonical production origins and rejects path/credential CORS entries', () => {
    const base = {
      NODE_ENV: 'production',
      SERVE_WEB: 'true',
      DATABASE_URL: 'postgresql://test:test@localhost/test',
      JWT_ACCESS_SECRET: 'access-'.repeat(8),
      JWT_REFRESH_SECRET: 'refresh-'.repeat(8),
      CLIENT_URL: 'https://linkup.example/',
    };
    expect(() => parseEnv(base)).toThrow('PUBLIC_WEB_URL');
    expect(() => parseEnv({ ...base, PUBLIC_WEB_URL: 'https://another.example' })).toThrow(
      'PUBLIC_WEB_URL',
    );
    expect(parseEnv({ ...base, PUBLIC_WEB_URL: 'https://linkup.example/' }).PUBLIC_WEB_URL).toBe(
      'https://linkup.example',
    );
    expect(() => parseEnv({ CLIENT_URL: 'https://user:password@example.test' })).toThrow(
      'CLIENT_URL',
    );
    expect(() => parseEnv({ CLIENT_URL: 'https://example.test/path' })).toThrow('CLIENT_URL');
  });
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'linkup-web-'));
    await mkdir(join(root, 'assets'));
    await writeFile(
      join(root, 'index.html'),
      '<!doctype html><title>linkup production fixture</title>',
    );
    await writeFile(join(root, 'assets/app-test.js'), 'console.log("linkup")');
  });
  afterAll(async () => {
    if (root) {
      const target = resolve(root);
      if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('linkup-web-'))
        throw new Error('Refusing to remove an unexpected test directory.');
      await rm(target, { recursive: true, force: true });
    }
  });
  it('validates the OpenAPI document and public/private media contracts', async () => {
    await SwaggerParser.validate(JSON.parse(JSON.stringify(openapi)));
    expect(Object.keys(openapi.paths).length).toBeGreaterThan(30);
    const spec = JSON.parse(JSON.stringify(openapi));
    expect(spec.paths['/public/verify/{code}'].get.security).toEqual([]);
    expect(
      spec.paths['/certificates/{id}/pdf'].get.responses['200'].content['application/pdf'],
    ).toBeDefined();
    expect(
      spec.paths['/chat/message'].post.responses['200'].content['text/event-stream'],
    ).toBeDefined();
    expect(spec.paths['/internal/jobs/weekly'].post.security).toEqual([{ cronBearer: [] }]);
  });
  it('serves docs and its local assets without external validation or submit actions', async () => {
    const app = createApp();
    expect((await request(app).get('/api/v1/openapi.json')).body.info.title).toBe('linkup API');
    const html = await request(app).get('/api/docs/');
    expect(html.status).toBe(200);
    expect(html.text).toContain('swagger-ui');
    const init = await request(app).get('/api/docs/swagger-ui-init.js');
    expect(init.status).toBe(200);
    expect(init.text).toContain('"supportedSubmitMethods": []');
    expect(init.text).toContain('"validatorUrl": null');
    expect((await request(app).get('/api/docs/swagger-ui-bundle.js')).status).toBe(200);
  });
  it('serves deep links while retaining API/asset 404s and cache policies', async () => {
    const app = createApp({ webRoot: root });
    const page = await request(app)
      .get('/verify/' + 'a'.repeat(64))
      .set('Accept', 'text/html');
    expect(page.status).toBe(200);
    expect(page.text).toContain('production fixture');
    expect(page.headers['cache-control']).toBe('no-store');
    const asset = await request(app).get('/assets/app-test.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toContain('immutable');
    expect((await request(app).get('/assets/missing.js')).status).toBe(404);
    const api = await request(app).get('/api/v1/missing').set('Accept', 'text/html');
    expect(api.status).toBe(404);
    expect(api.body.error.code).toBe('NOT_FOUND');
    expect((await request(app).get('/missing-file.js')).status).toBe(404);
  });
  it('fails clearly when the configured frontend build does not exist', () => {
    expect(() => createApp({ webRoot: join(root, 'missing') })).toThrow(
      'Frontend build is missing',
    );
  });
  it('requires private demo credentials and refuses production seeding', () => {
    expect(() =>
      demoOptions({ NODE_ENV: 'production', DEMO_SEED_PASSWORD: 'PrivateDemo!42' }),
    ).toThrow('local/test only');
    expect(() => demoOptions({ NODE_ENV: 'test' })).toThrow('DEMO_SEED_PASSWORD');
    expect(demoOptions({ NODE_ENV: 'test', DEMO_SEED_PASSWORD: 'PrivateDemo!42' }).email).toBe(
      'demo@linkup.example.invalid',
    );
  });
});
