import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { disconnectDatabase, getDatabase } from '../src/config/database.js';
import type { PlanSettings } from '../src/modules/plan/plan.schemas.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'Prisma weekly plans',
  () => {
    const app = createApp({
      authSecrets: { access: 'plan-access-'.repeat(4), refresh: 'plan-refresh-'.repeat(4) },
      roadmapProvider: null,
    });
    const users: string[] = [];
    async function account() {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Linkup-Request', '1')
        .send({
          name: 'Plan learner',
          email: `plan-${randomUUID()}@example.test`,
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
      const goal = await request(app)
        .post('/api/v1/goals')
        .auth(owner.token, { type: 'bearer' })
        .send({ kind: 'ROLE', roleId: '10000000-0000-4000-8000-000000000001' });
      const roadmap = await request(app)
        .post('/api/v1/roadmaps/generate')
        .auth(owner.token, { type: 'bearer' })
        .send({ goalId: goal.body.data.goal.id });
      expect(roadmap.status).toBe(201);
      return { ...owner, roadmapId: roadmap.body.data.roadmap.id as string };
    }
    function settings(roadmapId: string): PlanSettings {
      return {
        roadmapId,
        hoursPerWeek: 10,
        flexibilityMode: 'STANDARD',
        startDate: new Date().toISOString().slice(0, 10),
        targetEndDate: null,
        expectedPlanId: null,
      };
    }
    async function preview(token: string, input: PlanSettings) {
      const response = await request(app)
        .post('/api/v1/plans/preview')
        .auth(token, { type: 'bearer' })
        .send(input);
      expect(response.status).toBe(200);
      return { ...input, previewToken: response.body.data.preview.previewToken };
    }
    afterAll(async () => {
      if (users.length) await getDatabase()!.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDatabase();
    });
    it('persists ordered weekly allocations, protects ownership, and activates the roadmap', async () => {
      const owner = await fixture();
      const other = await account();
      const input = settings(owner.roadmapId);
      expect(
        (
          await request(app)
            .post('/api/v1/plans/preview')
            .auth(other.token, { type: 'bearer' })
            .send(input)
        ).status,
      ).toBe(404);
      const body = await preview(owner.token, input);
      const saved = await request(app)
        .post('/api/v1/plans')
        .auth(owner.token, { type: 'bearer' })
        .send(body);
      expect(saved.status).toBe(201);
      const plan = saved.body.data.plan;
      expect(plan.weeks[0].plannedHours).toBe(10);
      expect(
        (await getDatabase()!.roadmap.findUniqueOrThrow({ where: { id: owner.roadmapId } })).status,
      ).toBe('ACTIVE');
      expect(
        (await request(app).get(`/api/v1/plans/${plan.id}`).auth(owner.token, { type: 'bearer' }))
          .body.data.plan,
      ).toEqual(plan);
      expect(
        (await request(app).get(`/api/v1/plans/${plan.id}`).auth(other.token, { type: 'bearer' }))
          .status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .get('/api/v1/plans/current')
            .auth(owner.token, { type: 'bearer' })
            .query({ roadmapId: owner.roadmapId })
        ).body.data.plan.id,
      ).toBe(plan.id);
      expect(
        (await request(app).post('/api/v1/plans').auth(owner.token, { type: 'bearer' }).send(body))
          .status,
      ).toBe(409);
    });
    it('keeps completed allocations across repeated replans and rejects expired previews', async () => {
      const owner = await fixture();
      const first = await request(app)
        .post('/api/v1/plans')
        .auth(owner.token, { type: 'bearer' })
        .send(await preview(owner.token, settings(owner.roadmapId)));
      const plan = first.body.data.plan;
      const input = {
        ...settings(owner.roadmapId),
        hoursPerWeek: 5,
        expectedPlanId: plan.id as string,
      };
      const stale = await preview(owner.token, input);
      const item = await getDatabase()!.planItem.findFirstOrThrow({
        where: { planWeek: { planId: plan.id } },
        orderBy: { planWeek: { weekNumber: 'asc' } },
      });
      await getDatabase()!.planItem.update({
        where: { id: item.id },
        data: { status: 'DONE', completedAt: new Date() },
      });
      expect(
        (
          await request(app)
            .post(`/api/v1/plans/${plan.id}/replan`)
            .auth(owner.token, { type: 'bearer' })
            .send(stale)
        ).status,
      ).toBe(409);
      const saved = await request(app)
        .post(`/api/v1/plans/${plan.id}/replan`)
        .auth(owner.token, { type: 'bearer' })
        .send(await preview(owner.token, input));
      expect(saved.status).toBe(201);
      const second = saved.body.data.plan;
      expect(second.version).toBe(2);
      const done = second.weeks
        .flatMap((week: { items: { status: string; allocatedHours: number }[] }) => week.items)
        .filter((row: { status: string }) => row.status === 'DONE');
      expect(
        done.reduce((sum: number, row: { allocatedHours: number }) => sum + row.allocatedHours, 0),
      ).toBe(Number(item.allocatedHours));
      const third = await request(app)
        .patch(`/api/v1/plans/${second.id}`)
        .auth(owner.token, { type: 'bearer' })
        .send(await preview(owner.token, { ...input, expectedPlanId: second.id }));
      expect(third.status).toBe(201);
      expect(third.body.data.plan.version).toBe(3);
      expect(
        await getDatabase()!.plan.count({ where: { roadmapId: owner.roadmapId, isActive: true } }),
      ).toBe(1);
      expect(
        (await getDatabase()!.planItem.findUniqueOrThrow({ where: { id: item.id } })).status,
      ).toBe('DONE');
      expect(
        (await getDatabase()!.plan.findUniqueOrThrow({ where: { id: plan.id } })).isActive,
      ).toBe(false);
    });
    it('serializes competing confirmations and enforces the unique active-plan index', async () => {
      const owner = await fixture();
      const body = await preview(owner.token, settings(owner.roadmapId));
      const results = await Promise.all(
        [1, 2].map(() =>
          request(app).post('/api/v1/plans').auth(owner.token, { type: 'bearer' }).send(body),
        ),
      );
      expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
      await expect(
        getDatabase()!.plan.create({
          data: {
            roadmapId: owner.roadmapId,
            hoursPerWeek: 1,
            flexibilityMode: 'STANDARD',
            startDate: new Date(),
            projectedEndDate: new Date(),
            version: 99,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
    it('requires authentication, valid bodies and a matching preview before writes', async () => {
      expect((await request(app).get('/api/v1/plans/current')).status).toBe(401);
      const owner = await fixture();
      const input = settings(owner.roadmapId);
      expect(
        (
          await request(app)
            .post('/api/v1/plans/preview')
            .auth(owner.token, { type: 'bearer' })
            .send({ ...input, hoursPerWeek: 0 })
        ).status,
      ).toBe(422);
      expect(
        (
          await request(app)
            .post('/api/v1/plans')
            .auth(owner.token, { type: 'bearer' })
            .send({ ...input, previewToken: '0'.repeat(64) })
        ).status,
      ).toBe(409);
      expect(await getDatabase()!.plan.count({ where: { roadmapId: owner.roadmapId } })).toBe(0);
    });
  },
);
