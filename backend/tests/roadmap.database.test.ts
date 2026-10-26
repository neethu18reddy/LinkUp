import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { disconnectDatabase, getDatabase } from '../src/config/database.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'Prisma roadmap integration',
  () => {
    const app = createApp({
      authSecrets: { access: 'roadmap-access-'.repeat(4), refresh: 'roadmap-refresh-'.repeat(4) },
      roadmapProvider: null,
    });
    const users: string[] = [];
    async function account() {
      const result = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Linkup-Request', '1')
        .send({
          name: 'Roadmap Learner',
          email: `roadmap-${randomUUID()}@example.test`,
          password: 'LearningTogether!42',
        });
      expect(result.status).toBe(201);
      users.push(result.body.data.user.id);
      return {
        id: result.body.data.user.id as string,
        token: result.body.data.accessToken as string,
      };
    }
    async function goal(token: string) {
      const result = await request(app)
        .post('/api/v1/goals')
        .auth(token, { type: 'bearer' })
        .send({ kind: 'ROLE', roleId: '10000000-0000-4000-8000-000000000001' });
      expect(result.status).toBe(200);
      return result.body.data.goal.id as string;
    }
    afterAll(async () => {
      if (users.length) await getDatabase()!.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDatabase();
    });
    it('persists nested roadmap versions across sessions and enforces ownership', async () => {
      const owner = await account();
      const other = await account();
      const goalId = await goal(owner.token);
      const first = await request(app)
        .post('/api/v1/roadmaps/generate')
        .auth(owner.token, { type: 'bearer' })
        .send({ goalId });
      expect(first.status).toBe(201);
      const roadmap = first.body.data.roadmap;
      expect(roadmap.phases).toHaveLength(2);
      expect(roadmap.phases[0].topics[0].estimatedHours).toEqual(expect.any(Number));
      const hours = roadmap.phases
        .flatMap((phase: { topics: { estimatedHours: number }[] }) => phase.topics)
        .reduce((sum: number, topic: { estimatedHours: number }) => sum + topic.estimatedHours, 0);
      expect(roadmap.totalEstimatedHours).toBe(hours);
      expect(
        (
          await request(
            createApp({
              authSecrets: {
                access: 'roadmap-access-'.repeat(4),
                refresh: 'roadmap-refresh-'.repeat(4),
              },
              roadmapProvider: null,
            }),
          )
            .get(`/api/v1/roadmaps/${roadmap.id}`)
            .auth(owner.token, { type: 'bearer' })
        ).body.data.roadmap,
      ).toEqual(roadmap);
      expect(
        (
          await request(app)
            .get(`/api/v1/roadmaps/${roadmap.id}`)
            .auth(other.token, { type: 'bearer' })
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .post(`/api/v1/roadmaps/${roadmap.id}/regenerate`)
            .auth(other.token, { type: 'bearer' })
            .send({})
        ).status,
      ).toBe(404);
      const next = await request(app)
        .post(`/api/v1/roadmaps/${roadmap.id}/regenerate`)
        .auth(owner.token, { type: 'bearer' })
        .send({});
      expect(next.status).toBe(201);
      expect(next.body.data.roadmap.version).toBe(2);
      expect(await getDatabase()!.roadmap.count({ where: { userId: owner.id } })).toBe(2);
      expect(
        (await request(app).get('/api/v1/roadmaps/current').auth(owner.token, { type: 'bearer' }))
          .body.data.roadmap.id,
      ).toBe(next.body.data.roadmap.id);
    });
    it('enforces three persisted attempts under concurrent requests', async () => {
      const owner = await account();
      const goalId = await goal(owner.token);
      const responses = await Promise.all(
        Array.from({ length: 4 }, () =>
          request(app)
            .post('/api/v1/roadmaps/generate')
            .auth(owner.token, { type: 'bearer' })
            .send({ goalId }),
        ),
      );
      expect(responses.map((response) => response.status).sort()).toEqual([201, 201, 201, 429]);
      expect(await getDatabase()!.roadmap.count({ where: { userId: owner.id } })).toBe(3);
      expect(
        (
          await getDatabase()!.dailyUsage.findFirstOrThrow({
            where: { userId: owner.id, kind: 'ROADMAP' },
          })
        ).count,
      ).toBe(3);
    });
    it('rejects stale goals and unvalidated request fields without writing roadmaps', async () => {
      const owner = await account();
      const goalId = await goal(owner.token);
      expect(
        (
          await request(app)
            .post('/api/v1/roadmaps/generate')
            .auth(owner.token, { type: 'bearer' })
            .send({ goalId, userId: owner.id })
        ).status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .get('/api/v1/roadmaps/not-a-uuid')
            .auth(owner.token, { type: 'bearer' })
        ).status,
      ).toBe(422);
      await request(app)
        .post('/api/v1/goals')
        .auth(owner.token, { type: 'bearer' })
        .send({ kind: 'CUSTOM', targetRole: 'Learn Figma', expectedGoalId: goalId });
      expect(
        (
          await request(app)
            .post('/api/v1/roadmaps/generate')
            .auth(owner.token, { type: 'bearer' })
            .send({ goalId })
        ).status,
      ).toBe(409);
      expect(await getDatabase()!.roadmap.count({ where: { userId: owner.id } })).toBe(0);
    });
    it('rolls back partial nested writes on invalid foreign keys', async () => {
      const owner = await account();
      const goalId = await goal(owner.token);
      const { PrismaRoadmapRepository } =
        await import('../src/modules/roadmap/roadmap.repository.js');
      await expect(
        new PrismaRoadmapRepository().save(
          owner.id,
          goalId,
          {
            title: 'Invalid',
            phases: [
              {
                title: 'Phase',
                description: 'Invalid skill reference',
                topics: [
                  {
                    title: 'Topic',
                    skillId: randomUUID(),
                    subtopics: ['Practice'],
                    estimatedHours: 1,
                    difficulty: 'BEGINNER',
                    resources: [],
                    isProject: true,
                  },
                ],
              },
            ],
          },
          'template',
        ),
      ).rejects.toBeDefined();
      expect(await getDatabase()!.roadmap.count({ where: { userId: owner.id } })).toBe(0);
    });
  },
);
