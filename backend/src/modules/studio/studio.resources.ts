import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import { skillsByDatabaseId, rolesByDatabaseId } from '../../catalog/catalog.js';
import { AppError } from '../../utils/AppError.js';
import { ownedResource, studioDb, studioTransaction } from './studio.db.js';
import { readPreview } from './studio.providers.js';
import {
  saveResourceSchema,
  editSectionsSchema,
  type StudioSectionInput,
} from './studio.schemas.js';
import { syncResourceSkills } from './studio.sync.js';

export const resourceInclude = {
  sections: {
    orderBy: { order: 'asc' as const },
    include: {
      skills: { include: { skill: { select: { name: true } } } },
      items: { orderBy: { order: 'asc' as const }, include: { progress: true } },
    },
  },
};
type Resource = Prisma.StudioResourceGetPayload<{ include: typeof resourceInclude }>;
export function resourceView(resource: Resource) {
  const items = resource.sections
    .flatMap((section) => section.items)
    .filter((item) => item.available);
  const done = items.filter((item) =>
    item.progress.some((row) => row.status === 'completed'),
  ).length;
  return {
    ...resource,
    done,
    total: items.length,
    percent: items.length ? Math.round((done / items.length) * 100) : 0,
    sections: resource.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, progress: item.progress[0] ?? null })),
    })),
  };
}
export function validateSections(sections: StudioSectionInput[], keys: string[]) {
  const selected = sections.flatMap((section) => section.itemKeys);
  if (
    selected.length !== keys.length ||
    new Set(selected).size !== selected.length ||
    selected.some((key) => !keys.includes(key))
  )
    throw new AppError(
      422,
      'SECTIONS_INVALID',
      'Keep every item exactly once when organizing sections.',
    );
  const ids = sections.flatMap((section) => (section.id ? [section.id] : []));
  if (new Set(ids).size !== ids.length)
    throw new AppError(422, 'SECTIONS_INVALID', 'Section identifiers must be unique.');
  for (const section of sections) {
    if (
      new Set(section.skills.map((skill) => skill.skillId)).size !== section.skills.length ||
      section.skills.some((skill) => !skillsByDatabaseId.has(skill.skillId))
    )
      throw new AppError(422, 'SKILL_INVALID', 'Choose unique skills from the catalog.');
  }
}
export async function listResources(userId: string, page = 1) {
  const [rows, total] = await Promise.all([
    studioDb().studioResource.findMany({
      where: { userId },
      orderBy: { importedAt: 'desc' },
      take: 12,
      skip: (page - 1) * 12,
      include: {
        items: {
          where: { available: true },
          select: {
            progress: { where: { userId }, select: { status: true, lastPositionSec: true } },
          },
        },
      },
    }),
    studioDb().studioResource.count({ where: { userId } }),
  ]);
  return {
    total,
    page,
    resources: rows.map(({ items, ...resource }) => ({
      ...resource,
      total: items.length,
      done: items.filter((item) => item.progress[0]?.status === 'completed').length,
    })),
  };
}
export async function getResource(userId: string, id: string) {
  await ownedResource(userId, id);
  return resourceView(
    await studioDb().studioResource.findUniqueOrThrow({ where: { id }, include: resourceInclude }),
  );
}
export async function saveResource(userId: string, input: z.infer<typeof saveResourceSchema>) {
  const preview = readPreview(input.previewToken, userId);
  validateSections(
    input.sections,
    preview.items.map((item) => item.key),
  );
  if (input.targetRoleId && !rolesByDatabaseId.has(input.targetRoleId))
    throw new AppError(422, 'ROLE_INVALID', 'Choose a role from the catalog.');
  return studioTransaction(async (tx) => {
    if ((await tx.studioResource.count({ where: { userId } })) >= 100)
      throw new AppError(
        422,
        'RESOURCE_LIMIT',
        'You can keep up to 100 resources. Export or remove an older one first.',
      );
    const resource = await tx.studioResource.create({
      data: {
        userId,
        provider: preview.provider,
        externalId: preview.externalId,
        title: input.title,
        channel: preview.channel,
        targetRoleId: input.targetRoleId,
        totalDurationSec: preview.items
          .filter((item) => item.available)
          .reduce((sum, item) => sum + item.durationSec, 0),
        videoCount: preview.items.filter((item) => item.available).length,
        thumbnailUrl: preview.items.find((item) => item.thumbnailUrl)?.thumbnailUrl,
      },
    });
    const indexed = new Map(preview.items.map((item) => [item.key, item]));
    const chapters = input.sections.map((section, order) => ({ section, id: randomUUID(), order }));
    await tx.studioSection.createMany({
      data: chapters.map(({ section, id, order }) => ({
        id,
        resourceId: resource.id,
        order,
        title: section.title,
        topicSummary: section.topicSummary,
        topicTags: section.topicTags,
        totalDurationSec: section.itemKeys.reduce(
          (sum, key) => sum + indexed.get(key)!.durationSec,
          0,
        ),
      })),
    });
    await tx.studioSectionSkill.createMany({
      data: chapters.flatMap(({ section, id }) =>
        section.skills.map((skill) => ({ sectionId: id, ...skill })),
      ),
    });
    let order = 0;
    await tx.resourceItem.createMany({
      data: chapters.flatMap(({ section, id }) =>
        section.itemKeys.map((key) => {
          const item = indexed.get(key)!;
          return {
            id: randomUUID(),
            resourceId: resource.id,
            sectionId: id,
            order: order++,
            externalVideoId: item.externalVideoId,
            title: item.title,
            url: item.url,
            durationSec: item.durationSec,
            thumbnailUrl: item.thumbnailUrl,
            available: item.available,
          };
        }),
      ),
    });
    await tx.studioActivity.create({
      data: {
        userId,
        resourceId: resource.id,
        kind: 'imported',
        title: `Imported ${resource.title}`.slice(0, 200),
      },
    });
    return resource.id;
  });
}
export async function editSections(
  userId: string,
  id: string,
  input: z.infer<typeof editSectionsSchema>,
) {
  return studioTransaction(async (tx) => {
    const resource = await ownedResource(userId, id, tx);
    if (resource.version !== input.version)
      throw new AppError(
        409,
        'RESOURCE_CHANGED',
        'This resource changed. Reload before editing sections.',
      );
    const items = await tx.resourceItem.findMany({ where: { resourceId: id } });
    const old = await tx.studioSection.findMany({
      where: { resourceId: id },
      include: { skills: true },
    });
    validateSections(
      input.sections,
      items.map((item) => item.id),
    );
    if (
      input.sections.some(
        (section) => section.id && !old.some((previous) => previous.id === section.id),
      )
    )
      throw new AppError(404, 'SECTION_NOT_FOUND', 'Section not found.');
    await tx.studioSection.updateMany({
      where: { resourceId: id },
      data: { order: { increment: 10000 } },
    });
    await tx.resourceItem.updateMany({
      where: { resourceId: id },
      data: { order: { increment: 10000 } },
    });
    const incoming = input.sections.map((section) => ({
      ...section,
      id: section.id ?? randomUUID(),
    }));
    const retained = incoming.map((section) => section.id);
    const indexed = new Map(items.map((item) => [item.id, item]));
    const rows = incoming.map((section, position) => ({
      id: section.id,
      title: section.title,
      summary: section.topicSummary,
      tags: section.topicTags,
      position,
      duration: section.itemKeys.reduce((sum, key) => sum + indexed.get(key)!.durationSec, 0),
    }));
    await tx.studioSection.createMany({
      data: rows
        .filter((row) => !old.some((section) => section.id === row.id))
        .map((row) => ({
          id: row.id,
          resourceId: id,
          title: row.title,
          topicSummary: row.summary,
          topicTags: row.tags,
          order: row.position,
          totalDurationSec: row.duration,
        })),
    });
    await tx.$executeRaw`UPDATE "StudioSection" s SET "title"=v.title, "topicSummary"=v.summary, "topicTags"=ARRAY(SELECT jsonb_array_elements_text(v.tags)), "order"=v.position, "totalDurationSec"=v.duration FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS v(id text,title text,summary text,tags jsonb,position int,duration int) WHERE s.id=v.id::uuid AND s."resourceId"=${id}::uuid`;
    await tx.studioSectionSkill.deleteMany({ where: { section: { resourceId: id } } });
    await tx.studioSectionSkill.createMany({
      data: incoming.flatMap((section) =>
        section.skills.map((skill) => ({ sectionId: section.id, ...skill })),
      ),
    });
    let order = 0;
    const changes = incoming.flatMap((section) =>
      section.itemKeys.map((itemId) => ({ itemId, sectionId: section.id, position: order++ })),
    );
    await tx.$executeRaw`UPDATE "ResourceItem" i SET "sectionId"=v."sectionId"::uuid, "order"=v.position FROM jsonb_to_recordset(${JSON.stringify(changes)}::jsonb) AS v("itemId" text,"sectionId" text,position int) WHERE i.id=v."itemId"::uuid AND i."resourceId"=${id}::uuid`;
    await tx.$executeRaw`UPDATE "CodeSnippet" n SET "sectionId"=i."sectionId" FROM "ResourceItem" i WHERE n."itemId"=i.id AND n."resourceId"=${id}::uuid AND n."userId"=${userId}::uuid`;
    await tx.studioSection.deleteMany({ where: { resourceId: id, id: { notIn: retained } } });
    await tx.studioResource.update({ where: { id }, data: { version: { increment: 1 } } });
    await syncResourceSkills(tx, userId, [
      ...old.flatMap((section) => section.skills.map((skill) => skill.skillId)),
      ...input.sections.flatMap((section) => section.skills.map((skill) => skill.skillId)),
    ]);
    await tx.studioActivity.create({
      data: {
        userId,
        resourceId: id,
        kind: 'sections_updated',
        title: 'Updated learning chapters',
      },
    });
    return { id };
  });
}
export async function deleteResource(userId: string, id: string) {
  return studioTransaction(async (tx) => {
    await ownedResource(userId, id, tx);
    const mappings = await tx.studioSectionSkill.findMany({
      where: { section: { resourceId: id } },
    });
    const days = await tx.dailyStat.findMany({
      where: { userId, resourceId: id },
      select: { localDate: true },
    });
    const sessions = await tx.watchSession.findMany({
      where: { userId, item: { resourceId: id } },
      select: { id: true },
    });
    await tx.watchLease.deleteMany({
      where: { userId, sessionId: { in: sessions.map((session) => session.id) } },
    });
    await tx.studioResource.delete({ where: { id } });
    await tx.dailyRecap.deleteMany({
      where: {
        userId,
        OR: [
          { localDate: { in: days.map((day) => day.localDate) } },
          { payload: { path: ['next', 'resourceId'], equals: id } },
        ],
      },
    });
    await syncResourceSkills(
      tx,
      userId,
      mappings.map((mapping) => mapping.skillId),
    );
    return { deleted: true };
  });
}
