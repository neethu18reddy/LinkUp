import { asyncHandler } from '../../utils/asyncHandler.js';
import { success } from '../../utils/response.js';
import type { PlanService } from './plan.service.js';
export function planController(service: PlanService) {
  return {
    current: asyncHandler(async (req, res) => {
      res.json(
        success({ plan: await service.current(req.auth!.user.id, req.query.roadmapId as string) }),
      );
    }),
    get: asyncHandler(async (req, res) => {
      res.json(success({ plan: await service.get(req.auth!.user.id, req.params.id!) }));
    }),
    preview: asyncHandler(async (req, res) => {
      res.json(success({ preview: await service.preview(req.auth!.user.id, req.body) }));
    }),
    create: asyncHandler(async (req, res) => {
      res.status(201).json(success({ plan: await service.save(req.auth!.user.id, req.body) }));
    }),
    replan: asyncHandler(async (req, res) => {
      res
        .status(201)
        .json(success({ plan: await service.replan(req.auth!.user.id, req.params.id!, req.body) }));
    }),
  };
}
