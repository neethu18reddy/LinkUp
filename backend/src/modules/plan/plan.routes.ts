import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import type { AuthService } from '../auth/auth.service.js';
import type { PlanService } from './plan.service.js';
import { planController } from './plan.controller.js';
import { planSettingsSchema, savePlanSchema } from './plan.schemas.js';
export function planRoutes(service: PlanService, auth: AuthService) {
  const router = Router(),
    controller = planController(service);
  router.use('/plans', requireAuth(auth), (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  const empty = validate(z.strictObject({}), 'query');
  const params = validate(z.strictObject({ id: z.uuid() }), 'params');
  router.get(
    '/plans/current',
    validate(z.strictObject({ roadmapId: z.uuid() }), 'query'),
    controller.current,
  );
  router.post('/plans/preview', empty, validate(planSettingsSchema), controller.preview);
  router.post('/plans', empty, validate(savePlanSchema), controller.create);
  router.get('/plans/:id', empty, params, controller.get);
  router.patch('/plans/:id', empty, params, validate(savePlanSchema), controller.replan);
  router.post('/plans/:id/replan', empty, params, validate(savePlanSchema), controller.replan);
  return router;
}
