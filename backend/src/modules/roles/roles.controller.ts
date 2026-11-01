import { asyncHandler } from '../../utils/asyncHandler.js';
import { success } from '../../utils/response.js';
import type { RolesService } from './roles.service.js';

export function rolesController(service: RolesService) {
  return {
    list: asyncHandler(async (req, res) => {
      res.json(
        success({
          roles: req.query.summary === 'true' ? await service.summaries() : await service.list(),
        }),
      );
    }),
    find: asyncHandler(async (req, res) => {
      res.json(success({ role: await service.find(req.params.id!) }));
    }),
  };
}
