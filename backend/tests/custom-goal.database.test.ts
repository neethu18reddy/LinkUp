import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { disconnectDatabase, getDatabase } from '../src/config/database.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'custom and expanded goal scheduling',
  () => {
    const app = createApp({
      roadmapProvider: null,
      authSecrets: {
        access: 'custom-flow-access-'.repeat(4),
        refresh: 'custom-flow-refresh-'.repeat(4),
      },
    });
    const users: string[] = [];
    afterAll(async () => {
      if (users.length) await getDatabase()!.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDatabase();
    });
    it.each(['custom', 'career'])(
      'persists a %s goal roadmap and conserves hours across saved weeks',
      async (kind) => {
        const registration = await request(app)
          .post('/api/v1/auth/register')
          .set('X-Linkup-Request', '1')
          .send({
            name: 'Goal Flow QA',
            email: `goal-flow-${randomUUID()}@example.test`,
            password: 'LocalLearning!42',
          });
        expect(registration.status).toBe(201);
        users.push(registration.body.data.user.id);
        const token = registration.body.data.accessToken as string;
        const post = (path: string, body: object) =>
          request(app).post(`/api/v1${path}`).auth(token, { type: 'bearer' }).send(body);
        const get = (path: string) =>
          request(app).get(`/api/v1${path}`).auth(token, { type: 'bearer' });
        const roles = (await get('/roles')).body.data.roles;
        const input =
          kind === 'custom'
            ? { kind: 'CUSTOM', targetRole: 'Learn photography' }
            : {
                kind: 'ROLE',
                roleId: roles.find((role: { slug: string }) => role.slug === 'data-engineer').id,
              };
        const goal = await post('/goals', input);
        expect(goal.status).toBe(200);
        const generated = await post('/roadmaps/generate', { goalId: goal.body.data.goal.id });
        expect(generated.status).toBe(201);
        const roadmap = generated.body.data.roadmap;
        expect(roadmap.generationSource).toBe(kind === 'custom' ? 'template-custom' : 'template');
        expect(
          roadmap.phases.flatMap((phase: { topics: unknown[] }) => phase.topics).length,
        ).toBeGreaterThan(2);
        const settings = {
          roadmapId: roadmap.id,
          hoursPerWeek: 5,
          flexibilityMode: 'STANDARD',
          startDate: new Date().toISOString().slice(0, 10),
          targetEndDate: null,
          expectedPlanId: null,
        };
        const preview = await post('/plans/preview', settings);
        expect(preview.status).toBe(200);
        const saved = await post('/plans', {
          ...settings,
          previewToken: preview.body.data.preview.previewToken,
        });
        expect(saved.status).toBe(201);
        const plan = saved.body.data.plan;
        const allocations = plan.weeks.flatMap(
          (week: { items: { allocatedHours: number }[] }) => week.items,
        ) as { allocatedHours: number }[];
        expect(allocations.reduce((sum, item) => sum + item.allocatedHours, 0)).toBeCloseTo(
          roadmap.totalEstimatedHours,
        );
        const restored = await get(`/plans/current?roadmapId=${roadmap.id}`);
        expect(restored.status).toBe(200);
        expect(restored.body.data.plan).toEqual(plan);
        expect((await get('/roadmaps/current')).body.data.roadmap.id).toBe(roadmap.id);
        expect((await get('/progress/summary')).body.data.roadmap.id).toBe(roadmap.id);
      },
    );
  },
);
