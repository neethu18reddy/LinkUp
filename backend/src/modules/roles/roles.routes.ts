import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { rolesController } from './roles.controller.js';
import type { RolesService } from './roles.service.js';

export function rolesRoutes(service: RolesService) {
  const router = Router();
  router.get('/roles', validate(z.strictObject({}), 'query'), rolesController(service).list);
  return router;
}
