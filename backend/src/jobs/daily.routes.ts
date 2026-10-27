import { Router } from 'express';
import { env } from '../config/env.js';
import { getDatabase } from '../config/database.js';
import { configuredEmailProvider } from '../email/email.provider.js';
import { deliverReminderEmails } from '../email/reminders.js';
import { PrismaNotificationRepository } from '../modules/notifications/notifications.repository.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success } from '../utils/response.js';
import { matchesCronSecret, WeeklyJob } from './weekly.js';

export function dailyRoutes() {
  const router = Router();
  router.get(
    '/internal/jobs/daily',
    asyncHandler(async (req, res) => {
      res.set('Cache-Control', 'no-store');
      if (!env.CRON_SECRET)
        throw new AppError(503, 'JOBS_DISABLED', 'Scheduled reminders are not configured.');
      if (
        !matchesCronSecret(
          /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '')?.[1],
          env.CRON_SECRET,
        )
      )
        throw new AppError(401, 'JOB_UNAUTHORIZED', 'Invalid job credentials.');
      const db = getDatabase();
      if (!db)
        throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'The database is not configured.');
      const state = await db.scheduledJobState.findUnique({ where: { id: 'daily-reminders' } });
      let cursor = state?.cursor ?? undefined,
        created = 0,
        processed = 0;
      const started = Date.now();
      const job = new WeeklyJob(new PrismaNotificationRepository());
      do {
        const result = await job.run(cursor);
        created += result.created;
        processed += result.processed;
        cursor = result.nextCursor ?? undefined;
        await db.scheduledJobState.upsert({
          where: { id: 'daily-reminders' },
          create: { id: 'daily-reminders', cursor: cursor ?? null },
          update: { cursor: cursor ?? null },
        });
      } while (cursor && Date.now() - started < 20000);
      const email = configuredEmailProvider();
      const delivery = email
        ? await deliverReminderEmails(db, email, env.PUBLIC_WEB_URL ?? env.CLIENT_URL[0]!)
        : { sent: 0, failed: 0 };
      await db.accountToken.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - 7 * 86400000) } },
      });
      res.json(success({ created, processed, hasMore: !!cursor, email: delivery }));
    }),
  );
  return router;
}
