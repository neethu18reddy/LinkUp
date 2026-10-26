import { createHash, timingSafeEqual } from 'node:crypto';
import cron from 'node-cron';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import type { NotificationRepository } from '../modules/notifications/notifications.types.js';
export function matchesCronSecret(actual: string | undefined, expected: string | undefined) {
  if (!actual || !expected) return false;
  return timingSafeEqual(
    createHash('sha256').update(actual).digest(),
    createHash('sha256').update(expected).digest(),
  );
}
export class WeeklyJob {
  private running = false;
  constructor(
    private readonly repository: NotificationRepository,
    private readonly clock = () => new Date(),
  ) {}
  async run(cursor?: string) {
    if (this.running) throw new AppError(409, 'JOB_BUSY', 'The reminder job is already running.');
    this.running = true;
    try {
      return await this.repository.weekly(this.clock(), cursor);
    } finally {
      this.running = false;
    }
  }
}
export function scheduleWeeklyJob(job: WeeklyJob) {
  let cursor: string | undefined;
  // Hourly catch-up; database keys allow at most one of each notice per UTC week.
  return cron.schedule(
    '0 * * * *',
    async () => {
      try {
        const result = await job.run(cursor);
        cursor = result.nextCursor ?? undefined;
        logger.info(
          { processed: result.processed, created: result.created, hasMore: !!result.nextCursor },
          'Reminder batch completed',
        );
      } catch (error) {
        logger.error({ err: error }, 'Reminder batch failed; it will retry on the next tick');
      }
    },
    { timezone: 'UTC', noOverlap: true },
  );
}
