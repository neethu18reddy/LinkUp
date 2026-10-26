import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { getDatabase, disconnectDatabase } from '../src/config/database.js';
import { PrismaChatRepository } from '../src/modules/chat/chat.repository.js';
import type { MentorProvider } from '../src/ai/mentor.provider.js';
const secrets = { access: 'mentor-db-access-'.repeat(4), refresh: 'mentor-db-refresh-'.repeat(4) };
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'Prisma mentor history',
  () => {
    const app = createApp({ authSecrets: secrets, roadmapProvider: null });
    const users: string[] = [];
    const body = () => ({
      requestId: randomUUID(),
      sessionId: null,
      expectedVersion: 0,
      message: 'How am I doing?',
    });
    async function account() {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Linkup-Request', '1')
        .send({
          name: 'Mentor Learner',
          email: `mentor-${randomUUID()}@example.test`,
          password: 'LearningTogether!42',
        });
      expect(response.status).toBe(201);
      users.push(response.body.data.user.id);
      return {
        id: response.body.data.user.id as string,
        token: response.body.data.accessToken as string,
      };
    }
    afterAll(async () => {
      if (users.length) await getDatabase()!.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDatabase();
    });
    it('persists ordered turns across app instances, replays retries once and paginates privately', async () => {
      const owner = await account(),
        other = await account(),
        input = body();
      const response = await request(app)
        .post('/api/v1/chat/message')
        .auth(owner.token, { type: 'bearer' })
        .send(input);
      expect(response.status).toBe(200);
      expect(response.text).toContain('event: done');
      const second = await request(app)
        .post('/api/v1/chat/message')
        .auth(owner.token, { type: 'bearer' })
        .send(input);
      expect(second.status).toBe(200);
      expect(
        await getDatabase()!.chatMessage.count({ where: { sessionId: input.requestId } }),
      ).toBe(2);
      expect(
        (
          await getDatabase()!.dailyUsage.findFirstOrThrow({
            where: { userId: owner.id, kind: 'CHAT' },
          })
        ).count,
      ).toBe(1);
      const fresh = createApp({ authSecrets: secrets, roadmapProvider: null });
      const history = await request(fresh)
        .get('/api/v1/chat/history')
        .auth(owner.token, { type: 'bearer' })
        .query({ sessionId: input.requestId, limit: 1 });
      expect(history.body.data.messages[0].role).toBe('ASSISTANT');
      expect(history.body.data.nextBefore).toBe(1);
      const earlier = await request(app)
        .get('/api/v1/chat/history')
        .auth(owner.token, { type: 'bearer' })
        .query({ sessionId: input.requestId, before: 1 });
      expect(earlier.body.data.messages[0].role).toBe('USER');
      expect(
        (
          await request(app)
            .get('/api/v1/chat/history')
            .auth(other.token, { type: 'bearer' })
            .query({ sessionId: input.requestId })
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .post('/api/v1/chat/message')
            .auth(owner.token, { type: 'bearer' })
            .send({ ...body(), sessionId: input.requestId })
        ).status,
      ).toBe(409);
    });
    it('serializes a conversation reservation and enforces quota under concurrent claims', async () => {
      const owner = await account(),
        repository = new PrismaChatRepository(),
        input = body(),
        now = new Date();
      const reserved = await repository.reserve(owner.id, input, null, now);
      await expect(
        repository.reserve(owner.id, { ...body(), sessionId: reserved.session.id }, null, now),
      ).rejects.toMatchObject({ code: 'CHAT_BUSY' });
      await repository.release(owner.id, reserved.session.id, reserved.token!);
      const date = new Date(now);
      date.setUTCHours(0, 0, 0, 0);
      await getDatabase()!.dailyUsage.updateMany({
        where: { userId: owner.id, kind: 'CHAT' },
        data: { count: 29 },
      });
      const results = await Promise.allSettled(
        [1, 2].map(() => repository.reserve(owner.id, body(), null, now)),
      );
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(
        (
          await getDatabase()!.dailyUsage.findUniqueOrThrow({
            where: { userId_date_kind: { userId: owner.id, date, kind: 'CHAT' } },
          })
        ).count,
      ).toBe(30);
    });
    it('does not save partial output and permits retry after provider failure', async () => {
      const owner = await account(),
        input = body();
      const failed: MentorProvider = {
        mode: 'mock',
        async *stream() {
          yield 'Partial';
          throw new Error('Unavailable');
        },
      };
      const failingApp = createApp({
        authSecrets: secrets,
        mentorProvider: failed,
        roadmapProvider: null,
      });
      const response = await request(failingApp)
        .post('/api/v1/chat/message')
        .auth(owner.token, { type: 'bearer' })
        .send(input);
      expect(response.text).toContain('event: error');
      expect(response.text).not.toContain('event: done');
      expect(
        await getDatabase()!.chatMessage.count({ where: { sessionId: input.requestId } }),
      ).toBe(0);
      expect(
        (await getDatabase()!.chatSession.findUniqueOrThrow({ where: { id: input.requestId } }))
          .busyToken,
      ).toBeNull();
      expect(
        (
          await request(app)
            .post('/api/v1/chat/message')
            .auth(owner.token, { type: 'bearer' })
            .send(input)
        ).text,
      ).toContain('event: done');
    });
    it('deletes owned history and prevents an in-flight response from restoring it', async () => {
      const owner = await account(),
        other = await account(),
        repository = new PrismaChatRepository(),
        input = body();
      const reserved = await repository.reserve(owner.id, input, null, new Date());
      expect(
        (
          await request(app)
            .delete('/api/v1/chat/history')
            .auth(other.token, { type: 'bearer' })
            .send({ sessionId: reserved.session.id })
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .delete('/api/v1/chat/history')
            .auth(owner.token, { type: 'bearer' })
            .send({ sessionId: reserved.session.id })
        ).status,
      ).toBe(200);
      await expect(
        repository.complete(owner.id, input, reserved, 'Late reply', 'offline'),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(
        await getDatabase()!.chatMessage.count({ where: { sessionId: reserved.session.id } }),
      ).toBe(0);
      expect(
        (await request(app).get('/api/v1/chat/sessions').auth(owner.token, { type: 'bearer' })).body
          .data.sessions,
      ).toEqual([]);
    });
    it('reclaims expired leases and rejects a stale stream commit', async () => {
      const owner = await account(),
        repository = new PrismaChatRepository(),
        input = body(),
        now = new Date();
      const old = await repository.reserve(owner.id, input, null, now);
      await getDatabase()!.chatSession.update({
        where: { id: old.session.id },
        data: { busyUntil: new Date(now.getTime() - 1000) },
      });
      const fresh = await repository.reserve(
        owner.id,
        { ...input, sessionId: old.session.id },
        null,
        now,
      );
      await expect(
        repository.complete(owner.id, input, old, 'Stale', 'offline'),
      ).rejects.toMatchObject({ code: 'CHAT_CHANGED' });
      const saved = await repository.complete(owner.id, input, fresh, 'Current reply', 'offline');
      expect(saved.messages).toHaveLength(2);
      expect(saved.session.version).toBe(2);
    });
  },
);
