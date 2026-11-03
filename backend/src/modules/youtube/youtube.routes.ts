import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import type { AuthService } from '../auth/auth.service.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { success, failure } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { studioDb, studioTransaction, ownedResource } from '../studio/studio.db.js';
import { readPreview } from '../studio/studio.providers.js';
import { validateSections } from '../studio/studio.resources.js';
import { sectionSchema } from '../studio/studio.schemas.js';
import { buildYouTubePlan } from './youtube.planner.js';
import { discoverVideos, videoComments } from './youtube.discovery.js';
import { discoverySchema, planningSchema, languageSchema } from './youtube.schemas.js';
const planInput = z.strictObject({ version: z.number().int().min(0), preferences: planningSchema });
const resourceParams = z.strictObject({ id: z.uuid() });
const limit = (max: number) =>
  rateLimit({
    windowMs: 60000,
    limit: max,
    keyGenerator: (req) => req.auth!.user.id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res
        .status(429)
        .json(failure('YOUTUBE_RATE_LIMIT', 'Please wait a minute before trying again.')),
  });
export function youtubeRoutes(auth: AuthService) {
  const router = Router();
  const authenticated = requireAuth(auth);
  router.use('/youtube', authenticated, (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get(
    '/youtube/preferences',
    asyncHandler(async (req, res) => {
      res.json(
        success(
          await studioDb().youTubePreference.findUnique({ where: { userId: req.auth!.user.id } }),
        ),
      );
    }),
  );
  router.put(
    '/youtube/preferences',
    validate(z.strictObject({ language: languageSchema })),
    asyncHandler(async (req, res) => {
      res.json(
        success(
          await studioDb().youTubePreference.upsert({
            where: { userId: req.auth!.user.id },
            create: { userId: req.auth!.user.id, language: req.body.language },
            update: { language: req.body.language },
          }),
        ),
      );
    }),
  );
  router.get(
    '/youtube/plans',
    asyncHandler(async (req, res) => {
      const plans = await studioDb().youTubeStudyPlan.findMany({
        where: { userId: req.auth!.user.id },
        select: {
          resourceId: true,
          goal: true,
          level: true,
          language: true,
          updatedAt: true,
          resource: { select: { title: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
      res.json(success(plans));
    }),
  );
  router.get(
    '/youtube/recommendations',
    limit(3),
    validate(discoverySchema, 'query'),
    asyncHandler(async (req, res) => {
      try {
        res.json(
          success(await discoverVideos(req.auth!.user.id, discoverySchema.parse(req.query))),
        );
      } catch (error) {
        if (error instanceof z.ZodError)
          throw new AppError(
            503,
            'YOUTUBE_UNAVAILABLE',
            'YouTube returned incomplete data. Please try again later.',
          );
        throw error;
      }
    }),
  );
  router.get(
    '/youtube/videos/:id/comments',
    limit(12),
    validate(z.strictObject({ id: z.string().regex(/^[\w-]{11}$/) }), 'params'),
    asyncHandler(async (req, res) => {
      res.json(success(await videoComments(req.params.id!)));
    }),
  );
  router.post(
    '/resources/import/study-plan-preview',
    authenticated,
    limit(12),
    validate(
      z.strictObject({
        previewToken: z.string().max(1500000),
        sections: z.array(sectionSchema).min(1).max(2000),
        preferences: planningSchema,
      }),
    ),
    asyncHandler(async (req, res) => {
      const preview = readPreview(req.body.previewToken, req.auth!.user.id);
      if (preview.provider !== 'youtube')
        throw new AppError(422, 'YOUTUBE_REQUIRED', 'Choose a YouTube resource.');
      const sections = z.array(sectionSchema).parse(req.body.sections);
      validateSections(
        sections,
        preview.items.map((i) => i.key),
      );
      const items = new Map(preview.items.map((i) => [i.key, i]));
      res.json(
        success(
          buildYouTubePlan(
            sections.map((s) => ({
              title: s.title,
              items: s.itemKeys.map((key) => ({ ...items.get(key)!, id: key })),
            })),
            planningSchema.parse(req.body.preferences),
          ),
        ),
      );
    }),
  );
  router.get(
    '/resources/:id/study-plan',
    authenticated,
    validate(resourceParams, 'params'),
    asyncHandler(async (req, res) => {
      const resource = await ownedResource(req.auth!.user.id, req.params.id!);
      const plan = await studioDb().youTubeStudyPlan.findUnique({
        where: { resourceId: resource.id },
      });
      res
        .set('Cache-Control', 'no-store')
        .json(success(plan ? { ...plan, stale: plan.resourceVersion !== resource.version } : null));
    }),
  );
  router.post(
    '/resources/:id/study-plan/preview',
    authenticated,
    limit(12),
    validate(resourceParams, 'params'),
    validate(z.strictObject({ preferences: planningSchema })),
    asyncHandler(async (req, res) => {
      const resource = await ownedResource(req.auth!.user.id, req.params.id!);
      if (resource.provider !== 'youtube')
        throw new AppError(422, 'YOUTUBE_REQUIRED', 'Choose a YouTube resource.');
      const sections = await studioDb().studioSection.findMany({
        where: { resourceId: resource.id },
        orderBy: { order: 'asc' },
        include: { items: { orderBy: { order: 'asc' } } },
      });
      res.json(success(buildYouTubePlan(sections, planningSchema.parse(req.body.preferences))));
    }),
  );
  router.put(
    '/resources/:id/study-plan',
    authenticated,
    limit(12),
    validate(resourceParams, 'params'),
    validate(planInput),
    asyncHandler(async (req, res) => {
      const userId = req.auth!.user.id,
        resourceId = req.params.id!,
        input = planInput.parse(req.body);
      const result = await studioTransaction(async (tx) => {
        const resource = await ownedResource(userId, resourceId, tx);
        if (resource.provider !== 'youtube')
          throw new AppError(422, 'YOUTUBE_REQUIRED', 'Choose a YouTube resource.');
        const existing = await tx.youTubeStudyPlan.findUnique({ where: { resourceId } });
        if ((existing?.version ?? 0) !== input.version)
          throw new AppError(
            409,
            'YOUTUBE_PLAN_CHANGED',
            'This study plan changed. Reload before saving.',
          );
        const sections = await tx.studioSection.findMany({
          where: { resourceId },
          orderBy: { order: 'asc' },
          include: { items: { orderBy: { order: 'asc' } } },
        });
        const schedule = buildYouTubePlan(sections, input.preferences);
        const { goal, level, language, timezone } = input.preferences;
        const data = {
          userId,
          goal,
          level,
          language,
          timezone,
          preferences: input.preferences,
          schedule,
          resourceVersion: resource.version,
        };
        const plan = await tx.youTubeStudyPlan.upsert({
          where: { resourceId },
          create: { resourceId, ...data },
          update: { ...data, version: { increment: 1 } },
        });
        await tx.youTubePreference.upsert({
          where: { userId },
          create: { userId, language },
          update: { language },
        });
        return { ...plan, stale: false };
      });
      res.json(success(result));
    }),
  );
  return router;
}
