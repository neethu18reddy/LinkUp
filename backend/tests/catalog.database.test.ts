import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { getDatabase, disconnectDatabase } from '../src/config/database.js';
import { rolesById } from '../src/catalog/catalog.js';
import { questionnaire } from '../src/catalog/catalog.onboarding.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'expanded catalog learning flow',
  () => {
    const app = createApp({
      roadmapProvider: null,
      authSecrets: { access: 'catalog-access-'.repeat(4), refresh: 'catalog-refresh-'.repeat(4) },
    });
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
          name: 'Career QA',
          email: `catalog-${randomUUID()}@example.test`,
          password: 'LearningTogether!42',
        });
      expect(result.status).toBe(201);
      users.push(result.body.data.user.id);
      return result.body.data.accessToken as string;
    }
    it('opens a fresh database client after disconnecting a previous instance', async () => {
      const previous = getDatabase()!;
      await previous.$queryRaw`SELECT 1`;
      await disconnectDatabase();
      const current = getDatabase()!;
      expect(current).not.toBe(previous);
      await expect(current.$queryRaw`SELECT 1`).resolves.toBeDefined();
    });
    it('serves bounded role pages, filters, skill aliases and complete details', async () => {
      const first = await request(app).get('/api/v1/career-catalog/roles');
      expect(first.body.data.total).toBeGreaterThanOrEqual(300);
      expect(first.body.data.roles).toHaveLength(24);
      const second = await request(app).get('/api/v1/career-catalog/roles?page=2');
      expect(second.body.data.roles[0].id).not.toBe(first.body.data.roles[0].id);
      const finance = await request(app).get('/api/v1/career-catalog/roles?category=finance');
      expect(
        finance.body.data.roles.every((role: { category: string }) => role.category === 'finance'),
      ).toBe(true);
      const detail = await request(app).get('/api/v1/career-catalog/roles/financial-analyst');
      expect(detail.body.data.roadmap.stages.length).toBeGreaterThanOrEqual(5);
      const alias = await request(app).get('/api/v1/career-catalog/skills?search=reactjs');
      expect(alias.body.data.skills[0].name).toBe('React');
      expect((await request(app).get('/api/v1/career-catalog/roles?page=0')).status).toBe(422);
      expect((await request(app).get('/api/v1/career-catalog/recommendations')).status).toBe(401);
    });
    it('saves guided answers, respects existing skill levels, and supports confirming a suggested role', async () => {
      const token = await account();
      const answers = questionnaire.map((question) => ({
        questionId: question.id,
        optionIds: [
          question.id === 'interest'
            ? 'finance'
            : question.id === 'tools'
              ? 'excel'
              : question.options[0]!.id,
        ],
      }));
      const result = await request(app)
        .post('/api/v1/career-catalog/onboarding')
        .auth(token, { type: 'bearer' })
        .send({ answers });
      expect(result.status).toBe(201);
      expect(result.body.data.recommendations).toHaveLength(3);
      expect(
        result.body.data.recommendations.every(
          (role: { category: string }) => role.category === 'finance',
        ),
      ).toBe(true);
      expect(result.body.data.alternatives).toHaveLength(5);
      expect(
        result.body.data.recommendations.every(
          (role: { explanation: string }) => !!role.explanation,
        ),
      ).toBe(true);
      const latest = await request(app).get('/api/v1/quiz/latest').auth(token, { type: 'bearer' });
      expect(latest.status).toBe(200);
      expect(latest.body.data.quiz.id).toBe(result.body.data.id);
      const role = result.body.data.recommendations[0];
      const goal = await request(app)
        .post('/api/v1/goals')
        .auth(token, { type: 'bearer' })
        .send({ kind: 'ROLE', roleId: role.roleId, quizResponseId: result.body.data.id });
      expect(goal.status).toBe(200);
      expect(goal.body.data.goal.source).toBe('QUIZ');
      const profile = await request(app).get('/api/v1/me/skills').auth(token, { type: 'bearer' });
      expect(
        profile.body.data.skills.some(
          (skill: { skill: { name: string } }) => skill.skill.name === 'Excel',
        ),
      ).toBe(true);
      const invalid = structuredClone(answers);
      invalid[2]!.optionIds = ['none', 'excel'];
      expect(
        (
          await request(app)
            .post('/api/v1/career-catalog/onboarding')
            .auth(token, { type: 'bearer' })
            .send({ answers: invalid })
        ).status,
      ).toBe(422);
    });
    it('persists topic completion across instances, synchronizes progress and rejects cross-account changes', async () => {
      const token = await account(),
        other = await account();
      const role = rolesById.get('financial-analyst')!;
      const goal = await request(app)
        .post('/api/v1/goals')
        .auth(token, { type: 'bearer' })
        .send({ kind: 'ROLE', roleId: role.databaseId });
      const generated = await request(app)
        .post('/api/v1/roadmaps/generate')
        .auth(token, { type: 'bearer' })
        .send({ goalId: goal.body.data.goal.id });
      expect(generated.status).toBe(201);
      const roadmap = generated.body.data.roadmap;
      expect(roadmap.phases).toHaveLength(5);
      const topics = roadmap.phases.flatMap(
        (phase: { topics: { id: string; isProject: boolean }[] }) => phase.topics,
      );
      const topic = topics.find((topic: { isProject: boolean }) => !topic.isProject)!;
      const patch = (auth: string, body: object) =>
        request(app).patch(`/api/v1/topics/${topic.id}`).auth(auth, { type: 'bearer' }).send(body);
      expect((await patch(other, { expectedStatus: 'TODO', complete: true })).status).toBe(404);
      expect((await patch(token, { expectedStatus: 'TODO', complete: true })).status).toBe(200);
      const refreshed = await request(app)
        .get('/api/v1/roadmaps/current')
        .auth(token, { type: 'bearer' });
      expect(
        refreshed.body.data.roadmap.phases
          .flatMap((phase: { topics: { id: string; status: string }[] }) => phase.topics)
          .find((row: { id: string }) => row.id === topic.id).status,
      ).toBe('DONE');
      expect((await patch(token, { expectedStatus: 'TODO', complete: false })).status).toBe(409);
      const project = topics.find((topic: { isProject: boolean }) => topic.isProject)!;
      expect(
        (
          await request(app)
            .patch(`/api/v1/topics/${project.id}`)
            .auth(token, { type: 'bearer' })
            .send({ expectedStatus: 'TODO', complete: true })
        ).status,
      ).toBe(422);
      const summary = await request(app)
        .get('/api/v1/progress/summary')
        .auth(token, { type: 'bearer' });
      expect(summary.body.data.completedTopics).toBeGreaterThan(0);
    });
    it('saves custom skills privately and returns stable direct recommendations', async () => {
      const token = await account();
      const name = `Custom skill ${randomUUID().slice(0, 8)}`;
      const result = await request(app)
        .post('/api/v1/me/skills/custom')
        .auth(token, { type: 'bearer' })
        .send({ name, level: 'INTERMEDIATE' });
      expect(result.status).toBe(201);
      const publicSearch = await request(app).get('/api/v1/skills').query({ search: name });
      expect(publicSearch.body.data.skills).toEqual([]);
      const direct = await request(app)
        .get('/api/v1/career-catalog/recommendations')
        .auth(token, { type: 'bearer' });
      expect(direct.body.data.recommendations).toHaveLength(3);
    });
  },
);
