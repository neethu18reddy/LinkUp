import type {
  Prisma,
  SkillProgressStatus,
  SkillProgressSource,
} from '../../generated/prisma/client.js';
import { studioDb } from './studio.db.js';

export async function projectSkill(
  tx: Prisma.TransactionClient,
  userId: string,
  skillId: string,
  status: SkillProgressStatus,
) {
  const roadmap = await tx.roadmap.findFirst({
    where: { userId, goal: { status: 'ACTIVE' }, status: { not: 'ARCHIVED' } },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  if (!roadmap) return;
  const topics = await tx.topic.findMany({
    where: { skillId, isProject: false, phase: { roadmapId: roadmap.id } },
  });
  const done = status === 'DONE' || status === 'SKIPPED';
  const mapped = done ? 'DONE' : status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'TODO';
  const completedAt = done ? new Date() : null;
  await tx.topic.updateMany({
    where: { id: { in: topics.map((t) => t.id) } },
    data: { status: mapped, completedAt },
  });
  await tx.planItem.updateMany({
    where: { topicId: { in: topics.map((t) => t.id) }, planWeek: { plan: { isActive: true } } },
    data: { status: mapped, completedAt },
  });
  if (done && topics.length) {
    const level = topics.some((t) => t.difficulty === 'ADVANCED')
      ? 'ADVANCED'
      : topics.some((t) => t.difficulty === 'INTERMEDIATE')
        ? 'INTERMEDIATE'
        : 'BEGINNER';
    await tx.userSkill.upsert({
      where: { userId_skillId: { userId, skillId } },
      create: { userId, skillId, level },
      update: {},
    });
    await tx.userSkill.updateMany({
      where: {
        userId,
        skillId,
        level: {
          in:
            level === 'ADVANCED'
              ? ['BEGINNER', 'INTERMEDIATE']
              : level === 'INTERMEDIATE'
                ? ['BEGINNER']
                : [],
        },
      },
      data: { level },
    });
  }
  const remaining = await tx.topic.count({
    where: {
      phase: { roadmapId: roadmap.id },
      OR: [{ status: { not: 'DONE' } }, { isProject: true, submissions: { none: { userId } } }],
    },
  });
  await tx.roadmap.update({
    where: { id: roadmap.id },
    data: { status: remaining ? 'ACTIVE' : 'COMPLETED' },
  });
}
export async function writeSkillProgress(
  tx: Prisma.TransactionClient,
  userId: string,
  skillId: string,
  status: SkillProgressStatus,
  source: SkillProgressSource,
  percent: number,
  project = true,
) {
  const previous = await tx.userSkillProgress.findUnique({
    where: { userId_skillId: { userId, skillId } },
  });
  if (source === 'RESOURCE' && (previous?.manualComplete || previous?.status === 'SKIPPED'))
    return previous;
  const data = {
    status,
    source,
    percent,
    manualComplete: source === 'MANUAL' && status === 'DONE',
    beforeTracking: false,
    completedAt: status === 'DONE' ? (previous?.completedAt ?? new Date()) : null,
  };
  const row = await tx.userSkillProgress.upsert({
    where: { userId_skillId: { userId, skillId } },
    create: { userId, skillId, ...data },
    update: data,
  });
  if (project) await projectSkill(tx, userId, skillId, status);
  return row;
}
export async function syncResourceSkills(
  tx: Prisma.TransactionClient,
  userId: string,
  skillIds: string[],
) {
  const settings = await tx.userSettings.findUnique({ where: { userId } });
  for (const skillId of new Set(skillIds)) {
    const sections = await tx.studioSection.findMany({
      where: { resource: { userId }, skills: { some: { skillId } } },
      include: {
        items: { where: { available: true }, include: { progress: { where: { userId } } } },
      },
    });
    const items = sections.flatMap((section) => section.items);
    const count = items.filter((item) => item.progress[0]?.status === 'completed').length;
    const percent = items.length ? Math.round((count / items.length) * 100) : 0;
    const status =
      percent === 100 && !settings?.confirmSkillCompletion
        ? 'DONE'
        : percent > 0
          ? 'IN_PROGRESS'
          : 'NOT_STARTED';
    await writeSkillProgress(tx, userId, skillId, status, 'RESOURCE', percent);
  }
}
export async function skillProgressView(userId: string) {
  const [progress, sections] = await Promise.all([
    studioDb().userSkillProgress.findMany({
      where: { userId },
      include: { skill: { select: { name: true } } },
    }),
    studioDb().studioSection.findMany({
      where: { resource: { userId }, skills: { some: {} } },
      include: {
        resource: { select: { id: true, title: true } },
        skills: true,
        items: {
          where: { available: true },
          orderBy: { order: 'asc' },
          include: { progress: { where: { userId } } },
        },
      },
    }),
  ]);
  return {
    progress,
    links: sections.flatMap((section) =>
      section.skills.map((mapping) => ({
        skillId: mapping.skillId,
        resourceId: section.resourceId,
        title: section.resource.title,
        sectionTitle: section.title,
        total: section.items.length,
        done: section.items.filter((item) => item.progress[0]?.status === 'completed').length,
        itemId:
          section.items.find((item) => item.progress[0]?.status !== 'completed')?.id ??
          section.items[0]?.id,
      })),
    ),
  };
}
