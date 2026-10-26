import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { getDatabase, disconnectDatabase } from '../src/config/database.js';
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'Prisma certificates',
  () => {
    const app = createApp();
    const users: string[] = [];
    afterAll(async () => {
      if (users.length) await getDatabase()!.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDatabase();
    });
    async function account() {
      const result = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Linkup-Request', '1')
        .send({
          name: 'Certificate learner',
          email: `cert-${randomUUID()}@example.test`,
          password: 'LearningTogether!42',
        });
      expect(result.status).toBe(201);
      users.push(result.body.data.user.id);
      return {
        id: result.body.data.user.id as string,
        token: result.body.data.accessToken as string,
      };
    }
    it('gates issuance, deduplicates concurrent requests, isolates downloads and tracks reopened work', async () => {
      const owner = await account(),
        other = await account(),
        db = getDatabase()!;
      const goal = await db.goal.create({
        data: { userId: owner.id, targetRole: 'Frontend Developer' },
      });
      const roadmap = await db.roadmap.create({
        data: {
          userId: owner.id,
          goalId: goal.id,
          title: 'Certificate path',
          totalEstimatedHours: 2,
          phases: {
            create: {
              order: 0,
              title: 'Build',
              description: 'Practice',
              topics: {
                create: {
                  order: 0,
                  title: 'Project',
                  estimatedHours: 2,
                  difficulty: 'BEGINNER',
                  status: 'DONE',
                  isProject: true,
                },
              },
            },
          },
        },
        include: { phases: { include: { topics: true } } },
      });
      const issue = () =>
        request(app)
          .post('/api/v1/certificates/issue')
          .auth(owner.token, { type: 'bearer' })
          .send({ roadmapId: roadmap.id, publishAcknowledged: true });
      expect((await issue()).status).toBe(409);
      const topic = roadmap.phases[0]!.topics[0]!;
      await db.projectSubmission.create({
        data: {
          userId: owner.id,
          topicId: topic.id,
          title: 'Completed project',
          notes: 'Built and tested project evidence.',
        },
      });
      const results = await Promise.all([issue(), issue()]);
      expect(results.map((row) => row.status)).toEqual([200, 200]);
      expect(results[0]!.body.data.id).toBe(results[1]!.body.data.id);
      const certificate = results[0]!.body.data;
      expect(certificate.verificationCode).toMatch(/^[a-f0-9]{64}$/);
      expect(certificate.completedHours).toBe(2);
      expect(
        (
          await request(app)
            .get(`/api/v1/certificates/${certificate.id}/pdf`)
            .auth(other.token, { type: 'bearer' })
        ).status,
      ).toBe(404);
      const pdf = await request(app)
        .get(`/api/v1/certificates/${certificate.id}/pdf`)
        .auth(owner.token, { type: 'bearer' });
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      const verify = () =>
        request(app).get(`/api/v1/public/verify/${certificate.verificationCode}`);
      expect((await verify()).body.data.status).toBe('VALID');
      expect(JSON.stringify((await verify()).body)).not.toContain(owner.id);
      await db.topic.update({ where: { id: topic.id }, data: { status: 'TODO' } });
      expect((await verify()).body.data.status).toBe('INACTIVE');
      expect(
        (
          await request(app)
            .get(`/api/v1/certificates/${certificate.id}/pdf`)
            .auth(owner.token, { type: 'bearer' })
        ).status,
      ).toBe(409);
      await db.topic.update({ where: { id: topic.id }, data: { status: 'DONE' } });
      expect((await issue()).body.data.id).toBe(certificate.id);
      expect((await verify()).body.data.status).toBe('VALID');
    });
  },
);
