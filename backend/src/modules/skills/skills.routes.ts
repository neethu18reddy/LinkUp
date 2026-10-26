import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import type { AuthService } from '../auth/auth.service.js';
import { skillsController } from './skills.controller.js';
import {
  addSkillSchema,
  catalogueQuerySchema,
  emptyQuerySchema,
  skillParamsSchema,
  updateSkillSchema,
} from './skills.schemas.js';
import type { SkillsService } from './skills.service.js';

export function skillsRoutes(service: SkillsService, auth: AuthService) {
  const router = Router();
  const controller = skillsController(service);
  router.get('/skills', validate(catalogueQuerySchema, 'query'), controller.catalogue);
  router.use('/me/skills', requireAuth(auth), (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/me/skills', validate(emptyQuerySchema, 'query'), controller.profile);
  router.post(
    '/me/skills',
    validate(emptyQuerySchema, 'query'),
    validate(addSkillSchema),
    controller.add,
  );
  router.patch(
    '/me/skills/:skillId',
    validate(emptyQuerySchema, 'query'),
    validate(skillParamsSchema, 'params'),
    validate(updateSkillSchema),
    controller.update,
  );
  router.delete(
    '/me/skills/:skillId',
    validate(emptyQuerySchema, 'query'),
    validate(skillParamsSchema, 'params'),
    controller.remove,
  );
  return router;
}
