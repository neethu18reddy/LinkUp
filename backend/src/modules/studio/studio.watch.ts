import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ownedItem, studioDb, studioSettings, studioTransaction } from './studio.db.js';
import { localDate, splitInterval, watchCredit } from './studio.time.js';
import { heartbeatSchema } from './studio.schemas.js';
import { syncResourceSkills } from './studio.sync.js';
const tokenKey = env.JWT_ACCESS_SECRET ?? randomBytes(32).toString('hex');
const signature = (value: string) =>
  createHmac('sha256', tokenKey).update(`studio-watch:${value}`).digest('base64url');
export function watchToken(userId: string, familyId: string, sessionId: string, itemId: string) {
  const payload = Buffer.from(
    JSON.stringify({ userId, familyId, sessionId, itemId, expires: Date.now() + 120000 }),
  ).toString('base64url');
  return `${payload}.${signature(payload)}`;
}
export async function verifyWatchToken(token: string) {
  const [payload = '', signed = ''] = token.split('.');
  const expected = Buffer.from(signature(payload)),
    actual = Buffer.from(signed);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new AppError(401, 'WATCH_TOKEN_INVALID', 'Resume playback to reconnect tracking.');
  const claims = z
    .object({
      userId: z.uuid(),
      familyId: z.uuid(),
      sessionId: z.uuid(),
      itemId: z.uuid(),
      expires: z.number(),
    })
    .parse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
  if (
    claims.expires < Date.now() ||
    !(await studioDb().refreshToken.findFirst({
      where: {
        userId: claims.userId,
        familyId: claims.familyId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    }))
  )
    throw new AppError(401, 'WATCH_TOKEN_INVALID', 'Resume playback to reconnect tracking.');
  return claims;
}
type Counter =
  | 'secondsWatched'
  | 'contentSeconds'
  | 'videosCompleted'
  | 'notesCount'
  | 'snippetsCount'
  | 'runsCount';
export async function addDaily(
  tx: Prisma.TransactionClient,
  userId: string,
  resourceId: string,
  date: string,
  changes: Partial<Record<Counter, number>>,
  tags: string[] = [],
) {
  const previous = await tx.dailyStat.findUnique({
    where: { userId_resourceId_localDate: { userId, resourceId, localDate: date } },
  });
  await tx.dailyStat.upsert({
    where: { userId_resourceId_localDate: { userId, resourceId, localDate: date } },
    create: {
      userId,
      resourceId,
      localDate: date,
      ...changes,
      topicTags: [...new Set(tags)].slice(0, 30),
    },
    update: {
      ...Object.fromEntries(
        Object.entries(changes).map(([key, amount]) => [key, { increment: amount }]),
      ),
      topicTags: [...new Set([...(previous?.topicTags ?? []), ...tags])].slice(0, 30),
    },
  });
}
export async function beginWatch(
  userId: string,
  sessionId: string,
  itemId: string,
  takeover = false,
  now = new Date(),
) {
  return studioTransaction(async (tx) => {
    const item = await ownedItem(userId, itemId, tx);
    if (!item.available || !item.externalVideoId)
      throw new AppError(422, 'PLAYBACK_UNAVAILABLE', 'Use manual completion for this resource.');
    const lease = await tx.watchLease.findUnique({ where: { userId } });
    if (lease && lease.expiresAt > now && lease.sessionId !== sessionId && !takeover)
      throw new AppError(
        409,
        'WATCH_ACTIVE_ELSEWHERE',
        'Another tab or device is tracking playback. Pause it or take over here.',
      );
    const existing = await tx.watchSession.findUnique({ where: { id: sessionId } });
    if (existing && (existing.userId !== userId || existing.itemId !== itemId))
      throw new AppError(409, 'WATCH_SESSION_INVALID', 'Start a new playback session.');
    if (!existing)
      await tx.watchSession.create({
        data: { id: sessionId, userId, itemId, startedAt: now, lastAt: now },
      });
    else if (lease?.sessionId !== sessionId || lease.expiresAt <= now)
      await tx.watchSession.update({ where: { id: sessionId }, data: { lastAt: now } });
    await tx.watchLease.upsert({
      where: { userId },
      create: { userId, sessionId, expiresAt: new Date(now.getTime() + 45000) },
      update: { sessionId, expiresAt: new Date(now.getTime() + 45000) },
    });
    await tx.itemProgress.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId, status: 'in_progress' },
      update: {},
    });
    if (!existing) {
      await tx.studioActivity.create({
        data: {
          userId,
          resourceId: item.resourceId,
          itemId,
          kind: 'video_started',
          title: item.title,
        },
      });
      if (
        !(await tx.studioActivity.findFirst({
          where: {
            userId,
            resourceId: item.resourceId,
            kind: 'section_started',
            title: item.section.title,
          },
        }))
      )
        await tx.studioActivity.create({
          data: {
            userId,
            resourceId: item.resourceId,
            kind: 'section_started',
            title: item.section.title,
          },
        });
    }
    await syncResourceSkills(
      tx,
      userId,
      item.section.skills.map((skill) => skill.skillId),
    );
    return { sessionId, wallSec: existing?.wallSec ?? 0, contentSec: existing?.contentSec ?? 0 };
  });
}
export async function completeItem(
  tx: Prisma.TransactionClient,
  userId: string,
  itemId: string,
  complete: boolean,
  by: 'manual' | 'auto',
  now: Date,
) {
  const item = await ownedItem(userId, itemId, tx);
  if (!item.available)
    throw new AppError(422, 'ITEM_UNAVAILABLE', 'Unavailable videos are excluded from completion.');
  const previous = await tx.itemProgress.findUnique({
    where: { userId_itemId: { userId, itemId } },
  });
  const status = complete ? 'completed' : 'in_progress';
  if (previous?.status === status) return previous;
  const data = {
    status,
    completedAt: complete ? now : null,
    firstCompletedAt: previous?.firstCompletedAt ?? (complete ? now : null),
    completedBy: by,
  };
  const progress = await tx.itemProgress.upsert({
    where: { userId_itemId: { userId, itemId } },
    create: { userId, itemId, ...data },
    update: data,
  });
  const settings = await tx.userSettings.findUnique({ where: { userId } });
  if (complete && !previous?.firstCompletedAt)
    await addDaily(
      tx,
      userId,
      item.resourceId,
      localDate(now, settings?.timezone ?? 'UTC'),
      { videosCompleted: 1 },
      item.section.topicTags,
    );
  await tx.studioActivity.create({
    data: {
      userId,
      resourceId: item.resourceId,
      itemId,
      kind: complete ? 'video_completed' : 'video_reopened',
      title: item.title,
    },
  });
  const sectionRemaining = await tx.resourceItem.count({
    where: {
      sectionId: item.sectionId,
      available: true,
      progress: { none: { userId, status: 'completed' } },
    },
  });
  if (complete && !sectionRemaining)
    await tx.studioActivity.create({
      data: {
        userId,
        resourceId: item.resourceId,
        kind: 'section_completed',
        title: item.section.title,
      },
    });
  const remaining = await tx.resourceItem.count({
    where: {
      resourceId: item.resourceId,
      available: true,
      progress: { none: { userId, status: 'completed' } },
    },
  });
  const resource = await tx.studioResource.findUniqueOrThrow({ where: { id: item.resourceId } });
  if (!remaining && resource.status !== 'completed')
    await tx.studioActivity.create({
      data: {
        userId,
        resourceId: item.resourceId,
        kind: 'resource_completed',
        title: resource.title,
      },
    });
  await tx.studioResource.update({
    where: { id: item.resourceId },
    data: { status: remaining ? 'active' : 'completed' },
  });
  await syncResourceSkills(
    tx,
    userId,
    item.section.skills.map((skill) => skill.skillId),
  );
  return progress;
}
export async function heartbeat(
  userId: string,
  input: z.infer<typeof heartbeatSchema>,
  now = new Date(),
) {
  const settings = await studioSettings(userId);
  return studioTransaction(async (tx) => {
    const item = await ownedItem(userId, input.itemId, tx);
    const session = await tx.watchSession.findFirst({
      where: { id: input.sessionId, userId, itemId: input.itemId },
    });
    const lease = await tx.watchLease.findUnique({ where: { userId } });
    if (!session)
      throw new AppError(409, 'WATCH_LEASE_EXPIRED', 'Resume playback to reconnect tracking.');
    const duplicate = await tx.watchEvent.findFirst({
      where: { userId, requestId: input.requestId },
    });
    if (duplicate) {
      if (duplicate.itemId !== input.itemId)
        throw new AppError(
          409,
          'HEARTBEAT_REUSED',
          'Use a new heartbeat identifier for a different item.',
        );
      return tx.itemProgress.findUnique({
        where: { userId_itemId: { userId, itemId: input.itemId } },
      });
    }
    if (!lease || lease.sessionId !== session.id || lease.expiresAt < now)
      throw new AppError(409, 'WATCH_LEASE_EXPIRED', 'Resume playback to reconnect tracking.');
    const credit = watchCredit(session, input, now);
    const monotonic = input.wallSec >= session.wallSec;
    await tx.watchSession.update({
      where: { id: session.id },
      data: {
        wallSec: Math.max(session.wallSec, input.wallSec),
        contentSec: Math.max(session.contentSec, input.contentSec),
        lastAt: monotonic ? now : session.lastAt,
      },
    });
    await tx.watchLease.update({
      where: { userId },
      data: { expiresAt: input.release ? now : new Date(now.getTime() + 45000) },
    });
    const intervals = splitInterval(
      new Date(now.getTime() - credit.wall * 1000),
      now,
      settings.timezone,
    );
    if (!intervals.length)
      await tx.watchEvent.create({
        data: {
          userId,
          resourceId: item.resourceId,
          itemId: item.id,
          requestId: input.requestId,
          localDate: localDate(now, settings.timezone),
          startedAt: now,
          endedAt: now,
          secondsWatched: 0,
          contentSeconds: 0,
          timezone: settings.timezone,
        },
      });
    for (const interval of intervals) {
      const contentSeconds = credit.wall ? (credit.content * interval.seconds) / credit.wall : 0;
      await tx.watchEvent.create({
        data: {
          userId,
          resourceId: item.resourceId,
          itemId: item.id,
          requestId: input.requestId,
          localDate: interval.localDate,
          startedAt: interval.startedAt,
          endedAt: interval.endedAt,
          secondsWatched: interval.seconds,
          contentSeconds,
          timezone: settings.timezone,
        },
      });
      await addDaily(
        tx,
        userId,
        item.resourceId,
        interval.localDate,
        { secondsWatched: interval.seconds, contentSeconds },
        item.section.topicTags,
      );
    }
    const progress = await tx.itemProgress.upsert({
      where: { userId_itemId: { userId, itemId: item.id } },
      create: {
        userId,
        itemId: item.id,
        watchedSec: credit.wall,
        contentWatchedSec: credit.content,
        lastPositionSec: Math.min(input.positionSec, item.durationSec || input.positionSec),
        status: 'in_progress',
      },
      update: {
        watchedSec: { increment: credit.wall },
        contentWatchedSec: { increment: credit.content },
        ...(monotonic
          ? { lastPositionSec: Math.min(input.positionSec, item.durationSec || input.positionSec) }
          : {}),
      },
    });
    if (
      item.durationSec > 0 &&
      progress.status !== 'completed' &&
      progress.completedBy !== 'manual' &&
      (progress.watchedSec >= item.durationSec * settings.completionThreshold ||
        (input.ended &&
          input.positionSec >= item.durationSec - 3 &&
          progress.contentWatchedSec >= item.durationSec * 0.8))
    )
      return completeItem(tx, userId, item.id, true, 'auto', now);
    return progress;
  });
}
