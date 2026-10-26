import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import type { AuthService } from '../auth/auth.service.js';
import { goalsController } from './goals.controller.js';
import { createGoalSchema } from './goals.schemas.js';
import type { GoalsService } from './goals.service.js';

export function goalsRoutes(service: GoalsService, auth: AuthService) {
  const router = Router();
  const controller = goalsController(service);
  router.use('/goals', requireAuth(auth), (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/goals/current', validate(z.strictObject({}), 'query'), controller.current);
  router.post(
    '/goals',
    validate(z.strictObject({}), 'query'),
    validate(createGoalSchema),
    controller.create,
  );
  return router;
}
