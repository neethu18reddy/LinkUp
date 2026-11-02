import { Temporal } from '@js-temporal/polyfill';
import type { Prisma } from '../../generated/prisma/client.js';
import { studioDb, studioSettings, ownedResource } from './studio.db.js';
import { localDate, previousDate, streaks } from './studio.time.js';
import { getResource } from './studio.resources.js';

export async function analytics(userId: string, resourceId?: string, days = 30, now = new Date()) {
  if (resourceId) await ownedResource(userId, resourceId);
  const db = studioDb(),
    settings = await studioSettings(userId),
    today = localDate(now, settings.timezone);
  const startDate = Temporal.PlainDate.from(today)
    .subtract({ days: days - 1 })
    .toString();
  const [stats, events, resources, notes, snippets, runs, legacy, progress] = await Promise.all([
    db.dailyStat.findMany({
      where: {
        userId,
        ...(resourceId ? { resourceId } : {}),
        localDate: { gte: startDate, lte: today },
      },
      orderBy: { localDate: 'asc' },
    }),
    db.watchEvent.findMany({
      where: {
        userId,
        secondsWatched: { gt: 0 },
        ...(resourceId ? { resourceId } : {}),
        localDate: { gte: startDate, lte: today },
      },
      orderBy: { startedAt: 'asc' },
      take: 10000,
    }),
    db.studioResource.findMany({
      where: { userId, ...(resourceId ? { id: resourceId } : {}) },
      include: {
        items: { where: { available: true }, include: { progress: { where: { userId } } } },
      },
    }),
    db.studioNote.count({ where: { userId, ...(resourceId ? { resourceId } : {}) } }),
    db.codeSnippet.count({ where: { userId, ...(resourceId ? { resourceId } : {}) } }),
    db.snippetRun.count({ where: { snippet: { userId, ...(resourceId ? { resourceId } : {}) } } }),
    resourceId
      ? []
      : db.learningLog.findMany({
          where: { userId },
          select: { minutes: true, loggedAt: true },
          orderBy: { loggedAt: 'desc' },
          take: 10000,
        }),
    db.userSkillProgress.findMany({
      where: { userId },
      include: { skill: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ]);
  const daily = Array.from({ length: days }, (_, index) => {
    const date = Temporal.PlainDate.from(startDate).add({ days: index }).toString(),
      rows = stats.filter((row) => row.localDate === date);
    return {
      date,
      secondsWatched: rows.reduce((sum, row) => sum + row.secondsWatched, 0),
      videosCompleted: rows.reduce((sum, row) => sum + row.videosCompleted, 0),
      notes: rows.reduce((sum, row) => sum + row.notesCount, 0),
      snippets: rows.reduce((sum, row) => sum + row.snippetsCount, 0),
      runs: rows.reduce((sum, row) => sum + row.runsCount, 0),
      legacyMinutes: legacy
        .filter((log) => log.loggedAt.toISOString().slice(0, 10) === date)
        .reduce((sum, log) => sum + log.minutes, 0),
    };
  });
  const allDates = await db.dailyStat.findMany({
    where: {
      userId,
      ...(resourceId ? { resourceId } : {}),
      OR: [
        { secondsWatched: { gt: 0 } },
        { videosCompleted: { gt: 0 } },
        { notesCount: { gt: 0 } },
        { snippetsCount: { gt: 0 } },
        { runsCount: { gt: 0 } },
      ],
    },
    select: { localDate: true },
  });
  const history = resourceId
    ? []
    : await db.skillProgressEvent.findMany({
        where: { userId },
        include: { skill: { select: { name: true } } },
        orderBy: [{ occurredAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
        take: 500,
      });
  const completedDates = resourceId
    ? []
    : await db.$queryRaw<
        { date: string }[]
      >`SELECT DISTINCT to_char(("occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${settings.timezone}, 'YYYY-MM-DD') AS date FROM "SkillProgressEvent" WHERE "userId"=${userId}::uuid AND status='DONE' AND "occurredAt" <= ${now}`;
  const streak = streaks(
    [
      ...allDates.map((row) => row.localDate),
      ...legacy
        .filter((row) => row.minutes > 0)
        .map((row) => row.loggedAt.toISOString().slice(0, 10)),
      ...completedDates.map((row) => row.date),
    ].filter((date) => date <= today),
    today,
  );
  const items = resources.flatMap((resource) => resource.items),
    done = items.filter((item) => item.progress[0]?.status === 'completed').length;
  const watchedSec = items.reduce((sum, item) => sum + (item.progress[0]?.watchedSec ?? 0), 0);
  const durationSec = items.reduce((sum, item) => sum + item.durationSec, 0);
  const recent = daily.slice(-7),
    recentSeconds = recent.reduce((sum, day) => sum + day.secondsWatched, 0);
  const remainingSeconds = items
    .filter((item) => item.progress[0]?.status !== 'completed')
    .reduce(
      (sum, item) =>
        sum + Math.max(0, item.durationSec - (item.progress[0]?.contentWatchedSec ?? 0)),
      0,
    );
  const etaDays =
    recentSeconds > 0 && remainingSeconds > 0
      ? Math.ceil(remainingSeconds / (recentSeconds / 7))
      : null;
  const eta =
    etaDays !== null && etaDays <= 3650
      ? Temporal.PlainDate.from(today).add({ days: etaDays }).toString()
      : null;
  const hours = new Map<string, number>(),
    weekdays = new Map<string, number>();
  let sessions = 0,
    sessionSeconds = 0,
    end = 0;
  for (const event of events) {
    if (event.startedAt.getTime() - end > 300000) sessions++;
    end = event.endedAt.getTime();
    sessionSeconds += event.secondsWatched;
    const hour = new Intl.DateTimeFormat('en', {
      timeZone: event.timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(event.startedAt);
    hours.set(hour, (hours.get(hour) ?? 0) + event.secondsWatched);
    const weekday = Temporal.PlainDate.from(event.localDate).dayOfWeek;
    weekdays.set(String(weekday), (weekdays.get(String(weekday)) ?? 0) + event.secondsWatched);
  }
  const bestHour = [...hours].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const bestWeekday = [...weekdays].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const goalActual =
    settings.dailyGoalType === 'minutes'
      ? (daily.at(-1)?.secondsWatched ?? 0) / 60
      : (daily.at(-1)?.videosCompleted ?? 0);
  const resume =
    resources
      .flatMap((resource) =>
        resource.items
          .filter((item) => item.progress[0]?.status !== 'completed')
          .map((item) => ({
            resourceId: resource.id,
            itemId: item.id,
            title: item.title,
            positionSec: item.progress[0]?.lastPositionSec ?? 0,
            updatedAt: item.progress[0]?.updatedAt?.getTime() ?? 0,
            order: item.order,
          })),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt || a.order - b.order)[0] ?? null;
  return {
    nextRolloverAt: Temporal.PlainDate.from(today)
      .add({ days: 1 })
      .toZonedDateTime(settings.timezone)
      .toInstant()
      .toString(),
    history: history.slice(0, 50).map((row) => ({
      skillId: row.skillId,
      name: row.skill.name,
      status: row.status,
      occurredAt: row.occurredAt?.toISOString() ?? null,
      beforeTracking: row.legacy && !row.occurredAt,
    })),
    today,
    timezone: settings.timezone,
    daily,
    streak,
    totalItems: items.length,
    completedItems: done,
    percent: items.length ? Math.round((done / items.length) * 100) : 0,
    watchedSec,
    durationSec,
    eta,
    averageSessionMinutes: sessions ? Math.round(sessionSeconds / sessions / 60) : 0,
    bestHour,
    bestWeekday,
    notes,
    snippets,
    runs,
    topicTags: [...new Set(stats.flatMap((row) => row.topicTags))].slice(0, 12),
    activeResources: resources.filter((resource) => resource.status !== 'completed').length,
    goal: {
      type: settings.dailyGoalType,
      target: settings.dailyGoalValue,
      actual: Math.round(goalActual),
      pace:
        goalActual >= settings.dailyGoalValue * 1.1
          ? 'ahead'
          : goalActual >= settings.dailyGoalValue * 0.8
            ? 'on track'
            : 'slightly behind',
    },
    resume,
    skills: progress.map((row) => ({
      skillId: row.skillId,
      name: row.skill.name,
      percent: row.percent,
      status: row.status,
      beforeTracking: row.beforeTracking,
    })),
    legacy: {
      minutes: legacy.reduce((sum, row) => sum + row.minutes, 0),
      notice:
        'Earlier learning logs keep their originally recorded date; undated starting skills are marked before tracking began.',
    },
    sections: resourceId
      ? (await getResource(userId, resourceId)).sections.map((section) => ({
          id: section.id,
          title: section.title,
          total: section.items.filter((item) => item.available).length,
          done: section.items.filter(
            (item) => item.available && item.progress?.status === 'completed',
          ).length,
        }))
      : [],
  };
}
export async function recap(userId: string, date?: string, now = new Date()) {
  const settings = await studioSettings(userId),
    today = localDate(now, settings.timezone),
    day = date ?? previousDate(today);
  if (day >= today)
    return {
      pending: true,
      localDate: day,
      message: 'Your recap is ready after this local day finishes.',
    };
  const db = studioDb(),
    existing = await db.dailyRecap.findUnique({
      where: { userId_localDate: { userId, localDate: day } },
    });
  if (existing) return existing.payload;
  const stats = await db.dailyStat.findMany({ where: { userId, localDate: day } });
  const seconds = stats.reduce((sum, row) => sum + row.secondsWatched, 0),
    videos = stats.reduce((sum, row) => sum + row.videosCompleted, 0),
    notes = stats.reduce((sum, row) => sum + row.notesCount, 0),
    snippets = stats.reduce((sum, row) => sum + row.snippetsCount, 0);
  const dayStart = Temporal.PlainDate.from(day)
    .toZonedDateTime(settings.timezone)
    .toInstant().epochMilliseconds;
  const dayEnd = Temporal.PlainDate.from(day)
    .add({ days: 1 })
    .toZonedDateTime(settings.timezone)
    .toInstant().epochMilliseconds;
  const wins = await db.skillProgressEvent.findMany({
    where: {
      userId,
      status: 'DONE',
      occurredAt: { gte: new Date(dayStart), lt: new Date(dayEnd) },
    },
    include: { skill: { select: { name: true } } },
  });
  const logged = await db.learningLog.aggregate({
    where: {
      userId,
      loggedAt: {
        gte: new Date(day + 'T00:00:00Z'),
        lt: new Date(Temporal.PlainDate.from(day).add({ days: 1 }).toString() + 'T00:00:00Z'),
      },
    },
    _sum: { minutes: true },
  });
  const loggedMinutes = logged._sum.minutes ?? 0;
  const runs = stats.reduce((sum, row) => sum + row.runsCount, 0);
  const active =
    seconds > 0 ||
    videos > 0 ||
    notes > 0 ||
    snippets > 0 ||
    runs > 0 ||
    wins.length > 0 ||
    loggedMinutes > 0;
  const dates = await db.$queryRaw<
    { localDate: string }[]
  >`SELECT DISTINCT date AS "localDate" FROM (SELECT "localDate" AS date FROM "DailyStat" WHERE "userId"=${userId}::uuid AND ("secondsWatched">0 OR "videosCompleted">0 OR "notesCount">0 OR "snippetsCount">0 OR "runsCount">0) UNION SELECT to_char(("occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${settings.timezone}, 'YYYY-MM-DD') FROM "SkillProgressEvent" WHERE "userId"=${userId}::uuid AND status='DONE' AND "occurredAt" IS NOT NULL UNION SELECT to_char("loggedAt", 'YYYY-MM-DD') FROM "LearningLog" WHERE "userId"=${userId}::uuid AND minutes>0) days WHERE date<=${day}`;
  const next = await db.resourceItem.findFirst({
    where: {
      available: true,
      resource: { userId },
      progress: { none: { userId, status: 'completed' } },
    },
    orderBy: { order: 'asc' },
    select: { id: true, resourceId: true, title: true },
  });
  const payload = {
    runs,
    loggedMinutes,
    skillsCompleted: new Set(wins.map((win) => win.skillId)).size,
    localDate: day,
    title: active ? 'Yesterday’s wins' : 'A fresh start is waiting',
    videos,
    minutes: Math.round(seconds / 60),
    notes,
    snippets,
    topics: [
      ...new Set([...stats.flatMap((row) => row.topicTags), ...wins.map((win) => win.skill.name)]),
    ].slice(0, 4),
    streak: streaks(
      dates.map((row) => row.localDate),
      day,
    ).current,
    encouragement: active
      ? [
          'Small steps add up. You made room to grow.',
          'A little practice, a little more confidence.',
          'Your future self has something to smile about.',
        ][Number(day.slice(-2)) % 3]!
      : 'No study recorded yesterday. Start gently with one small lesson today.',
    next: next
      ? { resourceId: next.resourceId, itemId: next.id, title: `Continue ${next.title}` }
      : null,
    emoji: settings.emojiRecap,
  };
  if (
    day === previousDate(today) &&
    now.getTime() <
      Temporal.PlainDate.from(today).toZonedDateTime(settings.timezone).epochMilliseconds + 60000
  )
    return { ...payload, provisional: true };
  const saved = await db.dailyRecap.upsert({
    where: { userId_localDate: { userId, localDate: day } },
    create: { userId, localDate: day, payload: payload as Prisma.InputJsonValue },
    update: {},
  });
  return saved.payload;
}
