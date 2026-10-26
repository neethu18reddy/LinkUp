import { getDatabase } from '../../config/database.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import type { RoadmapDraft } from './roadmap.schemas.js';

function database() {
  const db = getDatabase();
  if (!db) throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'The database is not configured.');
  return db;
}
const include = {
  phases: {
    orderBy: { order: 'asc' as const },
    include: { topics: { orderBy: { order: 'asc' as const } } },
  },
};
// Decimal values are converted explicitly so the API has numeric hours throughout.
function publicRoadmap(row: Prisma.RoadmapGetPayload<{ include: typeof include }>) {
  return {
    id: row.id,
    goalId: row.goalId,
    title: row.title,
    status: row.status,
    version: row.version,
    generationSource: row.generationSource,
    totalEstimatedHours: Number(row.totalEstimatedHours),
    createdAt: row.createdAt.toISOString(),
    phases: row.phases.map((phase) => ({
      id: phase.id,
      order: phase.order,
      title: phase.title,
      description: phase.description,
      topics: phase.topics.map((topic) => ({
        id: topic.id,
        order: topic.order,
        title: topic.title,
        skillId: topic.skillId,
        subtopics: topic.subtopics,
        estimatedHours: Number(topic.estimatedHours),
        difficulty: topic.difficulty,
        resources: topic.resources,
        isProject: topic.isProject,
        status: topic.status,
      })),
    })),
  };
}
export type SavedRoadmap = ReturnType<typeof publicRoadmap>;
export interface RoadmapRepository {
  reserve(userId: string, goalId: string, date: Date): Promise<void>;
  save(userId: string, goalId: string, draft: RoadmapDraft, source: string): Promise<SavedRoadmap>;
  find(userId: string, id: string): Promise<SavedRoadmap | null>;
  latest(userId: string, goalId: string): Promise<SavedRoadmap | null>;
}
export class PrismaRoadmapRepository implements RoadmapRepository {
  async reserve(userId: string, goalId: string, date: Date) {
    for (let attempt = 0; ; attempt++) {
      try {
        await database().$transaction(
          async (tx) => {
            if (!(await tx.goal.findFirst({ where: { id: goalId, userId, status: 'ACTIVE' } })))
              throw new AppError(
                409,
                'GOAL_CHANGED',
                'Review your current goal before generating.',
              );
            await tx.dailyUsage.upsert({
              where: { userId_date_kind: { userId, date, kind: 'ROADMAP' } },
              create: { userId, date, kind: 'ROADMAP', count: 0 },
              update: {},
            });
            const result = await tx.dailyUsage.updateMany({
              where: { userId, date, kind: 'ROADMAP', count: { lt: 3 } },
              data: { count: { increment: 1 } },
            });
            if (!result.count)
              throw new AppError(
                429,
                'DAILY_QUOTA',
                'You have used your 3 roadmap attempts for today. Try again tomorrow (UTC).',
              );
          },
          { isolationLevel: 'Serializable' },
        );
        return;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(error.code) &&
          attempt < 4
        )
          continue;
        throw error;
      }
    }
  }
  async save(
    userId: string,
    goalId: string,
    draft: RoadmapDraft,
    source: string,
  ): Promise<SavedRoadmap> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await database().$transaction(
          async (tx) => {
            if (!(await tx.goal.findFirst({ where: { id: goalId, userId, status: 'ACTIVE' } })))
              throw new AppError(
                409,
                'GOAL_CHANGED',
                'Your goal changed during generation. Review your current goal.',
              );
            const latest = await tx.roadmap.findFirst({
              where: { userId, goalId },
              orderBy: { version: 'desc' },
              select: { version: true },
            });
            const row = await tx.roadmap.create({
              data: {
                userId,
                goalId,
                title: draft.title,
                version: (latest?.version ?? 0) + 1,
                generationSource: source,
                totalEstimatedHours: draft.phases.reduce(
                  (sum, phase) =>
                    sum + phase.topics.reduce((hours, topic) => hours + topic.estimatedHours, 0),
                  0,
                ),
                phases: {
                  create: draft.phases.map((phase, order) => ({
                    order,
                    title: phase.title,
                    description: phase.description,
                    topics: { create: phase.topics.map((topic, order) => ({ ...topic, order })) },
                  })),
                },
              },
              include,
            });
            return publicRoadmap(row);
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
  async find(userId: string, id: string) {
    const row = await database().roadmap.findFirst({ where: { id, userId }, include });
    return row ? publicRoadmap(row) : null;
  }
  async latest(userId: string, goalId: string) {
    const row = await database().roadmap.findFirst({
      where: { userId, goalId },
      orderBy: { version: 'desc' },
      include,
    });
    return row ? publicRoadmap(row) : null;
  }
}
