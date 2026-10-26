import type { Goal } from '../../generated/prisma/client.js';

export type CurrentGoal = Pick<
  Goal,
  'id' | 'targetRole' | 'roleTemplateId' | 'source' | 'status' | 'createdAt' | 'updatedAt'
>;
export interface GoalReplacement {
  userId: string;
  roleTemplateId: string | null;
  targetRole: string;
  source: 'DIRECT' | 'QUIZ';
  expectedGoalId: string | null;
}
export interface GoalsRepository {
  current(userId: string): Promise<CurrentGoal | null>;
  replace(input: GoalReplacement): Promise<CurrentGoal>;
}
