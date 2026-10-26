import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { AuthTokens } from '../src/modules/auth/auth.tokens.js';
import type { CareerRole } from '../src/modules/roles/roles.types.js';
import {
  quizQuestions,
  questionIds,
  dimensions,
  roleAffinities,
} from '../src/modules/quiz/quiz.data.js';
import { recommendRoles } from '../src/modules/quiz/quiz.service.js';
import { MemoryAuthRepository } from './helpers/memory-auth-repository.js';
import {
  loadCareerRoles,
  MemoryRolesRepository,
  MemoryQuizRepository,
  MemoryGoalsRepository,
} from './helpers/memory-career-repositories.js';

let roles: CareerRole[];
beforeAll(async () => {
  roles = await loadCareerRoles();
});
const answersFor = (optionId: (typeof dimensions)[number]) =>
  questionIds.map((questionId) => ({ questionId, optionId }));

describe('quiz scoring and catalogue integrity', () => {
  it('has seven complete questions and six distinct roles linked to real skills', () => {
    expect(quizQuestions).toHaveLength(7);
    expect(new Set(quizQuestions.map((question) => question.id)).size).toBe(7);
    for (const question of quizQuestions) {
      expect(question.prompt).toBeTruthy();
      expect(question.options.map((option) => option.id)).toEqual([...dimensions]);
      expect(question.options.every((option) => !!option.label)).toBe(true);
    }
    expect(roles).toHaveLength(6);
    expect(new Set(roles.map((role) => role.id)).size).toBe(6);
    expect(new Set(roles.map((role) => role.slug)).size).toBe(6);
    expect(Object.keys(roleAffinities).sort()).toEqual(roles.map((role) => role.slug).sort());
    for (const role of roles)
      expect(new Set(role.requirements.map((item) => item.skillId)).size).toBe(
        role.requirements.length,
      );
  });
  it.each([
    ['web', 'frontend-developer'],
    ['systems', 'backend-developer'],
    ['data', 'data-analyst'],
    ['design', 'ui-designer'],
    ['operations', 'devops-engineer'],
  ] as const)('maps %s interests to a relevant first suggestion', (dimension, slug) => {
    const results = recommendRoles(answersFor(dimension), roles, []);
    expect(results).toHaveLength(3);
    expect(new Set(results.map((result) => result.roleId)).size).toBe(3);
    expect(results[0]!.roleId).toBe(roles.find((role) => role.slug === slug)!.id);
    expect(results.every((result) => result.reasons.length > 0)).toBe(true);
  });
  it('uses owned skills only as a stable tie-break and explains the match', () => {
    const answers = answersFor('operations');
    const react = '00000000-0000-4000-8000-000000000005';
    const first = recommendRoles(answers, roles, [react]);
    expect(first).toEqual(recommendRoles([...answers].reverse(), [...roles].reverse(), [react]));
    expect(first[1]!.roleId).toBe(roles.find((role) => role.slug === 'fullstack-developer')!.id);
    expect(first[1]!.reasons.join(' ')).toContain('React');
  });
});

describe('goals and quiz API', () => {
  let app: ReturnType<typeof createApp>;
  let owner: string;
  let other: string;
  let quizRepository: MemoryQuizRepository;
  let goalsRepository: MemoryGoalsRepository;
  beforeEach(async () => {
    const authRepository = new MemoryAuthRepository();
    const authSecrets = {
      access: 'career-test-access-'.repeat(4),
      refresh: 'career-test-refresh-'.repeat(4),
    };
    const auth = new AuthService(authRepository, new AuthTokens(authSecrets));
    owner = (
      await auth.register({
        name: 'Owner',
        email: 'career-owner@example.test',
        password: 'Learning!42',
      })
    ).accessToken;
    other = (
      await auth.register({
        name: 'Other',
        email: 'career-other@example.test',
        password: 'Learning!42',
      })
    ).accessToken;
    quizRepository = new MemoryQuizRepository();
    goalsRepository = new MemoryGoalsRepository();
    app = createApp({
      authRepository,
      authSecrets,
      rolesRepository: new MemoryRolesRepository(roles),
      quizRepository,
      goalsRepository,
    });
  });
  const postGoal = (app: ReturnType<typeof createApp>, token: string, body: object) =>
    request(app).post('/api/v1/goals').auth(token, { type: 'bearer' }).send(body);

  it('exposes roles/questions but protects account-specific goal and quiz operations', async () => {
    expect((await request(app).get('/api/v1/roles')).body.data.roles).toHaveLength(6);
    expect((await request(app).get('/api/v1/quiz/questions')).body.data.method).toBe(
      'local-scoring',
    );
    for (const path of ['/api/v1/goals/current', '/api/v1/quiz/latest'])
      expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).post('/api/v1/goals').send({})).status).toBe(401);
    expect((await request(app).post('/api/v1/quiz/submit').send({})).status).toBe(401);
  });
  it('saves a direct canonical role without taking the quiz', async () => {
    const response = await postGoal(app, owner, { kind: 'ROLE', roleId: roles[0]!.id });
    expect(response.status).toBe(200);
    expect(response.body.data.goal).toMatchObject({
      targetRole: roles[0]!.title,
      source: 'DIRECT',
      status: 'ACTIVE',
    });
    expect(response.body.data.goal.userId).toBeUndefined();
    expect(quizRepository.responses.size).toBe(0);
    expect(
      (await request(app).get('/api/v1/goals/current').auth(other, { type: 'bearer' })).body.data
        .goal,
    ).toBeNull();
  });
  it('confirms custom targets, preserves previous goals, and is idempotent for the same target', async () => {
    const first = await postGoal(app, owner, { kind: 'CUSTOM', targetRole: '  Learn   Figma  ' });
    expect(first.body.data.goal.targetRole).toBe('Learn Figma');
    const second = await postGoal(app, owner, {
      kind: 'ROLE',
      roleId: roles[0]!.id,
      expectedGoalId: first.body.data.goal.id,
    });
    expect(second.status).toBe(200);
    expect(goalsRepository.goals.get(first.body.data.goal.id)!.status).toBe('ARCHIVED');
    const retry = await postGoal(app, owner, { kind: 'ROLE', roleId: roles[0]!.id });
    expect(retry.body.data.goal.id).toBe(second.body.data.goal.id);
    expect(goalsRepository.goals.size).toBe(2);
  });
  it('rejects stale replacements without overwriting the current goal', async () => {
    const first = await postGoal(app, owner, { kind: 'ROLE', roleId: roles[0]!.id });
    const stale = await postGoal(app, owner, { kind: 'ROLE', roleId: roles[1]!.id });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('GOAL_CHANGED');
    expect(
      (await request(app).get('/api/v1/goals/current').auth(owner, { type: 'bearer' })).body.data
        .goal.id,
    ).toBe(first.body.data.goal.id);
  });
  it('persists three suggestions privately and requires explicit confirmation to set a quiz goal', async () => {
    const submitted = await request(app)
      .post('/api/v1/quiz/submit')
      .auth(owner, { type: 'bearer' })
      .send({ answers: answersFor('data') });
    expect(submitted.status).toBe(201);
    const quiz = submitted.body.data.quiz;
    expect(quiz.recommendations).toHaveLength(3);
    expect(quiz.userId).toBeUndefined();
    expect(
      (await request(app).get('/api/v1/goals/current').auth(owner, { type: 'bearer' })).body.data
        .goal,
    ).toBeNull();
    expect(
      (await request(app).get('/api/v1/quiz/latest').auth(owner, { type: 'bearer' })).body.data.quiz
        .id,
    ).toBe(quiz.id);
    expect(
      (await request(app).get('/api/v1/quiz/latest').auth(other, { type: 'bearer' })).body.data
        .quiz,
    ).toBeNull();
    expect(
      (
        await postGoal(app, other, {
          kind: 'ROLE',
          roleId: quiz.recommendations[0].roleId,
          quizResponseId: quiz.id,
        })
      ).status,
    ).toBe(404);
    const unselected = roles.find(
      (role) => !quiz.recommendations.some((item: { roleId: string }) => item.roleId === role.id),
    )!;
    expect(
      (await postGoal(app, owner, { kind: 'ROLE', roleId: unselected.id, quizResponseId: quiz.id }))
        .status,
    ).toBe(422);
    const chosen = await postGoal(app, owner, {
      kind: 'ROLE',
      roleId: quiz.recommendations[0].roleId,
      quizResponseId: quiz.id,
    });
    expect(chosen.status).toBe(200);
    expect(chosen.body.data.goal.source).toBe('QUIZ');
  });
  it('validates every answer and rejects fabricated ownership or recommendation fields', async () => {
    const answers = answersFor('web');
    for (const body of [
      { answers: answers.slice(1) },
      { answers: answers.map(() => answers[0]) },
      { answers: [{ ...answers[0], optionId: 'unknown' }, ...answers.slice(1)] },
      { answers, recommendations: [] },
      { answers, userId: randomUUID() },
    ])
      expect(
        (await request(app).post('/api/v1/quiz/submit').auth(owner, { type: 'bearer' }).send(body))
          .status,
      ).toBe(422);
    expect(quizRepository.responses.size).toBe(0);
    for (const body of [
      { kind: 'CUSTOM', targetRole: 'x' },
      { kind: 'CUSTOM', targetRole: 'x'.repeat(151) },
      { kind: 'CUSTOM', targetRole: 'Learn\u0000Figma' },
      { kind: 'ROLE', roleId: 'bad' },
      { kind: 'ROLE', roleId: roles[0]!.id, source: 'QUIZ' },
      { kind: 'CUSTOM', targetRole: 'Learn Figma', userId: randomUUID() },
    ])
      expect((await postGoal(app, owner, body)).status).toBe(422);
    expect((await postGoal(app, owner, { kind: 'ROLE', roleId: randomUUID() })).status).toBe(404);
  });
});
