import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { getDatabase, disconnectDatabase } from '../src/config/database.js';
import { beginWatch, heartbeat } from '../src/modules/studio/studio.watch.js';
import { analytics, recap } from '../src/modules/studio/studio.analytics.js';
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'Studio owner-scoped learning flow',
  () => {
    const app = createApp({
      authSecrets: {
        access: 'studio-flow-access-'.repeat(4),
        refresh: 'studio-flow-refresh-'.repeat(4),
      },
      roadmapProvider: null,
    });
    const users: string[] = [],
      db = () => getDatabase()!;
    afterAll(async () => {
      await db().user.deleteMany({ where: { id: { in: users } } });
      await disconnectDatabase();
    });
    async function account() {
      const result = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Linkup-Request', '1')
        .send({
          name: 'Studio learner',
          email: `studio-flow-${randomUUID()}@example.test`,
          password: 'LearningTogether!42',
        });
      expect(result.status).toBe(201);
      users.push(result.body.data.user.id);
      return {
        token: result.body.data.accessToken as string,
        userId: result.body.data.user.id as string,
      };
    }
    const api = (method: 'get' | 'post' | 'patch' | 'delete', path: string, token: string) =>
      request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
    it('previews, edits, saves, searches and exports owned documents while preserving item IDs', async () => {
      const owner = await account(),
        other = await account();
      const preview = await api('post', '/resources/import/preview', owner.token).send({
        provider: 'custom',
        title: 'My JS practice',
        items: [{ title: 'JavaScript arrays' }, { title: 'JavaScript functions' }],
      });
      expect(preview.status).toBe(200);
      const body = {
        previewToken: preview.body.data.previewToken,
        title: 'My JS practice',
        sections: preview.body.data.sections,
      };
      expect((await api('post', '/resources', other.token).send(body)).status).toBe(422);
      const saved = await api('post', '/resources', owner.token).send(body);
      expect(saved.status).toBe(201);
      const resource = saved.body.data,
        item = resource.sections[0].items[0];
      expect((await api('get', `/resources/${resource.id}`, other.token)).status).toBe(404);
      expect(
        (
          await api('post', '/progress/complete', other.token).send({
            itemId: item.id,
            complete: true,
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await api('post', '/progress/complete', owner.token).send({
            itemId: item.id,
            complete: true,
          })
        ).status,
      ).toBe(200);
      const note = await api('post', '/notes', owner.token).send({
        resourceId: resource.id,
        itemId: item.id,
        bodyMd: '# My idea\nSafe Markdown',
        timestampSec: 5,
      });
      expect(note.status).toBe(200);
      const snippet = await api('post', '/snippets', owner.token).send({
        resourceId: resource.id,
        itemId: item.id,
        title: 'First example',
        language: 'javascript',
        code: 'console.log(5)',
      });
      expect(snippet.status).toBe(200);
      expect(
        (await api('get', `/snippets/${snippet.body.data.id}/versions`, other.token)).status,
      ).toBe(404);
      const edit = await api('patch', `/resources/${resource.id}/sections`, owner.token).send({
        version: resource.version,
        sections: [
          {
            title: 'Moved chapter',
            topicSummary: 'Still my work',
            topicTags: ['javascript'],
            skills: [{ skillId: '00000000-0000-4000-8000-000000000001', confidence: 1 }],
            itemKeys: resource.sections
              .flatMap((section: { items: { id: string }[] }) =>
                section.items.map((item) => item.id),
              )
              .reverse(),
          },
        ],
      });
      expect(edit.status).toBe(200);
      expect(
        await db().itemProgress.findUnique({
          where: { userId_itemId: { userId: owner.userId, itemId: item.id } },
        }),
      ).toMatchObject({ status: 'completed' });
      expect(await db().studioNote.findUnique({ where: { id: note.body.data.id } })).toMatchObject({
        itemId: item.id,
      });
      expect(
        (await api('get', `/notes?search=Safe&resourceId=${resource.id}`, owner.token)).body.data,
      ).toHaveLength(1);
      expect(
        (await api('get', `/resources/${resource.id}/export`, owner.token)).body.data.snippets,
      ).toHaveLength(1);
      const updated = await api('patch', '/notes', owner.token).send({
        ...note.body.data,
        bodyMd: 'Edited',
        createdAt: undefined,
        updatedAt: undefined,
        userId: undefined,
      });
      expect(updated.status).toBe(200);
      const conflict = await api('patch', '/notes', owner.token).send({
        id: note.body.data.id,
        resourceId: resource.id,
        itemId: item.id,
        bodyMd: 'Stale edit',
        version: 1,
      });
      expect(conflict.status).toBe(409);
      expect((await api('delete', `/resources/${resource.id}`, other.token)).status).toBe(404);
      expect((await api('delete', `/resources/${resource.id}`, owner.token)).status).toBe(200);
      expect(await db().studioNote.count({ where: { resourceId: resource.id } })).toBe(0);
      expect(await db().codeSnippet.count({ where: { resourceId: resource.id } })).toBe(0);
    });
    it('deduplicates heartbeats, excludes concurrent tabs, splits midnight and auto-completes', async () => {
      const owner = await account();
      await db().userSettings.create({
        data: { userId: owner.userId, timezone: 'Asia/Kolkata', timezoneConfirmed: true },
      });
      const resource = await db().studioResource.create({
        data: {
          userId: owner.userId,
          provider: 'youtube',
          title: 'Time accounting',
          totalDurationSec: 20,
          videoCount: 1,
        },
      });
      const section = await db().studioSection.create({
        data: {
          resourceId: resource.id,
          order: 0,
          title: 'First chapter',
          topicSummary: 'Practice',
          topicTags: ['javascript'],
        },
      });
      const item = await db().resourceItem.create({
        data: {
          resourceId: resource.id,
          sectionId: section.id,
          order: 0,
          title: 'Video',
          externalVideoId: 'dQw4w9WgXcQ',
          durationSec: 20,
        },
      });
      const start = new Date('2026-11-01T18:29:50Z'),
        end = new Date('2026-11-01T18:30:10Z'),
        sessionId = randomUUID();
      await beginWatch(owner.userId, sessionId, item.id, false, start);
      await expect(
        beginWatch(owner.userId, randomUUID(), item.id, false, new Date(start.getTime() + 1000)),
      ).rejects.toMatchObject({ code: 'WATCH_ACTIVE_ELSEWHERE' });
      const body = {
        sessionId,
        itemId: item.id,
        requestId: randomUUID(),
        wallSec: 20,
        contentSec: 20,
        positionSec: 20,
        ended: true,
        release: false,
      };
      await heartbeat(owner.userId, body, end);
      await heartbeat(owner.userId, body, new Date(end.getTime() + 1000));
      expect(
        await db().itemProgress.findUnique({
          where: { userId_itemId: { userId: owner.userId, itemId: item.id } },
        }),
      ).toMatchObject({ watchedSec: 20, status: 'completed' });
      const days = await db().dailyStat.findMany({
        where: { userId: owner.userId },
        orderBy: { localDate: 'asc' },
      });
      expect(days.map((day) => [day.localDate, day.secondsWatched, day.videosCompleted])).toEqual([
        ['2026-11-01', 10, 0],
        ['2026-11-02', 10, 1],
      ]);
      expect(await recap(owner.userId, '2026-11-01', end)).toMatchObject({ provisional: true });
      expect(await db().dailyRecap.count({ where: { userId: owner.userId } })).toBe(0);
      const first = await recap(owner.userId, '2026-11-01', new Date('2026-11-02T18:30:00Z'));
      const second = await recap(owner.userId, '2026-11-01', new Date('2026-11-03T18:30:00Z'));
      expect(second).toEqual(first);
      expect((await analytics(owner.userId, resource.id, 7, end)).watchedSec).toBe(20);
      await api('post', '/progress/complete', owner.token).send({
        itemId: item.id,
        complete: false,
      });
      await heartbeat(
        owner.userId,
        { ...body, requestId: randomUUID(), wallSec: 30, contentSec: 30 },
        new Date(end.getTime() + 10000),
      );
      expect(
        await db().itemProgress.findUniqueOrThrow({
          where: { userId_itemId: { userId: owner.userId, itemId: item.id } },
        }),
      ).toMatchObject({ status: 'in_progress', completedBy: 'manual' });
      expect(section.resourceId).toBe(resource.id);
      const apiSessionId = randomUUID();
      const started = await api('post', '/progress/watch', owner.token).send({
        sessionId: apiSessionId,
        itemId: item.id,
      });
      expect(started.status).toBe(200);
      const beacon = {
        sessionId: apiSessionId,
        itemId: item.id,
        requestId: randomUUID(),
        wallSec: 0,
        contentSec: 0,
        positionSec: 0,
        ended: false,
        release: true,
        token: started.body.data.token,
      };
      expect(
        (await request(app).post('/api/v1/progress/heartbeat/beacon').send(beacon)).status,
      ).toBe(204);
      expect(
        (await request(app).post('/api/v1/progress/heartbeat/beacon').send(beacon)).status,
      ).toBe(204);
      expect(
        (
          await request(app)
            .post('/api/v1/progress/heartbeat/beacon')
            .send({ ...beacon, itemId: randomUUID() })
        ).status,
      ).toBe(401);
    });
  },
);
