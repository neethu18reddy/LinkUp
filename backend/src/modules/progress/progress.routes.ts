import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import type { AuthService } from '../auth/auth.service.js';
import type { ProgressService } from './progress.service.js';
import { progressController } from './progress.controller.js';
import { taskSchema, logSchema, projectSchema, logQuerySchema } from './progress.schemas.js';
export function progressRoutes(service: ProgressService, auth: AuthService) {
  const router = Router(),
    controller = progressController(service),
    empty = validate(z.strictObject({}), 'query');
  for (const path of ['/progress', '/plan-items', '/logs', '/projects'])
    router.use(path, requireAuth(auth), (_req, res, next) => {
      res.set('Cache-Control', 'no-store');
      next();
    });
  router.get(
    '/progress/summary',
    validate(z.strictObject({ roadmapId: z.uuid().optional() }), 'query'),
    controller.summary,
  );
  router.patch(
    '/plan-items/:id',
    empty,
    validate(z.strictObject({ id: z.uuid() }), 'params'),
    validate(taskSchema),
    controller.task,
  );
  router.get('/logs', validate(logQuerySchema, 'query'), controller.logs);
  router.post('/logs', empty, validate(logSchema), controller.log);
  router.get(
    '/projects',
    validate(z.strictObject({ roadmapId: z.uuid() }), 'query'),
    controller.projects,
  );
  router.post('/projects', empty, validate(projectSchema), controller.project);
  return router;
}
