import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { success, failure } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import type { AuthService } from '../auth/auth.service.js';
import type { NotificationRepository } from './notifications.types.js';
import { matchesCronSecret, type WeeklyJob } from '../../jobs/weekly.js';
export function notificationRoutes(
  repository: NotificationRepository,
  job: WeeklyJob,
  auth: AuthService,
  cronSecret?: string,
) {
  const router = Router();
  const empty = validate(z.strictObject({}), 'query');
  router.use(['/notifications', '/internal/jobs'], (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.post(
    '/internal/jobs/weekly',
    (req, _res, next) => {
      if (!cronSecret)
        return next(new AppError(503, 'JOBS_DISABLED', 'Remote reminder jobs are not configured.'));
      if (
        !matchesCronSecret(/^Bearer (\S+)$/i.exec(req.headers.authorization ?? '')?.[1], cronSecret)
      )
        return next(new AppError(401, 'JOB_UNAUTHORIZED', 'Invalid job credentials.'));
      next();
    },
    rateLimit({
      windowMs: 60000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json(failure('JOB_RATE_LIMIT', 'Retry the reminder job in a minute.'));
      },
    }),
    empty,
    validate(z.strictObject({ cursor: z.uuid().optional() })),
    asyncHandler(async (req, res) => {
      res.json(success(await job.run(req.body.cursor)));
    }),
  );
  router.use('/notifications', requireAuth(auth));
  router.get(
    '/notifications',
    validate(z.strictObject({ cursor: z.uuid().optional() }), 'query'),
    asyncHandler(async (req, res) => {
      res.json(
        success(await repository.list(req.auth!.user.id, req.query.cursor as string | undefined)),
      );
    }),
  );
  router.get(
    '/notifications/preferences',
    empty,
    asyncHandler(async (req, res) => {
      res.json(success(await repository.preferences(req.auth!.user.id)));
    }),
  );
  router.patch(
    '/notifications/preferences',
    empty,
    validate(z.strictObject({ remindersEnabled: z.boolean() })),
    asyncHandler(async (req, res) => {
      res.json(
        success(await repository.setPreferences(req.auth!.user.id, req.body.remindersEnabled)),
      );
    }),
  );
  router.patch(
    '/notifications/:id/read',
    empty,
    validate(z.strictObject({ id: z.uuid() }), 'params'),
    validate(z.strictObject({})),
    asyncHandler(async (req, res) => {
      await repository.read(req.auth!.user.id, String(req.params.id), new Date());
      res.json(success({ read: true }));
    }),
  );
  return router;
}
