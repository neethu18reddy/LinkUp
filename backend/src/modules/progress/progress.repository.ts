import { getDatabase } from '../../config/database.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import type { LogInput, ProjectInput, TaskInput } from './progress.schemas.js';
import type { ProgressRepository, ProgressSnapshot } from './progress.types.js';

function database() {
  const db = getDatabase();
  if (!db) throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'The database is not configured.');
  return db;
}
async function transaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++)
    try {
      return await database().$transaction(action, {
        isolationLevel: 'Serializable',
        timeout: 15000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code) &&
        attempt < 3
      )
        continue;
      throw error;
    }
}
const logInclude = { topic: { select: { title: true } } };
function publicLog(row: Prisma.LearningLogGetPayload<{ include: typeof logInclude }>) {
  return {
    id: row.id,
    requestId: row.requestId,
    topicId: row.topicId,
    topicTitle: row.topic?.title ?? null,
    minutes: row.minutes,
    note: row.note,
    loggedAt: row.loggedAt.toISOString(),
  };
}
function publicProject(row: Prisma.ProjectSubmissionGetPayload<Record<string, never>>) {
  return {
    id: row.id,
    topicId: row.topicId,
    title: row.title,
    repoUrl: row.repoUrl,
    notes: row.notes,
    submittedAt: row.submittedAt.toISOString(),
  };
}
async function ownedTopic(tx: Prisma.TransactionClient, userId: string, id: string) {
  const topic = await tx.topic.findFirst({
    where: { id, phase: { roadmap: { userId } } },
    include: { phase: { select: { roadmapId: true } } },
  });
  if (!topic) throw new AppError(404, 'TOPIC_NOT_FOUND', 'Topic not found.');
  return topic;
}
async function updateRoadmap(tx: Prisma.TransactionClient, userId: string, roadmapId: string) {
  const topics = await tx.topic.findMany({
    where: { phase: { roadmapId } },
    include: { submissions: { where: { userId }, select: { id: true } } },
  });
  const complete =
    topics.length > 0 &&
    topics.every(
      (topic) => topic.status === 'DONE' && (!topic.isProject || topic.submissions.length > 0),
    );
  await tx.roadmap.updateMany({
    where: { id: roadmapId, userId, status: { not: 'ARCHIVED' } },
    data: { status: complete ? 'COMPLETED' : 'ACTIVE' },
  });
}
export class PrismaProgressRepository implements ProgressRepository {
  async snapshot(
    userId: string,
    roadmapId: string | undefined,
    now: Date,
  ): Promise<ProgressSnapshot> {
    return database().$transaction(
      async (tx) => {
        const roadmap = await tx.roadmap.findFirst({
          where: roadmapId ? { id: roadmapId, userId } : { userId, goal: { status: 'ACTIVE' } },
          orderBy: { version: 'desc' },
          include: {
            phases: {
              orderBy: { order: 'asc' },
              include: {
                topics: {
                  orderBy: { order: 'asc' },
                  include: {
                    skill: { select: { name: true } },
                    submissions: { where: { userId }, select: { id: true } },
                  },
                },
              },
            },
          },
        });
        if (roadmapId && !roadmap)
          throw new AppError(404, 'ROADMAP_NOT_FOUND', 'Roadmap not found.');
        const plan = roadmap
          ? await tx.plan.findFirst({
              where: { roadmapId: roadmap.id, isActive: true },
              include: {
                weeks: {
                  orderBy: { weekNumber: 'asc' },
                  include: {
                    items: {
                      orderBy: [
                        { topic: { phase: { order: 'asc' } } },
                        { topic: { order: 'asc' } },
                      ],
                      include: { topic: { select: { title: true, isProject: true } } },
                    },
                  },
                },
              },
            })
          : null;
        const days = await tx.$queryRaw<
          { date: string; minutes: number }[]
        >`SELECT to_char("loggedAt", 'YYYY-MM-DD') AS date, SUM("minutes")::float8 AS minutes FROM "LearningLog" WHERE "userId" = ${userId}::uuid AND "loggedAt" <= ${now} GROUP BY 1 ORDER BY 1 DESC`;
        return {
          roadmap: roadmap
            ? {
                id: roadmap.id,
                title: roadmap.title,
                status: roadmap.status,
                phases: roadmap.phases.map((phase) => ({
                  id: phase.id,
                  title: phase.title,
                  topics: phase.topics.map((topic) => ({
                    id: topic.id,
                    title: topic.title,
                    skillId: topic.skillId,
                    skillName: topic.skill?.name ?? null,
                    estimatedHours: Number(topic.estimatedHours),
                    status: topic.status,
                    isProject: topic.isProject,
                    submitted: topic.submissions.length > 0,
                  })),
                })),
              }
            : null,
          plan: plan
            ? {
                id: plan.id,
                weeks: plan.weeks.map((week) => ({
                  startDate: week.startDate.toISOString().slice(0, 10),
                  plannedHours: Number(week.plannedHours),
                  focusSummary: week.focusSummary,
                  items: week.items.map((item) => ({
                    id: item.id,
                    topicId: item.topicId,
                    title: item.topic.title,
                    allocatedHours: Number(item.allocatedHours),
                    status: item.status,
                    isProject: item.topic.isProject,
                  })),
                })),
              }
            : null,
          days,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
  async updateTask(userId: string, id: string, input: TaskInput) {
    return transaction(async (tx) => {
      const item = await tx.planItem.findFirst({
        where: { id, planWeek: { plan: { roadmap: { userId } } } },
        include: { topic: true, planWeek: { include: { plan: true } } },
      });
      if (!item) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found.');
      if (!item.planWeek.plan.isActive)
        throw new AppError(
          409,
          'PLAN_CHANGED',
          'This plan is historical. Refresh your active plan.',
        );
      if (item.status === input.status) return { id: item.id, status: item.status };
      if (item.status !== input.expectedStatus)
        throw new AppError(409, 'TASK_CHANGED', 'This task changed. Refresh before trying again.');
      if (
        input.status === 'DONE' &&
        item.topic.isProject &&
        !(await tx.projectSubmission.findUnique({
          where: { userId_topicId: { userId, topicId: item.topicId } },
        }))
      )
        throw new AppError(
          422,
          'PROJECT_REQUIRED',
          'Submit your project before completing this task.',
        );
      const now = new Date();
      await tx.planItem.update({
        where: { id },
        data: { status: input.status, completedAt: input.status === 'DONE' ? now : null },
      });
      const parts = await tx.planItem.findMany({
        where: { topicId: item.topicId, planWeek: { planId: item.planWeek.plan.id } },
      });
      const done = parts
        .filter((part) => part.status === 'DONE')
        .reduce((sum, part) => sum + Math.round(Number(part.allocatedHours) * 100), 0);
      const status =
        done >= Math.round(Number(item.topic.estimatedHours) * 100)
          ? 'DONE'
          : parts.some((part) => part.status === 'DONE' || part.status === 'IN_PROGRESS')
            ? 'IN_PROGRESS'
            : 'TODO';
      await tx.topic.update({
        where: { id: item.topicId },
        data: { status, completedAt: status === 'DONE' ? now : null },
      });
      await updateRoadmap(tx, userId, item.planWeek.plan.roadmapId);
      return { id, status: input.status };
    });
  }
  async addLog(userId: string, input: LogInput) {
    return transaction(async (tx) => {
      const existing = await tx.learningLog.findUnique({
        where: { userId_requestId: { userId, requestId: input.requestId } },
        include: logInclude,
      });
      if (existing) {
        if (
          existing.topicId !== input.topicId ||
          existing.minutes !== input.minutes ||
          existing.note !== input.note ||
          existing.loggedAt.toISOString().slice(0, 10) !== input.loggedOn
        )
          throw new AppError(
            409,
            'LOG_REQUEST_REUSED',
            'This request was already saved with different details.',
          );
        return publicLog(existing);
      }
      if (input.topicId) await ownedTopic(tx, userId, input.topicId);
      const start = new Date(`${input.loggedOn}T00:00:00Z`),
        end = new Date(start.getTime() + 86400000);
      const total = await tx.learningLog.aggregate({
        where: { userId, loggedAt: { gte: start, lt: end } },
        _sum: { minutes: true },
      });
      if ((total._sum.minutes ?? 0) + input.minutes > 1440)
        throw new AppError(
          422,
          'DAILY_LOG_LIMIT',
          'Learning time cannot exceed 24 hours on one day.',
        );
      return publicLog(
        await tx.learningLog.create({
          data: {
            userId,
            requestId: input.requestId,
            topicId: input.topicId,
            minutes: input.minutes,
            note: input.note,
            loggedAt: start,
          },
          include: logInclude,
        }),
      );
    });
  }
  async logs(userId: string, limit: number, cursor?: string) {
    if (
      cursor &&
      !(await database().learningLog.findFirst({
        where: { id: cursor, userId },
        select: { id: true },
      }))
    )
      throw new AppError(404, 'LOG_NOT_FOUND', 'Log cursor not found.');
    const rows = await database().learningLog.findMany({
      where: { userId },
      orderBy: [{ loggedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: logInclude,
    });
    return {
      logs: rows.slice(0, limit).map(publicLog),
      nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
    };
  }
  async submitProject(userId: string, input: ProjectInput) {
    return transaction(async (tx) => {
      const topic = await ownedTopic(tx, userId, input.topicId);
      if (!topic.isProject) throw new AppError(422, 'NOT_A_PROJECT', 'Choose a project topic.');
      const project = await tx.projectSubmission.upsert({
        where: { userId_topicId: { userId, topicId: input.topicId } },
        create: { userId, ...input },
        update: {
          title: input.title,
          repoUrl: input.repoUrl,
          notes: input.notes,
          submittedAt: new Date(),
        },
      });
      await updateRoadmap(tx, userId, topic.phase.roadmapId);
      return publicProject(project);
    });
  }
  async projects(userId: string, roadmapId: string) {
    if (
      !(await database().roadmap.findFirst({
        where: { id: roadmapId, userId },
        select: { id: true },
      }))
    )
      throw new AppError(404, 'ROADMAP_NOT_FOUND', 'Roadmap not found.');
    return (
      await database().projectSubmission.findMany({
        where: { userId, topic: { phase: { roadmapId } } },
        orderBy: { submittedAt: 'desc' },
      })
    ).map(publicProject);
  }
}
