import { asyncHandler } from '../../utils/asyncHandler.js';
import { success } from '../../utils/response.js';
import { createGoalSchema } from './goals.schemas.js';
import type { GoalsService } from './goals.service.js';

export function goalsController(service: GoalsService) {
  return {
    current: asyncHandler(async (req, res) => {
      res.json(success({ goal: await service.current(req.auth!.user.id) }));
    }),
    create: asyncHandler(async (req, res) => {
      res.status(200).json(
        success({
          goal: await service.create(req.auth!.user.id, createGoalSchema.parse(req.body)),
        }),
      );
    }),
  };
}
