import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { disconnectDatabase, getDatabase } from '../src/config/database.js';
import { questionIds } from '../src/modules/quiz/quiz.data.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'Prisma goals and quiz integration',
  () => {
    const secrets = {
      access: 'career-db-access-'.repeat(4),
      refresh: 'career-db-refresh-'.repeat(4),
    };
    const app = createApp({ authSecrets: secrets });
    const users: string[] = [];
    const frontend = '10000000-0000-4000-8000-000000000001';
    const backend = '10000000-0000-4000-8000-000000000002';
    async function account() {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Linkup-Request', '1')
        .send({
          name: 'Career Learner',
          email: `career-${randomUUID()}@example.test`,
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
    it('migrates six roles with their required skills', async () => {
      const response = await request(app).get('/api/v1/roles');
      expect(response.status).toBe(200);
      expect(response.body.data.roles).toHaveLength(6);
      const role = response.body.data.roles.find((item: { id: string }) => item.id === frontend);
      expect(
        role.requirements.some((item: { skill: { name: string } }) => item.skill.name === 'React'),
      ).toBe(true);
      expect(await getDatabase()!.roleRequirement.count()).toBe(33);
    });
    it('persists custom and direct choices across app instances while preserving history and ownership', async () => {
      const owner = await account();
      const other = await account();
      const initial = await request(app)
        .post('/api/v1/goals')
        .auth(owner.token, { type: 'bearer' })
        .send({ kind: 'CUSTOM', targetRole: 'Learn Figma' });
      expect(initial.status).toBe(200);
      const chosen = await request(app)
        .post('/api/v1/goals')
        .auth(owner.token, { type: 'bearer' })
        .send({ kind: 'ROLE', roleId: frontend, expectedGoalId: initial.body.data.goal.id });
      expect(chosen.status).toBe(200);
      expect(
        (await getDatabase()!.goal.findUniqueOrThrow({ where: { id: initial.body.data.goal.id } }))
          .status,
      ).toBe('ARCHIVED');
      const fresh = createApp({ authSecrets: secrets });
      expect(
        (await request(fresh).get('/api/v1/goals/current').auth(owner.token, { type: 'bearer' }))
          .body.data.goal.id,
      ).toBe(chosen.body.data.goal.id);
      expect(
        (await request(app).get('/api/v1/goals/current').auth(other.token, { type: 'bearer' })).body
          .data.goal,
      ).toBeNull();
      expect(
        (
          await request(app)
            .post('/api/v1/goals')
            .auth(other.token, { type: 'bearer' })
            .send({ kind: 'ROLE', roleId: backend, expectedGoalId: chosen.body.data.goal.id })
        ).status,
      ).toBe(409);
      expect(await getDatabase()!.goal.count({ where: { userId: owner.id } })).toBe(2);
    }, 20_000);
    it('stores quiz snapshots and only accepts the account’s own suggested role', async () => {
      const owner = await account();
      const other = await account();
      const submitted = await request(app)
        .post('/api/v1/quiz/submit')
        .auth(owner.token, { type: 'bearer' })
        .send({ answers: questionIds.map((questionId) => ({ questionId, optionId: 'web' })) });
      expect(submitted.status).toBe(201);
      const quiz = submitted.body.data.quiz;
      const stored = await getDatabase()!.quizResponse.findUniqueOrThrow({
        where: { id: quiz.id },
      });
      expect(stored.userId).toBe(owner.id);
      expect(stored.answers).toHaveLength(7);
      expect(stored.recommendedRoles).toHaveLength(3);
      expect(
        (
          await request(createApp({ authSecrets: secrets }))
            .get('/api/v1/quiz/latest')
            .auth(owner.token, { type: 'bearer' })
        ).body.data.quiz.id,
      ).toBe(quiz.id);
      expect(
        (
          await request(app)
            .post('/api/v1/goals')
            .auth(other.token, { type: 'bearer' })
            .send({ kind: 'ROLE', roleId: frontend, quizResponseId: quiz.id })
        ).status,
      ).toBe(404);
      const chosen = await request(app)
        .post('/api/v1/goals')
        .auth(owner.token, { type: 'bearer' })
        .send({ kind: 'ROLE', roleId: frontend, quizResponseId: quiz.id });
      expect(chosen.status).toBe(200);
      expect(chosen.body.data.goal.source).toBe('QUIZ');
    }, 20_000);
    it('allows one of two concurrent different goals and enforces the constraint outside the API', async () => {
      const owner = await account();
      const results = await Promise.all(
        [frontend, backend].map((roleId) =>
          request(app)
            .post('/api/v1/goals')
            .auth(owner.token, { type: 'bearer' })
            .send({ kind: 'ROLE', roleId }),
        ),
      );
      expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
      expect(
        await getDatabase()!.goal.count({ where: { userId: owner.id, status: 'ACTIVE' } }),
      ).toBe(1);
      await expect(
        getDatabase()!.goal.create({
          data: { userId: owner.id, targetRole: 'Duplicate active goal', source: 'DIRECT' },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    }, 20_000);
    it('returns the same goal for concurrent identical confirmations', async () => {
      const owner = await account();
      const results = await Promise.all(
        [0, 1].map(() =>
          request(app)
            .post('/api/v1/goals')
            .auth(owner.token, { type: 'bearer' })
            .send({ kind: 'ROLE', roleId: frontend }),
        ),
      );
      expect(results.map((result) => result.status)).toEqual([200, 200]);
      expect(results[0]!.body.data.goal.id).toBe(results[1]!.body.data.goal.id);
      expect(await getDatabase()!.goal.count({ where: { userId: owner.id } })).toBe(1);
    }, 20_000);
  },
);
