import { getDatabase } from '../../config/database.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import type { PlanSettings } from './plan.schemas.js';
import type { schedulePlan, ScheduleTopic, CompletedAllocation } from './plan.scheduler.js';

const include = {
  weeks: {
    orderBy: { weekNumber: 'asc' as const },
    include: {
      items: {
        orderBy: [
          { topic: { phase: { order: 'asc' as const } } },
          { topic: { order: 'asc' as const } },
        ],
        include: { topic: { select: { title: true, isProject: true } } },
      },
    },
  },
};
function publicPlan(row: Prisma.PlanGetPayload<{ include: typeof include }>) {
  return {
    id: row.id,
    roadmapId: row.roadmapId,
    version: row.version,
    isActive: row.isActive,
    hoursPerWeek: Number(row.hoursPerWeek),
    flexibilityMode: row.flexibilityMode,
    startDate: row.startDate.toISOString().slice(0, 10),
    targetEndDate: row.targetEndDate?.toISOString().slice(0, 10) ?? null,
    projectedEndDate: row.projectedEndDate.toISOString().slice(0, 10),
    weeks: row.weeks.map((week) => ({
      id: week.id,
      weekNumber: week.weekNumber,
      startDate: week.startDate.toISOString().slice(0, 10),
      plannedHours: Number(week.plannedHours),
      focusSummary: week.focusSummary,
      isBuffer: week.isBuffer,
      items: week.items.map((item) => ({
        id: item.id,
        topicId: item.topicId,
        title: item.topic.title,
        isProject: item.topic.isProject,
        allocatedHours: Number(item.allocatedHours),
        status: item.status,
        completedAt: item.completedAt?.toISOString() ?? null,
      })),
    })),
  };
}
export type PublicPlan = ReturnType<typeof publicPlan>;
export interface PlanSnapshot {
  roadmapId: string;
  topics: ScheduleTopic[];
  active: PublicPlan | null;
  completed: CompletedAllocation[];
}
export interface PlanCommit {
  settings: PlanSettings;
  schedule: ReturnType<typeof schedulePlan>;
}
export interface PlanRepository {
  snapshot(userId: string, roadmapId: string): Promise<PlanSnapshot>;
  find(userId: string, id: string): Promise<PublicPlan | null>;
  commit(
    userId: string,
    roadmapId: string,
    build: (snapshot: PlanSnapshot) => PlanCommit,
  ): Promise<PublicPlan>;
}
function database() {
  const db = getDatabase();
  if (!db) throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'The database is not configured.');
  return db;
}
async function snapshot(
  tx: Prisma.TransactionClient,
  userId: string,
  roadmapId: string,
): Promise<PlanSnapshot> {
  const roadmap = await tx.roadmap.findFirst({
    where: { id: roadmapId, userId },
    include: {
      phases: { orderBy: { order: 'asc' }, include: { topics: { orderBy: { order: 'asc' } } } },
    },
  });
  if (!roadmap) throw new AppError(404, 'ROADMAP_NOT_FOUND', 'Roadmap not found.');
  if (roadmap.status === 'ARCHIVED')
    throw new AppError(409, 'ROADMAP_ARCHIVED', 'Choose an available roadmap before planning.');
  const row = await tx.plan.findFirst({ where: { roadmapId, isActive: true }, include });
  const active = row ? publicPlan(row) : null;
  const completed =
    active?.weeks.flatMap((week) =>
      week.items
        .filter((item) => item.status === 'DONE')
        .map((item) => ({
          topicId: item.topicId,
          allocatedHours: item.allocatedHours,
          completedAt: item.completedAt,
          startDate: week.startDate,
        })),
    ) ?? [];
  const topics = roadmap.phases.flatMap((phase) =>
    phase.topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      estimatedHours: Number(topic.estimatedHours),
      status: topic.status,
    })),
  );
  // Topic completion can precede planning; preserve that work even without plan-item records.
  for (const topic of roadmap.phases.flatMap((phase) => phase.topics))
    if (topic.status === 'DONE') {
      const preserved = completed
        .filter((item) => item.topicId === topic.id)
        .reduce((sum, item) => sum + item.allocatedHours, 0);
      const missing = Math.round((Number(topic.estimatedHours) - preserved) * 100) / 100;
      if (missing > 0)
        completed.push({
          topicId: topic.id,
          allocatedHours: missing,
          completedAt: topic.completedAt?.toISOString() ?? null,
          startDate: (topic.completedAt ?? new Date()).toISOString().slice(0, 10),
        });
    }
  return { roadmapId, topics, active, completed };
}
export class PrismaPlanRepository implements PlanRepository {
  snapshot(userId: string, roadmapId: string) {
    return snapshot(database(), userId, roadmapId);
  }
  async find(userId: string, id: string) {
    const row = await database().plan.findFirst({ where: { id, roadmap: { userId } }, include });
    return row ? publicPlan(row) : null;
  }
  async commit(userId: string, roadmapId: string, build: (snapshot: PlanSnapshot) => PlanCommit) {
    for (let attempt = 0; ; attempt++)
      try {
        return await database().$transaction(
          async (tx) => {
            const current = await snapshot(tx, userId, roadmapId);
            const { settings, schedule } = build(current);
            const last = await tx.plan.findFirst({
              where: { roadmapId },
              orderBy: { version: 'desc' },
              select: { version: true },
            });
            await tx.plan.updateMany({
              where: { roadmapId, isActive: true },
              data: { isActive: false },
            });
            const plan = await tx.plan.create({
              data: {
                roadmapId,
                version: (last?.version ?? 0) + 1,
                hoursPerWeek: settings.hoursPerWeek,
                flexibilityMode: settings.flexibilityMode,
                startDate: new Date(settings.startDate),
                targetEndDate: settings.targetEndDate ? new Date(settings.targetEndDate) : null,
                projectedEndDate: new Date(schedule.projectedEndDate),
                weeks: {
                  create: schedule.weeks.map((week) => ({
                    ...week,
                    startDate: new Date(week.startDate),
                    items: {
                      create: week.items.map((item) => ({
                        ...item,
                        completedAt: item.completedAt ? new Date(item.completedAt) : null,
                      })),
                    },
                  })),
                },
              },
              include,
            });
            await tx.roadmap.updateMany({
              where: { id: roadmapId, userId, status: 'DRAFT' },
              data: { status: 'ACTIVE' },
            });
            return publicPlan(plan);
          },
          { isolationLevel: 'Serializable', timeout: 15000 },
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
