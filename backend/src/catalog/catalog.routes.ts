import { Router } from 'express';
import { z } from 'zod';
import {
  catalogRoles,
  categories,
  rolesById,
  rolesByDatabaseId,
  skillsById,
  searchCatalogSkills,
} from './catalog.js';
import { buildCatalogRoadmap } from './catalog.roadmaps.js';
import { rankRoles, mergeLearningProfile } from './catalog.matching.js';
import { studioDb } from '../modules/studio/studio.db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import type { AuthService } from '../modules/auth/auth.service.js';
import type { SkillsRepository } from '../modules/skills/skills.types.js';

const querySchema = z.strictObject({
  search: z.string().trim().max(100).default(''),
  category: z.string().max(60).default(''),
  sort: z.enum(['trending', 'name', 'skills']).default('trending'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});
const index = catalogRoles.map((role) => ({
  role,
  text: [
    role.name,
    role.description,
    ...role.aliases,
    ...role.keywords,
    ...role.skills.map((row) => skillsById.get(row.skillId)!.name),
  ]
    .join(' ')
    .toLowerCase(),
}));
export function catalogRoutes(auth: AuthService, skills: SkillsRepository) {
  const router = Router();
  router.get('/career-catalog/categories', (_req, res) => res.json(success({ categories })));
  router.get(
    '/career-catalog/roles',
    validate(querySchema, 'query'),
    asyncHandler(async (req, res) => {
      const query = querySchema.parse(req.query);
      const filtered = index
        .filter(
          ({ role, text }) =>
            (!query.category || role.category === query.category) &&
            text.includes(query.search.toLowerCase()),
        )
        .map(({ role }) => role)
        .sort(
          (a, b) =>
            (query.sort === 'trending'
              ? Number(b.trending) - Number(a.trending)
              : query.sort === 'skills'
                ? b.skills.length - a.skills.length
                : 0) || a.name.localeCompare(b.name),
        );
      res.json(
        success({
          total: filtered.length,
          page: query.page,
          pages: Math.ceil(filtered.length / query.limit),
          roles: filtered
            .slice((query.page - 1) * query.limit, query.page * query.limit)
            .map((role) => ({
              id: role.databaseId,
              slug: role.id,
              title: role.name,
              description: role.description,
              category: role.category,
              trending: role.trending,
              coreSkills: role.skills.filter((skill) => skill.importance === 'core').length,
              skillCount: role.skills.length,
            })),
        }),
      );
    }),
  );
  router.get(
    '/career-catalog/skills',
    validate(
      z.strictObject({
        search: z.string().max(100).default(''),
        category: z.string().max(60).optional(),
      }),
      'query',
    ),
    asyncHandler(async (req, res) => {
      const query = z
        .strictObject({
          search: z.string().max(100).default(''),
          category: z.string().max(60).optional(),
        })
        .parse(req.query);
      res.json(
        success({
          skills: searchCatalogSkills(query.search, query.category, 60).map((skill) => ({
            id: skill.databaseId,
            name: skill.name,
            category: skill.category,
            description: skill.description,
          })),
        }),
      );
    }),
  );
  router.get(
    '/career-catalog/roles/:id',
    validate(z.strictObject({ id: z.string().min(1).max(150) }), 'params'),
    asyncHandler(async (req, res) => {
      const id = z.string().max(150).parse(req.params.id);
      const role = rolesById.get(id) ?? rolesByDatabaseId.get(id);
      if (!role) throw new AppError(404, 'ROLE_NOT_FOUND', 'This role is not available.');
      res.json(
        success({
          role: {
            ...role,
            skills: role.skills.map((row) => ({ ...row, skill: skillsById.get(row.skillId)! })),
          },
          roadmap: buildCatalogRoadmap(role),
          relatedRoles: role.relatedRoles.map((id) => ({ id, name: rolesById.get(id)!.name })),
          careerPath: {
            from: role.careerPath.from.map((id) => ({ id, name: rolesById.get(id)!.name })),
            to: role.careerPath.to.map((id) => ({ id, name: rolesById.get(id)!.name })),
          },
        }),
      );
    }),
  );
  router.get(
    '/career-catalog/recommendations',
    requireAuth(auth),
    validate(z.strictObject({ interests: z.string().max(300).default('') }), 'query'),
    asyncHandler(async (req, res) => {
      const query = z.strictObject({ interests: z.string().max(300).default('') }).parse(req.query);
      res.set('Cache-Control', 'no-store').json(
        success(
          rankRoles(
            mergeLearningProfile(
              await skills.listProfile(req.auth!.user.id),
              await studioDb().userSkillProgress.findMany({
                where: { userId: req.auth!.user.id },
                select: { skillId: true, status: true, percent: true },
              }),
            ),
            query.interests.split(',').filter(Boolean),
          ),
        ),
      );
    }),
  );
  return router;
}
