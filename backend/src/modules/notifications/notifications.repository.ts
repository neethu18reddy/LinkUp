import { getDatabase } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import type { Notification } from '../../generated/prisma/client.js';
import type { NotificationRepository, Notice } from './notifications.types.js';
import { reminderContent, utcWeek } from './notifications.logic.js';
function database() {
  const db = getDatabase();
  if (!db) throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'The database is not configured.');
  return db;
}
function view(row: Notification): Notice {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
  };
}
export class PrismaNotificationRepository implements NotificationRepository {
  async list(userId: string, cursor?: string) {
    const db = database();
    const anchor = cursor
      ? await db.notification.findFirst({ where: { id: cursor, userId } })
      : null;
    if (cursor && !anchor)
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    const [rows, unreadCount] = await db.$transaction([
      db.notification.findMany({
        where: {
          userId,
          ...(anchor
            ? {
                OR: [
                  { createdAt: { lt: anchor.createdAt } },
                  { createdAt: anchor.createdAt, id: { lt: anchor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 21,
      }),
      db.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      notifications: rows.slice(0, 20).map(view),
      unreadCount,
      nextCursor: rows.length > 20 ? rows[19]!.id : null,
    };
  }
  async read(userId: string, id: string, now: Date) {
    const db = database();
    if (!(await db.notification.findFirst({ where: { id, userId }, select: { id: true } })))
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    await db.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: now },
    });
  }
  async preferences(userId: string) {
    return database().user.findUniqueOrThrow({
      where: { id: userId },
      select: { remindersEnabled: true },
    });
  }
  async setPreferences(userId: string, enabled: boolean) {
    return database().user.update({
      where: { id: userId },
      data: { remindersEnabled: enabled },
      select: { remindersEnabled: true },
    });
  }
  async weekly(now: Date, cursor?: string) {
    const db = database();
    const users = await db.user.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      orderBy: { id: 'asc' },
      take: 100,
      select: { id: true },
    });
    let created = 0;
    for (const user of users) {
      created += await db.$transaction(
        async (tx) => {
          // Lock the preference row so an opt-out cannot race a notification insert.
          const rows = await tx.$queryRaw<
            { remindersEnabled: boolean }[]
          >`SELECT "remindersEnabled" FROM "User" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
          if (!rows[0]?.remindersEnabled) return 0;
          const goal = await tx.goal.findFirst({
            where: { userId: user.id, status: 'ACTIVE' },
            include: {
              roadmaps: {
                orderBy: { version: 'desc' },
                take: 1,
                include: {
                  plans: {
                    where: { isActive: true },
                    take: 1,
                    include: {
                      weeks: {
                        include: { items: { include: { topic: { select: { status: true } } } } },
                      },
                    },
                  },
                },
              },
            },
          });
          const roadmap = goal?.roadmaps[0];
          if (!roadmap || roadmap.status === 'ARCHIVED' || roadmap.status === 'COMPLETED') return 0;
          const plan = roadmap.plans[0];
          if (!plan || plan.startDate > now) return 0;
          const notices = reminderContent(
            plan.weeks.map((week) => ({
              startDate: week.startDate.toISOString().slice(0, 10),
              items: week.items.map((item) => ({
                status: item.status,
                topicDone: item.topic.status === 'DONE',
                allocatedHours: Number(item.allocatedHours),
              })),
            })),
            now,
          );
          if (!notices.length) return 0;
          const result = await tx.notification.createMany({
            data: notices.map((notice) => ({
              ...notice,
              userId: user.id,
              deduplicationKey: `${user.id}:${utcWeek(now)}:${notice.type}`,
              createdAt: now,
            })),
            skipDuplicates: true,
          });
          return result.count;
        },
        { timeout: 10000 },
      );
    }
    return {
      processed: users.length,
      created,
      nextCursor: users.length === 100 ? users.at(-1)!.id : null,
    };
  }
}
