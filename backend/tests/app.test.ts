import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';

describe('API foundation', () => {
  const app = createApp();

  it('returns a liveness response without requiring a database', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { name: 'linkup', status: 'ok' },
      error: null,
    });
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('allows the configured frontend origin', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects unapproved origins with a consistent error', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'https://untrusted.example');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns a structured 404', async () => {
    const response = await request(app).get('/api/v1/missing');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('rejects malformed JSON without exposing internals', async () => {
    const response = await request(app)
      .post('/api/v1/missing')
      .set('Content-Type', 'application/json')
      .send('{broken');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(response.body.error.stack).toBeUndefined();
  });

  it('rejects oversized request bodies', async () => {
    const response = await request(app)
      .post('/api/v1/missing')
      .send({ content: 'x'.repeat(40_000) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('environment validation', () => {
  it('rejects invalid ports and client URLs', () => {
    expect(() => parseEnv({ PORT: '0' })).toThrow('PORT');
    expect(() => parseEnv({ CLIENT_URL: 'invalid-url' })).toThrow('CLIENT_URL');
  });

  it('never includes a credential value in validation errors', () => {
    const sensitiveValue = 'not-a-url-secret';
    expect(() => parseEnv({ DATABASE_URL: sensitiveValue })).toThrow('DATABASE_URL');
    try {
      parseEnv({ DATABASE_URL: sensitiveValue });
    } catch (error) {
      expect((error as Error).message).not.toContain(sensitiveValue);
    }
  });
});
