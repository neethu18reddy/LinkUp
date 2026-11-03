import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { getDatabase, disconnectDatabase } from '../src/config/database.js';
import {
  discoverVideos,
  videoComments,
  reserveSearchBudget,
} from '../src/modules/youtube/youtube.discovery.js';
const originalKey = env.YOUTUBE_API_KEY;
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'YouTube API and persisted planning',
  () => {
    const app = createApp({
        authSecrets: {
          access: 'youtube-qa-access-'.repeat(4),
          refresh: 'youtube-qa-refresh-'.repeat(4),
        },
        roadmapProvider: null,
      }),
      users: string[] = [],
      db = () => getDatabase()!;
    afterEach(() => {
      env.YOUTUBE_API_KEY = originalKey;
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });
    afterAll(async () => {
      await db().user.deleteMany({ where: { id: { in: users } } });
      await db().youTubeSearchBudget.deleteMany({});
      await disconnectDatabase();
    });
    async function account() {
      const r = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Linkup-Request', '1')
        .send({
          name: 'YouTube learner',
          email: `youtube-${randomUUID()}@example.test`,
          password: 'LearningTogether!42',
        });
      expect(r.status).toBe(201);
      users.push(r.body.data.user.id);
      return { id: r.body.data.user.id as string, token: r.body.data.accessToken as string };
    }
    const call = (
      method: 'get' | 'post' | 'put' | 'patch' | 'delete',
      path: string,
      token: string,
    ) => request(app)[method](`/api/v1${path}`).auth(token, { type: 'bearer' });
    const metadata = (id: string, lang = 'en', extra = {}) => ({
      id,
      snippet: {
        title: 'JavaScript arrays',
        channelTitle: 'Teaching channel',
        publishedAt: '2026-01-01T00:00:00Z',
        defaultAudioLanguage: lang,
        liveBroadcastContent: 'none',
        thumbnails: { medium: { url: 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg' } },
      },
      contentDetails: { duration: 'PT30M' },
      status: { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed' },
      statistics: { viewCount: '10000', likeCount: '500', commentCount: '20' },
      ...extra,
    });
    it('uses official ordered searches, interleaves languages, batches metadata and reuses cache', async () => {
      env.YOUTUBE_API_KEY = 'fake-youtube';
      const owner = await account();
      const fetcher = vi.fn(async (value: URL | RequestInfo) => {
        const url = new URL(String(value));
        expect(url.hostname).toBe('www.googleapis.com');
        if (url.pathname.endsWith('/search')) {
          expect(url.searchParams.get('order')).toBe('rating');
          return Response.json({
            items: (url.searchParams.get('relevanceLanguage') === 'hi'
              ? ['bbbbbbbbbbb', 'ddddddddddd']
              : ['aaaaaaaaaaa', 'ccccccccccc']
            ).map((videoId) => ({ id: { videoId } })),
          });
        }
        return Response.json({
          items: [
            metadata('aaaaaaaaaaa'),
            metadata('bbbbbbbbbbb', 'hi'),
            metadata('ccccccccccc', 'en', { statistics: { viewCount: '0' } }),
            metadata('ddddddddddd', 'hi', {
              status: { embeddable: false, privacyStatus: 'public' },
            }),
          ],
        });
      });
      vi.stubGlobal('fetch', fetcher);
      const query = {
        topic: `arrays ${randomUUID()}`,
        language: 'both' as const,
        level: 'beginner' as const,
        order: 'rating' as const,
      };
      const first = await discoverVideos(owner.id, query);
      expect(first.videos.map((v) => v.id)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']);
      expect(first.videos[2]).toMatchObject({ views: '0', likes: null, comments: null });
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect((await discoverVideos(owner.id, query)).cached).toBe(true);
      expect(fetcher).toHaveBeenCalledTimes(3);
      const project = await db().youTubeSearchBudget.findFirst({
        where: { key: { startsWith: 'project:' } },
      });
      expect(project!.count).toBe(2);
    });
    it('limits user requests and atomically reserves the shared project allowance', async () => {
      await db().youTubeSearchBudget.deleteMany({});
      const owner = await account();
      const now = new Date();
      now.setUTCHours(12, 0, 0, 0);
      await reserveSearchBudget(owner.id, 79, now);
      await expect(reserveSearchBudget(owner.id, 2, now)).rejects.toMatchObject({
        code: 'YOUTUBE_SEARCH_LIMIT',
      });
      expect(
        (await db().youTubeSearchBudget.findFirst({ where: { key: { startsWith: 'user:' } } }))!
          .count,
      ).toBe(1);
      for (let i = 1; i <= 9; i++)
        await reserveSearchBudget(owner.id, 0, new Date(now.getTime() + i * 60000));
      await expect(
        reserveSearchBudget(owner.id, 0, new Date(now.getTime() + 10 * 60000)),
      ).rejects.toMatchObject({
        code: 'YOUTUBE_SEARCH_LIMIT',
      });
      const other = await account();
      for (let i = 0; i < 3; i++) await reserveSearchBudget(other.id, 0, now);
      await expect(reserveSearchBudget(other.id, 0, now)).rejects.toMatchObject({
        code: 'YOUTUBE_SEARCH_LIMIT',
      });
    });
    it('caches top comments and handles disabled comments and quota errors safely', async () => {
      env.YOUTUBE_API_KEY = 'fake-youtube';
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            items: [
              {
                id: 'thread',
                snippet: {
                  topLevelComment: {
                    id: 'comment',
                    snippet: {
                      textDisplay: '<script>not executable</script> Useful example.',
                      authorDisplayName: 'Learner',
                      likeCount: 2,
                    },
                  },
                },
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          Response.json({ error: { errors: [{ reason: 'commentsDisabled' }] } }, { status: 403 }),
        )
        .mockResolvedValueOnce(
          Response.json({ error: { errors: [{ reason: 'quotaExceeded' }] } }, { status: 403 }),
        );
      vi.stubGlobal('fetch', fetcher);
      expect((await videoComments('eeeeeeeeeee')).comments[0]!.text).toContain('<script>');
      expect((await videoComments('eeeeeeeeeee')).cached).toBe(true);
      expect((await videoComments('fffffffffff')).unavailable).toBe(true);
      await expect(videoComments('ggggggggggg')).rejects.toMatchObject({ code: 'YOUTUBE_QUOTA' });
      expect(fetcher).toHaveBeenCalledTimes(3);
    });
    it('authenticates routes and preserves progress through preview/save/version conflicts/deletion', async () => {
      const owner = await account(),
        other = await account();
      env.YOUTUBE_API_KEY = undefined;
      expect((await request(app).get('/api/v1/youtube/recommendations')).status).toBe(401);
      expect(
        (await call('get', '/youtube/recommendations?topic=arrays&language=en', owner.token))
          .status,
      ).toBe(503);
      const imported = await call('post', '/resources/import/preview', owner.token).send({
        provider: 'youtube',
        input: 'https://youtu.be/hhhhhhhhhhh',
        title: 'My favorite',
      });
      expect(imported.status).toBe(200);
      const preview = imported.body.data;
      const p = {
        goal: 'Learn arrays',
        level: 'beginner',
        language: 'both',
        timezone: 'Asia/Kolkata',
        dailyMinutes: 20,
        weekdays: [1, 2, 3, 4, 5],
        startDate: '2026-11-04',
        targetDate: null,
        estimates: { [preview.items[0].key]: 1800 },
      };
      const scheduled = await call(
        'post',
        '/resources/import/study-plan-preview',
        owner.token,
      ).send({ previewToken: preview.previewToken, sections: preview.sections, preferences: p });
      expect(scheduled.status).toBe(200);
      expect(scheduled.body.data.totalMinutes).toBe(45);
      const resource = (
        await call('post', '/resources', owner.token).send({
          previewToken: preview.previewToken,
          title: 'Favorite course',
          sections: preview.sections,
        })
      ).body.data;
      const item = resource.sections[0].items[0];
      await call('post', '/progress/complete', owner.token).send({
        itemId: item.id,
        complete: true,
      });
      const body = { version: 0, preferences: { ...p, estimates: { [item.id]: 1800 } } };
      expect(
        (await call('put', `/resources/${resource.id}/study-plan`, other.token).send(body)).status,
      ).toBe(404);
      const saved = await call('put', `/resources/${resource.id}/study-plan`, owner.token).send(
        body,
      );
      expect(saved.status).toBe(200);
      expect(saved.body.data.version).toBe(1);
      expect(
        (await call('put', `/resources/${resource.id}/study-plan`, owner.token).send(body)).status,
      ).toBe(409);
      const reload = await call('get', `/resources/${resource.id}/study-plan`, owner.token);
      expect(reload.body.data.schedule.days[0].tasks[0].itemId).toBe(item.id);
      expect(
        (
          await db().itemProgress.findUniqueOrThrow({
            where: { userId_itemId: { userId: owner.id, itemId: item.id } },
          })
        ).status,
      ).toBe('completed');
      await call('patch', `/resources/${resource.id}`, owner.token).send({
        title: 'Renamed course',
        version: 1,
      });
      expect(
        (await call('get', `/resources/${resource.id}/study-plan`, owner.token)).body.data.stale,
      ).toBe(true);
      expect((await call('get', '/youtube/preferences', owner.token)).body.data.language).toBe(
        'both',
      );
      await call('delete', `/resources/${resource.id}`, owner.token);
      expect(await db().youTubeStudyPlan.count({ where: { resourceId: resource.id } })).toBe(0);
    });
  },
);
