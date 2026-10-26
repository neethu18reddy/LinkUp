import { asyncHandler } from '../../utils/asyncHandler.js';
import { success } from '../../utils/response.js';
import type { SkillsService } from './skills.service.js';
import {
  addSkillSchema,
  catalogueQuerySchema,
  skillParamsSchema,
  updateSkillSchema,
} from './skills.schemas.js';

export function skillsController(service: SkillsService) {
  return {
    catalogue: asyncHandler(async (req, res) => {
      const { search } = catalogueQuerySchema.parse(req.query);
      res.json(success({ skills: await service.catalogue(search) }));
    }),
    profile: asyncHandler(async (req, res) => {
      res.json(success({ skills: await service.profile(req.auth!.user.id) }));
    }),
    add: asyncHandler(async (req, res) => {
      const { skillId, level } = addSkillSchema.parse(req.body);
      res
        .status(201)
        .json(success({ skill: await service.add(req.auth!.user.id, skillId, level) }));
    }),
    update: asyncHandler(async (req, res) => {
      const { skillId } = skillParamsSchema.parse(req.params);
      const { level } = updateSkillSchema.parse(req.body);
      res.json(success({ skill: await service.update(req.auth!.user.id, skillId, level) }));
    }),
    remove: asyncHandler(async (req, res) => {
      const { skillId } = skillParamsSchema.parse(req.params);
      res.json(success(await service.remove(req.auth!.user.id, skillId)));
    }),
  };
}
