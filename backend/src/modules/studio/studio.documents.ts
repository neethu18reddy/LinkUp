import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../../utils/AppError.js';
import { ownedItem, ownedResource, studioDb, studioTransaction } from './studio.db.js';
import { noteSchema, snippetSchema } from './studio.schemas.js';
import { localDate } from './studio.time.js';
import { addDaily } from './studio.watch.js';

export async function saveNote(userId: string, input: z.infer<typeof noteSchema>) {
  return studioTransaction(async (tx) => {
    await ownedResource(userId, input.resourceId, tx);
    if (input.itemId && (await ownedItem(userId, input.itemId, tx)).resourceId !== input.resourceId)
      throw new AppError(422, 'ITEM_INVALID', 'Choose an item in this resource.');
    const previous = input.id
      ? await tx.studioNote.findFirst({
          where: { id: input.id, userId, resourceId: input.resourceId },
        })
      : null;
    if (previous && previous.version !== input.version) {
      if (
        previous.bodyMd === input.bodyMd &&
        previous.type === input.type &&
        previous.pinned === input.pinned &&
        JSON.stringify(previous.tags) === JSON.stringify(input.tags)
      )
        return previous;
      throw new AppError(
        409,
        'NOTE_CHANGED',
        'This note changed on another device. Keep your draft and reload the saved version.',
      );
    }
    if (!previous && input.version)
      throw new AppError(
        404,
        'NOTE_NOT_FOUND',
        'This note was removed. Save the draft as a new note.',
      );
    const data = noteSchema.omit({ version: true, id: true }).strip().parse(input);
    if (previous)
      return tx.studioNote.update({
        where: { id: previous.id },
        data: { ...data, version: { increment: 1 } },
      });
    if ((await tx.studioNote.count({ where: { userId, resourceId: input.resourceId } })) >= 2000)
      throw new AppError(
        422,
        'NOTE_LIMIT',
        'Export notes or start another resource after 2,000 notes.',
      );
    const note = await tx.studioNote.create({
      data: { id: input.id ?? randomUUID(), userId, ...data },
    });
    const timezone = (await tx.userSettings.findUnique({ where: { userId } }))?.timezone ?? 'UTC';
    await addDaily(
      tx,
      userId,
      input.resourceId,
      localDate(new Date(), timezone),
      { notesCount: 1 },
      input.tags,
    );
    await tx.studioActivity.create({
      data: {
        userId,
        resourceId: input.resourceId,
        itemId: input.itemId,
        kind: 'note_added',
        title: input.bodyMd.slice(0, 200) || 'New note',
      },
    });
    return note;
  });
}
export async function saveSnippet(userId: string, input: z.infer<typeof snippetSchema>) {
  return studioTransaction(async (tx) => {
    await ownedResource(userId, input.resourceId, tx);
    const item = input.itemId ? await ownedItem(userId, input.itemId, tx) : null;
    if (item && item.resourceId !== input.resourceId)
      throw new AppError(422, 'ITEM_INVALID', 'Choose an item in this resource.');
    const previous = input.id
      ? await tx.codeSnippet.findFirst({
          where: { id: input.id, userId, resourceId: input.resourceId },
        })
      : null;
    if (previous && previous.version !== input.version) {
      if (
        previous.code === input.code &&
        previous.title === input.title &&
        previous.language === input.language
      )
        return previous;
      throw new AppError(
        409,
        'SNIPPET_CHANGED',
        'This snippet changed on another device. Keep your draft and reload the saved version.',
      );
    }
    if (!previous && input.version)
      throw new AppError(
        404,
        'SNIPPET_NOT_FOUND',
        'Snippet removed. Save the draft as a new snippet.',
      );
    const data = snippetSchema.omit({ version: true, id: true }).strip().parse(input);
    if (
      !previous &&
      (await tx.codeSnippet.count({ where: { userId, resourceId: input.resourceId } })) >= 500
    )
      throw new AppError(
        422,
        'SNIPPET_LIMIT',
        'Export snippets or start another resource after 500 snippets.',
      );
    const snippet = previous
      ? await tx.codeSnippet.update({
          where: { id: previous.id },
          data: { ...data, sectionId: item?.sectionId, version: { increment: 1 } },
        })
      : await tx.codeSnippet.create({
          data: { id: input.id ?? randomUUID(), userId, ...data, sectionId: item?.sectionId },
        });
    if (!previous || previous.code !== snippet.code) {
      await tx.snippetVersion.create({ data: { snippetId: snippet.id, code: snippet.code } });
      const older = await tx.snippetVersion.findMany({
        where: { snippetId: snippet.id },
        orderBy: [{ savedAt: 'desc' }, { id: 'desc' }],
        skip: 20,
        select: { id: true },
      });
      await tx.snippetVersion.deleteMany({ where: { id: { in: older.map((row) => row.id) } } });
    }
    if (!previous) {
      const timezone = (await tx.userSettings.findUnique({ where: { userId } }))?.timezone ?? 'UTC';
      await addDaily(tx, userId, input.resourceId, localDate(new Date(), timezone), {
        snippetsCount: 1,
      });
      await tx.studioActivity.create({
        data: {
          userId,
          resourceId: input.resourceId,
          itemId: input.itemId,
          kind: 'snippet_added',
          title: input.title,
        },
      });
    }
    return snippet;
  });
}
export async function documents(
  userId: string,
  kind: 'notes' | 'snippets',
  resourceId?: string,
  search = '',
  itemId?: string,
) {
  if (resourceId) await ownedResource(userId, resourceId);
  const where = { userId, ...(resourceId ? { resourceId } : {}), ...(itemId ? { itemId } : {}) };
  return kind === 'notes'
    ? studioDb().studioNote.findMany({
        where: {
          ...where,
          ...(search ? { bodyMd: { contains: search, mode: 'insensitive' as const } } : {}),
        },
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        take: 200,
      })
    : studioDb().codeSnippet.findMany({
        where: {
          ...where,
          ...(search
            ? {
                OR: [
                  { title: { contains: search, mode: 'insensitive' as const } },
                  { code: { contains: search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      });
}
