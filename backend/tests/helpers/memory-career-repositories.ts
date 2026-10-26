import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { Goal, QuizResponse } from '../../src/generated/prisma/client.js';
import type { CareerRole, RolesRepository } from '../../src/modules/roles/roles.types.js';
import type { QuizRepository } from '../../src/modules/quiz/quiz.types.js';
import type { QuizAnswer, Recommendation } from '../../src/modules/quiz/quiz.schemas.js';
import type { GoalReplacement, GoalsRepository } from '../../src/modules/goals/goals.types.js';
import { AppError } from '../../src/utils/AppError.js';

export async function loadCareerRoles(): Promise<CareerRole[]> {
  const skills = z
    .array(z.object({ id: z.uuid(), name: z.string(), category: z.string() }))
    .parse(
      JSON.parse(await readFile(new URL('../../prisma/data/skills.json', import.meta.url), 'utf8')),
    );
  const roles = z
    .array(
      z.object({
        id: z.uuid(),
        slug: z.string(),
        title: z.string(),
        description: z.string(),
        requirements: z
          .array(
            z.object({
              skillId: z.uuid(),
              requiredLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
              weight: z.number().int().positive(),
            }),
          )
          .min(1),
      }),
    )
    .parse(
      JSON.parse(await readFile(new URL('../../prisma/data/roles.json', import.meta.url), 'utf8')),
    );
  return roles.map((role) => ({
    ...role,
    requirements: role.requirements.map((requirement) => {
      const skill = skills.find((item) => item.id === requirement.skillId);
      if (!skill) throw new Error('Role requirement references an unknown skill');
      return { ...requirement, skill: { name: skill.name, category: skill.category } };
    }),
  }));
}
export class MemoryRolesRepository implements RolesRepository {
  constructor(public roles: CareerRole[]) {}
  async list() {
    return this.roles;
  }
  async find(id: string) {
    return this.roles.find((role) => role.id === id) ?? null;
  }
}
export class MemoryQuizRepository implements QuizRepository {
  responses = new Map<string, QuizResponse>();
  skills = new Map<string, string[]>();
  async skillIds(userId: string) {
    return this.skills.get(userId) ?? [];
  }
  async save(userId: string, answers: QuizAnswer[], recommendations: Recommendation[]) {
    const record = {
      id: randomUUID(),
      userId,
      answers,
      recommendedRoles: recommendations,
      createdAt: new Date(),
    };
    this.responses.set(record.id, record);
    return record;
  }
  async latest(userId: string) {
    return (
      [...this.responses.values()].reverse().find((record) => record.userId === userId) ?? null
    );
  }
  async find(userId: string, id: string) {
    const record = this.responses.get(id);
    return record?.userId === userId ? record : null;
  }
}
function publicGoal(goal: Goal) {
  const { id, targetRole, roleTemplateId, source, status, createdAt, updatedAt } = goal;
  return { id, targetRole, roleTemplateId, source, status, createdAt, updatedAt };
}
export class MemoryGoalsRepository implements GoalsRepository {
  goals = new Map<string, Goal>();
  async current(userId: string) {
    const goal = [...this.goals.values()].find(
      (record) => record.userId === userId && record.status === 'ACTIVE',
    );
    return goal ? publicGoal(goal) : null;
  }
  async replace(input: GoalReplacement) {
    const current = [...this.goals.values()].find(
      (record) => record.userId === input.userId && record.status === 'ACTIVE',
    );
    if (
      current &&
      current.roleTemplateId === input.roleTemplateId &&
      current.targetRole.toLowerCase() === input.targetRole.toLowerCase()
    )
      return publicGoal(current);
    if ((current?.id ?? null) !== input.expectedGoalId)
      throw new AppError(
        409,
        'GOAL_CHANGED',
        'Your current goal has changed. Review the latest goal and try again.',
      );
    if (current) {
      current.status = 'ARCHIVED';
      current.updatedAt = new Date();
    }
    const goal: Goal = {
      id: randomUUID(),
      userId: input.userId,
      roleTemplateId: input.roleTemplateId,
      targetRole: input.targetRole,
      source: input.source,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.goals.set(goal.id, goal);
    return publicGoal(goal);
  }
}
