import { asyncHandler } from '../../utils/asyncHandler.js';
import { success } from '../../utils/response.js';
import type { RoadmapService } from './roadmap.service.js';

export function roadmapController(service: RoadmapService) {
  return {
    current: asyncHandler(async (req, res) => {
      res.json(success(await service.current(req.auth!.user.id)));
    }),
    generate: asyncHandler(async (req, res) => {
      res.status(201).json(success(await service.generate(req.auth!.user.id, req.body.goalId)));
    }),
    get: asyncHandler(async (req, res) => {
      res.json(success({ roadmap: await service.get(req.auth!.user.id, req.params.id!) }));
    }),
    regenerate: asyncHandler(async (req, res) => {
      res.status(201).json(success(await service.regenerate(req.auth!.user.id, req.params.id!)));
    }),
  };
}
