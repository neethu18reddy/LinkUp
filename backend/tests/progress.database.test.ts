import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { disconnectDatabase, getDatabase } from '../src/config/database.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'Prisma learning progress',
  () => {
    const app = createApp({
      authSecrets: { access: 'progress-access-'.repeat(4), refresh: 'progress-refresh-'.repeat(4) },
      roadmapProvider: null,
    });
    const users: string[] = [];
    const today = () => new Date().toISOString().slice(0, 10);
    async function account() {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Linkup-Request', '1')
        .send({
          name: 'Learning user',
          email: `progress-${randomUUID()}@example.test`,
          password: 'LearningTogether!42',
        });
      expect(response.status).toBe(201);
      users.push(response.body.data.user.id);
      return {
        id: response.body.data.user.id as string,
        token: response.body.data.accessToken as string,
      };
    }
    async function fixture() {
      const owner = await account();
      const goal = await getDatabase()!.goal.create({
        data: { userId: owner.id, targetRole: 'Learning' },
      });
      const roadmap = await getDatabase()!.roadmap.create({
        data: {
          userId: owner.id,
          goalId: goal.id,
          title: 'Test learning path',
          totalEstimatedHours: 12,
          phases: {
            create: {
              order: 0,
              title: 'Practice',
              description: 'Applied learning',
              topics: {
                create: [
                  {
                    order: 0,
                    title: 'React',
                    estimatedHours: 8,
                    difficulty: 'BEGINNER',
                    skillId: '00000000-0000-4000-8000-000000000005',
                  },
                  {
                    order: 1,
                    title: 'Project',
                    estimatedHours: 4,
                    difficulty: 'INTERMEDIATE',
                    isProject: true,
                  },
                ],
              },
            },
          },
        },
        include: { phases: { include: { topics: { orderBy: { order: 'asc' } } } } },
      });
      const settings = {
        roadmapId: roadmap.id,
        hoursPerWeek: 5,
        flexibilityMode: 'STANDARD',
        startDate: today(),
        targetEndDate: null,
        expectedPlanId: null,
      };
      const preview = await request(app)
        .post('/api/v1/plans/preview')
        .auth(owner.token, { type: 'bearer' })
        .send(settings);
      const plan = await request(app)
        .post('/api/v1/plans')
        .auth(owner.token, { type: 'bearer' })
        .send({ ...settings, previewToken: preview.body.data.preview.previewToken });
      expect(plan.status).toBe(201);
      return { ...owner, roadmap, plan: plan.body.data.plan };
    }
    afterAll(async () => {
      if (users.length) await getDatabase()!.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDatabase();
    });
    const patch = (token: string, id: string, status: string, expectedStatus = 'TODO') =>
      request(app)
        .patch(`/api/v1/plan-items/${id}`)
        .auth(token, { type: 'bearer' })
        .send({ status, expectedStatus });
    it('tracks partial hours, enforces ownership and preserves progress through replan', async () => {
      const owner = await fixture(),
        other = await account();
      const item = owner.plan.weeks[0].items[0];
      expect((await patch(other.token, item.id, 'DONE')).status).toBe(404);
      expect((await patch(owner.token, item.id, 'DONE')).status).toBe(200);
      const summary = await request(app)
        .get('/api/v1/progress/summary')
        .auth(owner.token, { type: 'bearer' });
      expect(summary.body.data.completedHours).toBe(5);
      expect(summary.body.data.overallPercent).toBe(41.67);
      expect(
        (await getDatabase()!.topic.findUniqueOrThrow({ where: { id: item.topicId } })).status,
      ).toBe('IN_PROGRESS');
      const settings = {
        roadmapId: owner.roadmap.id,
        hoursPerWeek: 3,
        flexibilityMode: 'STANDARD',
        startDate: today(),
        targetEndDate: null,
        expectedPlanId: owner.plan.id,
      };
      const preview = await request(app)
        .post('/api/v1/plans/preview')
        .auth(owner.token, { type: 'bearer' })
        .send(settings);
      const replan = await request(app)
        .post(`/api/v1/plans/${owner.plan.id}/replan`)
        .auth(owner.token, { type: 'bearer' })
        .send({ ...settings, previewToken: preview.body.data.preview.previewToken });
      expect(replan.status).toBe(201);
      expect(
        (await request(app).get('/api/v1/progress/summary').auth(owner.token, { type: 'bearer' }))
          .body.data.completedHours,
      ).toBe(5);
      expect((await patch(owner.token, item.id, 'TODO', 'DONE')).status).toBe(409);
    });
    it('requires project evidence, completes the roadmap, and supports reopening', async () => {
      const owner = await fixture();
      const items = owner.plan.weeks.flatMap(
        (week: { items: { id: string; topicId: string; isProject: boolean }[] }) => week.items,
      );
      const project = items.find((item: { isProject: boolean }) => item.isProject)!;
      expect((await patch(owner.token, project.id, 'DONE')).body.error.code).toBe(
        'PROJECT_REQUIRED',
      );
      const submission = await request(app)
        .post('/api/v1/projects')
        .auth(owner.token, { type: 'bearer' })
        .send({
          topicId: project.topicId,
          title: 'Learning app',
          repoUrl: 'https://example.test/project',
          notes: 'Implemented and tested the project.',
        });
      expect(submission.status).toBe(200);
      for (const item of items)
        expect((await patch(owner.token, item.id, 'DONE')).status).toBe(200);
      expect(
        (await getDatabase()!.roadmap.findUniqueOrThrow({ where: { id: owner.roadmap.id } }))
          .status,
      ).toBe('COMPLETED');
      expect((await patch(owner.token, items[0]!.id, 'TODO', 'DONE')).status).toBe(200);
      expect(
        (await getDatabase()!.roadmap.findUniqueOrThrow({ where: { id: owner.roadmap.id } }))
          .status,
      ).toBe('ACTIVE');
      expect((await patch(owner.token, items[0]!.id, 'SKIPPED', 'DONE')).status).toBe(409);
    });
    it('deduplicates concurrent learning logs, paginates privately and calculates streaks', async () => {
      const owner = await account(),
        other = await account();
      const body = {
        requestId: randomUUID(),
        topicId: null,
        minutes: 30,
        note: 'Practiced JavaScript',
        loggedOn: today(),
      };
      const responses = await Promise.all(
        [1, 2].map(() =>
          request(app).post('/api/v1/logs').auth(owner.token, { type: 'bearer' }).send(body),
        ),
      );
      expect(responses.map((response) => response.status)).toEqual([201, 201]);
      expect(responses[0]!.body.data.log.id).toBe(responses[1]!.body.data.log.id);
      const yesterday = new Date(Date.parse(today()) - 86400000).toISOString().slice(0, 10);
      await request(app)
        .post('/api/v1/logs')
        .auth(owner.token, { type: 'bearer' })
        .send({ ...body, requestId: randomUUID(), loggedOn: yesterday });
      const logs = await request(app)
        .get('/api/v1/logs?limit=1')
        .auth(owner.token, { type: 'bearer' });
      expect(logs.body.data.logs).toHaveLength(1);
      expect(logs.body.data.nextCursor).toBeTruthy();
      expect(
        (
          await request(app)
            .get('/api/v1/logs')
            .query({ cursor: logs.body.data.nextCursor })
            .auth(other.token, { type: 'bearer' })
        ).status,
      ).toBe(404);
      const summary = await request(app)
        .get('/api/v1/progress/summary')
        .auth(owner.token, { type: 'bearer' });
      expect(summary.body.data.streak).toBe(2);
      expect(summary.body.data.loggedMinutesLast7Days).toBe(60);
    });
    it('enforces per-day time caps and validates dates/ownership', async () => {
      const owner = await fixture(),
        other = await account();
      const body = {
        requestId: randomUUID(),
        topicId: owner.roadmap.phases[0]!.topics[0]!.id,
        minutes: 720,
        note: 'Practice',
        loggedOn: today(),
      };
      expect(
        (await request(app).post('/api/v1/logs').auth(other.token, { type: 'bearer' }).send(body))
          .status,
      ).toBe(404);
      for (let index = 0; index < 2; index++)
        expect(
          (
            await request(app)
              .post('/api/v1/logs')
              .auth(owner.token, { type: 'bearer' })
              .send({ ...body, requestId: randomUUID() })
          ).status,
        ).toBe(201);
      expect(
        (
          await request(app)
            .post('/api/v1/logs')
            .auth(owner.token, { type: 'bearer' })
            .send({ ...body, requestId: randomUUID(), minutes: 1 })
        ).body.error.code,
      ).toBe('DAILY_LOG_LIMIT');
      const concurrent = await Promise.all(
        [1, 2, 3].map(() =>
          request(app)
            .post('/api/v1/logs')
            .auth(other.token, { type: 'bearer' })
            .send({ ...body, requestId: randomUUID(), topicId: null }),
        ),
      );
      expect(concurrent.map((response) => response.status).sort()).toEqual([201, 201, 422]);
      expect(
        (
          await request(app)
            .post('/api/v1/logs')
            .auth(owner.token, { type: 'bearer' })
            .send({ ...body, loggedOn: '2099-01-01' })
        ).status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .get('/api/v1/progress/summary')
            .auth(other.token, { type: 'bearer' })
            .query({ roadmapId: owner.roadmap.id })
        ).status,
      ).toBe(404);
    });
    it('upserts owned projects and rejects non-project and unsafe submissions', async () => {
      const owner = await fixture(),
        other = await account();
      const topics = owner.roadmap.phases[0]!.topics;
      const input = {
        topicId: topics[1]!.id,
        title: 'App',
        repoUrl: null,
        notes: 'Documented learning project.',
      };
      expect(
        (
          await request(app)
            .post('/api/v1/projects')
            .auth(other.token, { type: 'bearer' })
            .send(input)
        ).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .post('/api/v1/projects')
            .auth(owner.token, { type: 'bearer' })
            .send({ ...input, topicId: topics[0]!.id })
        ).status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .post('/api/v1/projects')
            .auth(owner.token, { type: 'bearer' })
            .send({ ...input, repoUrl: 'javascript:alert(1)' })
        ).status,
      ).toBe(422);
      const first = await request(app)
        .post('/api/v1/projects')
        .auth(owner.token, { type: 'bearer' })
        .send(input);
      const second = await request(app)
        .post('/api/v1/projects')
        .auth(owner.token, { type: 'bearer' })
        .send({ ...input, title: 'Updated app' });
      expect(first.body.data.project.id).toBe(second.body.data.project.id);
      expect(
        (
          await request(app)
            .get('/api/v1/projects')
            .auth(owner.token, { type: 'bearer' })
            .query({ roadmapId: owner.roadmap.id })
        ).body.data.projects,
      ).toHaveLength(1);
    });
  },
);
