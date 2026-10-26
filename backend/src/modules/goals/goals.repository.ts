import { getDatabase } from '../../config/database.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import type { GoalReplacement, GoalsRepository } from './goals.types.js';

const goalSelect = {
  id: true,
  targetRole: true,
  roleTemplateId: true,
  source: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;
function database() {
  const client = getDatabase();
  if (!client)
    throw new AppError(
      503,
      'DATABASE_NOT_CONFIGURED',
      'The database is not configured. Please contact the administrator.',
    );
  return client;
}
export class PrismaGoalsRepository implements GoalsRepository {
  current(userId: string) {
    return database().goal.findFirst({ where: { userId, status: 'ACTIVE' }, select: goalSelect });
  }
  async replace(input: GoalReplacement) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await database().$transaction(
          async (tx) => {
            const current = await tx.goal.findFirst({
              where: { userId: input.userId, status: 'ACTIVE' },
              select: goalSelect,
            });
            if (
              current &&
              current.roleTemplateId === input.roleTemplateId &&
              current.targetRole.toLowerCase() === input.targetRole.toLowerCase()
            )
              return current;
            if ((current?.id ?? null) !== input.expectedGoalId)
              throw new AppError(
                409,
                'GOAL_CHANGED',
                'Your current goal has changed. Review the latest goal and try again.',
              );
            await tx.goal.updateMany({
              where: { userId: input.userId, status: 'ACTIVE' },
              data: { status: 'ARCHIVED' },
            });
            return tx.goal.create({
              data: {
                userId: input.userId,
                roleTemplateId: input.roleTemplateId,
                targetRole: input.targetRole,
                source: input.source,
              },
              select: goalSelect,
            });
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(error.code) &&
          attempt < 2
        )
          continue;
        throw error;
      }
    }
  }
}
