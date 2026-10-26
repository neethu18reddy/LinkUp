import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { disconnectDatabase, getDatabase } from '../src/config/database.js';

const enabled = process.env.RUN_DATABASE_TESTS === 'true' && !!process.env.DATABASE_URL;

describe.skipIf(!enabled)('Prisma authentication integration', () => {
  const app = createApp({
    authSecrets: {
      access: 'database-test-access-'.repeat(4),
      refresh: 'database-test-refresh-'.repeat(4),
    },
  });
  const createdIds: string[] = [];
  const post = (path: string) =>
    request(app).post(`/api/v1/auth/${path}`).set('X-Linkup-Request', '1');
  const cookie = (response: request.Response) =>
    (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

  afterAll(async () => {
    if (createdIds.length)
      await getDatabase()!.user.deleteMany({ where: { id: { in: createdIds } } });
    await disconnectDatabase();
  });

  it('persists a full register, login, refresh, and logout flow against PostgreSQL', async () => {
    const input = {
      name: 'Database Learner',
      email: `auth-${randomUUID()}@example.test`,
      password: 'LearningTogether!42',
    };
    const registered = await post('register').send(input);
    expect(registered.status).toBe(201);
    createdIds.push(registered.body.data.user.id);
    const stored = await getDatabase()!.user.findUniqueOrThrow({ where: { id: createdIds[0] } });
    expect(stored.passwordHash).not.toBe(input.password);
    expect((await post('register').send(input)).status).toBe(409);
    const loggedIn = await post('login').send({ email: input.email, password: input.password });
    expect(loggedIn.status).toBe(200);
    const refreshed = await post('refresh').set('Cookie', cookie(loggedIn)).send({});
    expect(refreshed.status).toBe(200);
    const me = await request(app)
      .get('/api/v1/auth/me')
      .auth(refreshed.body.data.accessToken, { type: 'bearer' });
    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(stored.id);
    expect((await post('logout').set('Cookie', cookie(refreshed)).send({})).status).toBe(200);
    expect(
      (
        await request(app)
          .get('/api/v1/auth/me')
          .auth(refreshed.body.data.accessToken, { type: 'bearer' })
      ).status,
    ).toBe(401);
  }, 20_000);

  it('allows only one concurrent rotation and revokes the family on reuse', async () => {
    const registered = await post('register').send({
      name: 'Race Learner',
      email: `race-${randomUUID()}@example.test`,
      password: 'LearningTogether!42',
    });
    expect(registered.status).toBe(201);
    createdIds.push(registered.body.data.user.id);
    const responses = await Promise.all([
      post('refresh').set('Cookie', cookie(registered)).send({}),
      post('refresh').set('Cookie', cookie(registered)).send({}),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
    const active = await getDatabase()!.refreshToken.count({
      where: { userId: registered.body.data.user.id, revokedAt: null },
    });
    expect(active).toBe(0);
  }, 20_000);

  it('does not resurrect a session when logout races with refresh', async () => {
    const registered = await post('register').send({
      name: 'Logout Learner',
      email: `logout-${randomUUID()}@example.test`,
      password: 'LearningTogether!42',
    });
    expect(registered.status).toBe(201);
    createdIds.push(registered.body.data.user.id);
    const [refreshed, loggedOut] = await Promise.all([
      post('refresh').set('Cookie', cookie(registered)).send({}),
      post('logout').set('Cookie', cookie(registered)).send({}),
    ]);
    expect(loggedOut.status).toBe(200);
    expect([200, 401]).toContain(refreshed.status);
    expect(
      await getDatabase()!.refreshToken.count({
        where: { userId: registered.body.data.user.id, revokedAt: null },
      }),
    ).toBe(0);
  }, 20_000);
});
