import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { getDatabase, disconnectDatabase } from '../src/config/database.js';
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'complete offline learning flow',
  () => {
    const app = createApp({
      authSecrets: { access: 'flow-access-'.repeat(4), refresh: 'flow-refresh-'.repeat(4) },
      roadmapProvider: null,
    });
    const users: string[] = [];
    afterAll(async () => {
      if (users.length) await getDatabase()!.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDatabase();
    });
    it('connects signup, skills, goal, roadmap, plan, logs, mentor, evidence and verifiable completion', async () => {
      const registration = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Linkup-Request', '1')
        .send({
          name: 'Flow Learner',
          email: `flow-${randomUUID()}@example.test`,
          password: 'LearningTogether!42',
        });
      expect(registration.status).toBe(201);
      users.push(registration.body.data.user.id);
      const token = registration.body.data.accessToken as string;
      const post = (path: string, body: object) =>
        request(app).post(`/api/v1${path}`).auth(token, { type: 'bearer' }).send(body);
      const get = (path: string) =>
        request(app).get(`/api/v1${path}`).auth(token, { type: 'bearer' });
      const skills = await get('/skills?search=Python');
      expect(skills.status).toBe(200);
      const skill = skills.body.data.skills.find((row: { name: string }) => row.name === 'Python');
      expect((await post('/me/skills', { skillId: skill.id, level: 'BEGINNER' })).status).toBe(201);
      const goal = await post('/goals', { kind: 'CUSTOM', targetRole: 'Learn Python' });
      expect(goal.status).toBe(200);
      const generated = await post('/roadmaps/generate', { goalId: goal.body.data.goal.id });
      expect(generated.status).toBe(201);
      const roadmap = generated.body.data.roadmap;
      expect(roadmap.generationSource).toBe('template');
      const settings = {
        roadmapId: roadmap.id,
        hoursPerWeek: 60,
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
      const items = saved.body.data.plan.weeks.flatMap(
        (week: { items: { id: string; topicId: string; isProject: boolean }[] }) => week.items,
      ) as { id: string; topicId: string; isProject: boolean }[];
      expect(items.length).toBeGreaterThan(0);
      expect(
        (
          await post('/logs', {
            requestId: randomUUID(),
            topicId: items[0]!.topicId,
            minutes: 30,
            note: 'Practiced and reviewed the first topic.',
            loggedOn: settings.startDate,
          })
        ).status,
      ).toBe(201);
      const mentor = await post('/chat/message', {
        requestId: randomUUID(),
        sessionId: null,
        expectedVersion: 0,
        message: 'What should I learn next?',
      });
      expect(mentor.status).toBe(200);
      expect(mentor.text).toContain('event: done');
      expect(
        (await post('/certificates/issue', { roadmapId: roadmap.id, publishAcknowledged: true }))
          .status,
      ).toBe(409);
      for (const item of items) {
        if (item.isProject)
          expect(
            (
              await post('/projects', {
                topicId: item.topicId,
                title: 'Python project',
                notes: 'Implemented, tested and documented the project.',
                repoUrl: null,
              })
            ).status,
          ).toBe(200);
        expect(
          (
            await request(app)
              .patch(`/api/v1/plan-items/${item.id}`)
              .auth(token, { type: 'bearer' })
              .send({ status: 'DONE', expectedStatus: 'TODO' })
          ).status,
        ).toBe(200);
      }
      expect((await get('/progress/summary')).body.data.overallPercent).toBe(100);
      const issued = await post('/certificates/issue', {
        roadmapId: roadmap.id,
        publishAcknowledged: true,
      });
      expect(issued.status).toBe(200);
      const certificate = issued.body.data;
      expect((await get(`/certificates/${certificate.id}/pdf`)).headers['content-type']).toContain(
        'application/pdf',
      );
      const verification = await request(app).get(
        `/api/v1/public/verify/${certificate.verificationCode}`,
      );
      expect(verification.body.data.status).toBe('VALID');
      expect(verification.body.data.recipientName).toBe('Flow Learner');
      expect(JSON.stringify(verification.body)).not.toContain(registration.body.data.user.email);
      expect(
        (await post('/certificates/issue', { roadmapId: roadmap.id, publishAcknowledged: true }))
          .body.data.id,
      ).toBe(certificate.id);
      expect(
        (
          await request(app)
            .patch(`/api/v1/plan-items/${items[0]!.id}`)
            .auth(token, { type: 'bearer' })
            .send({ status: 'TODO', expectedStatus: 'DONE' })
        ).status,
      ).toBe(200);
      expect(
        (await request(app).get(`/api/v1/public/verify/${certificate.verificationCode}`)).body.data
          .status,
      ).toBe('INACTIVE');
      expect((await get(`/certificates/${certificate.id}/pdf`)).status).toBe(409);
      expect((await get('/notifications/preferences')).body.data.remindersEnabled).toBe(true);
    }, 20000);
  },
);
