import type { PrismaClient } from '../generated/prisma/client.js';
import type { EmailProvider } from './email.provider.js';

export async function deliverReminderEmails(
  db: PrismaClient,
  email: EmailProvider,
  origin: string,
  now = new Date(),
) {
  const eligible = {
    sentAt: null,
    emailAttempts: { lt: 3 },
    createdAt: { gte: new Date(now.getTime() - 14 * 86400000) },
    type: {
      in: ['WEEKLY_REMINDER', 'BEHIND_SCHEDULE'] as ('WEEKLY_REMINDER' | 'BEHIND_SCHEDULE')[],
    },
    OR: [{ emailClaimedAt: null }, { emailClaimedAt: { lt: new Date(now.getTime() - 5 * 60000) } }],
    user: { remindersEnabled: true, identity: { is: { verifiedAt: { not: null } } } },
  };
  const rows = await db.notification.findMany({
    where: eligible,
    orderBy: { createdAt: 'asc' },
    take: 20,
    include: { user: { select: { email: true } } },
  });
  let sent = 0,
    failed = 0;
  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const claimed = await db.notification.updateMany({
        where: { ...eligible, id: row.id },
        data: { emailClaimedAt: now, emailAttempts: { increment: 1 } },
      });
      if (claimed.count !== 1) return;
      try {
        await email.send({
          to: row.user.email,
          subject: `linkup: ${row.title}`,
          text: `${row.message}\n\nOpen your weekly plan: ${new URL('/plan', origin).href}\n\nManage reminders in Notifications preferences: ${new URL('/notifications', origin).href}`,
          idempotencyKey: row.id,
        });
        await db.notification.updateMany({
          where: { id: row.id, sentAt: null, emailClaimedAt: now },
          data: { sentAt: new Date(), emailClaimedAt: null },
        });
        sent++;
      } catch {
        await db.notification.updateMany({
          where: { id: row.id, sentAt: null, emailClaimedAt: now },
          data: { emailClaimedAt: null },
        });
        failed++;
      }
    }),
  );
  failed += results.filter((result) => result.status === 'rejected').length;
  return { sent, failed };
}
