import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { roadmapController } from './roadmap.controller.js';
import type { AuthService } from '../auth/auth.service.js';
import type { RoadmapService } from './roadmap.service.js';
import { generationSchema } from './roadmap.schemas.js';

export function roadmapRoutes(service: RoadmapService, auth: AuthService) {
  const router = Router();
  const controller = roadmapController(service);
  router.use('/roadmaps', requireAuth(auth), (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use('/roadmaps', validate(z.strictObject({}), 'query'));
  router.get('/roadmaps/current', controller.current);
  router.post('/roadmaps/generate', validate(generationSchema), controller.generate);
  router.get('/roadmaps/:id', validate(z.strictObject({ id: z.uuid() }), 'params'), controller.get);
  router.post(
    '/roadmaps/:id/regenerate',
    validate(z.strictObject({ id: z.uuid() }), 'params'),
    validate(z.strictObject({})),
    controller.regenerate,
  );
  return router;
}
