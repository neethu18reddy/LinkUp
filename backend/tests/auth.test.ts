import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { AuthTokens } from '../src/modules/auth/auth.tokens.js';
import { assertOwnership, requireAuth, requireRole } from '../src/middleware/requireAuth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { parseEnv } from '../src/config/env.js';
import { MemoryAuthRepository } from './helpers/memory-auth-repository.js';

export const testSecrets = {
  access: 'test-access-secret-only-'.repeat(3),
  refresh: 'test-refresh-secret-only-'.repeat(3),
};
const input = { name: 'Learner', email: 'learner@example.test', password: 'LearnTogether!12' };
const cookie = (response: { headers: Record<string, unknown> }) =>
  (response.headers['set-cookie'] as string[])[0]!.split(';')[0]!;

describe('authentication API', () => {
  let repository: MemoryAuthRepository;
  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    repository = new MemoryAuthRepository();
    app = createApp({ authRepository: repository, authSecrets: testSecrets });
  });
  const post = (app: ReturnType<typeof createApp>, path: string) =>
    request(app).post(`/api/v1/auth/${path}`).set('X-Linkup-Request', '1');

  it('registers, hashes passwords, and sends only a safe public profile', async () => {
    const response = await post(app, 'register').send({
      ...input,
      email: ' LEARNER@example.test ',
    });
    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({
      name: 'Learner',
      email: input.email,
      role: 'USER',
    });
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.refreshToken).toBeUndefined();
    const stored = [...repository.users.values()][0]!;
    expect(await bcrypt.compare(input.password, stored.passwordHash)).toBe(true);
    expect(bcrypt.getRounds(stored.passwordHash)).toBe(12);
    const header = (response.headers['set-cookie'] as unknown as string[])[0]!;
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Path=/api/v1/auth');
    expect([...repository.tokens.values()][0]!.tokenHash).not.toContain(
      cookie(response).split('=')[1],
    );
    expect(response.headers['cache-control']).toBe('no-store');
    const me = await request(app)
      .get('/api/v1/auth/me')
      .auth(response.body.data.accessToken, { type: 'bearer' });
    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(stored.id);
  });

  it('rejects duplicates and privilege escalation', async () => {
    expect((await post(app, 'register').send(input)).status).toBe(201);
    expect((await post(app, 'register').send(input)).status).toBe(409);
    expect((await post(app, 'register').send({ ...input, role: 'ADMIN' })).status).toBe(422);
  });

  it('rejects weak and overlong UTF-8 passwords', async () => {
    for (const password of ['short', '🔐'.repeat(19)])
      expect((await post(app, 'register').send({ ...input, password })).status).toBe(422);
  });

  it('uses generic login errors and accepts correct credentials', async () => {
    await post(app, 'register').send(input);
    const incorrect = await post(app, 'login').send({ email: input.email, password: 'incorrect' });
    const absent = await post(app, 'login').send({
      email: 'missing@example.test',
      password: input.password,
    });
    expect(incorrect.status).toBe(401);
    expect(absent.body.error).toEqual(incorrect.body.error);
    expect(
      (await post(app, 'login').send({ email: input.email, password: input.password })).status,
    ).toBe(200);
  });

  it('rotates refresh cookies and revokes the family if a spent token is replayed', async () => {
    const first = await post(app, 'register').send(input);
    const rotated = await post(app, 'refresh').set('Cookie', cookie(first)).send({});
    expect(rotated.status).toBe(200);
    expect(cookie(rotated)).not.toBe(cookie(first));
    const replay = await post(app, 'refresh').set('Cookie', cookie(first)).send({});
    expect(replay.status).toBe(401);
    expect((await post(app, 'refresh').set('Cookie', cookie(rotated)).send({})).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .auth(rotated.body.data.accessToken, { type: 'bearer' })
      ).status,
    ).toBe(401);
  });

  it('revokes only the current session on logout and clears its cookie', async () => {
    const first = await post(app, 'register').send(input);
    const second = await post(app, 'login').send({ email: input.email, password: input.password });
    const logout = await post(app, 'logout').set('Cookie', cookie(first)).send({});
    expect(logout.status).toBe(200);
    expect((logout.headers['set-cookie'] as unknown as string[])[0]).toContain(
      'Expires=Thu, 01 Jan 1970',
    );
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .auth(first.body.data.accessToken, { type: 'bearer' })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .auth(second.body.data.accessToken, { type: 'bearer' })
      ).status,
    ).toBe(200);
    expect((await post(app, 'logout').send({})).status).toBe(200);
  });

  it('rejects unauthenticated access, missing refresh cookies, and CSRF-style form posts', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await post(app, 'refresh').send({})).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/register').send(input)).status).toBe(403);
    expect((await post(app, 'refresh').send({ userId: randomUUID() })).status).toBe(422);
  });

  it('rejects expired access tokens and using a refresh token as an access token', async () => {
    const registered = await post(app, 'register').send(input);
    const record = [...repository.tokens.values()][0]!;
    const expired = jwt.sign({ sid: record.familyId, kind: 'access' }, testSecrets.access, {
      subject: record.userId,
      jwtid: randomUUID(),
      issuer: 'linkup',
      audience: 'linkup:access',
      expiresIn: -1,
    });
    expect(
      (await request(app).get('/api/v1/auth/me').auth(expired, { type: 'bearer' })).status,
    ).toBe(401);
    const refresh = cookie(registered).split('=')[1]!;
    expect(
      (await request(app).get('/api/v1/auth/me').auth(refresh, { type: 'bearer' })).status,
    ).toBe(401);
  });

  it('rejects expired refresh records and forged tokens', async () => {
    const first = await post(app, 'register').send(input);
    [...repository.tokens.values()][0]!.expiresAt = new Date(0);
    expect((await post(app, 'refresh').set('Cookie', cookie(first)).send({})).status).toBe(401);
    expect(
      (await request(app).get('/api/v1/auth/me').auth('forged.token.value', { type: 'bearer' }))
        .status,
    ).toBe(401);
  });

  it('rate-limits repeated credential submissions', async () => {
    for (let index = 0; index < 20; index++) await post(app, 'login').send({});
    const response = await post(app, 'login').send({});
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('AUTH_RATE_LIMITED');
  });
});

describe('authorization and configuration', () => {
  it('enforces role checks and ownership on the server', async () => {
    const repository = new MemoryAuthRepository();
    const service = new AuthService(repository, new AuthTokens(testSecrets));
    const session = await service.register(input);
    const app = express();
    app.get('/admin', requireAuth(service), requireRole('ADMIN'), (_req, res) =>
      res.json({ allowed: true }),
    );
    app.use(errorHandler);
    expect(
      (await request(app).get('/admin').auth(session.accessToken, { type: 'bearer' })).status,
    ).toBe(403);
    repository.users.get(session.user.id)!.role = 'ADMIN';
    expect(
      (await request(app).get('/admin').auth(session.accessToken, { type: 'bearer' })).status,
    ).toBe(200);
    expect(() => assertOwnership('another-user', session.user.id)).toThrow('access');
    expect(() => assertOwnership(session.user.id, session.user.id)).not.toThrow();
  });

  it('requires distinct strong secrets and complete production settings', () => {
    expect(() => parseEnv({ JWT_ACCESS_SECRET: 'short' })).toThrow('JWT_ACCESS_SECRET');
    expect(() =>
      parseEnv({ JWT_ACCESS_SECRET: testSecrets.access, JWT_REFRESH_SECRET: testSecrets.access }),
    ).toThrow('JWT_REFRESH_SECRET');
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow('DATABASE_URL');
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localhost/linkup',
        JWT_ACCESS_SECRET: testSecrets.access,
        JWT_REFRESH_SECRET: testSecrets.refresh,
      }),
    ).not.toThrow();
  });
});
