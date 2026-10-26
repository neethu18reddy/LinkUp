import { asyncHandler } from '../../utils/asyncHandler.js';
import { success } from '../../utils/response.js';
import type { RolesService } from './roles.service.js';

export function rolesController(service: RolesService) {
  return {
    list: asyncHandler(async (_req, res) => {
      res.json(success({ roles: await service.list() }));
    }),
  };
}
