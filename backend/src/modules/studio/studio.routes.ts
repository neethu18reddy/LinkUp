import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import type { AuthService } from '../auth/auth.service.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { success, failure } from '../../utils/response.js';
import { env } from '../../config/env.js';
import { matchesCronSecret } from '../../jobs/weekly.js';
import { studioDb, studioTransaction, studioSettings, ownedResource } from './studio.db.js';
import {
  importSchema,
  saveResourceSchema,
  editSectionsSchema,
  heartbeatSchema,
  settingsSchema,
  noteSchema,
  snippetSchema,
} from './studio.schemas.js';
import { importPreview } from './studio.providers.js';
import {
  listResources,
  saveResource,
  getResource,
  editSections,
  deleteResource,
} from './studio.resources.js';
import { skillProgressView, writeSkillProgress } from './studio.sync.js';
import {
  beginWatch,
  heartbeat,
  completeItem,
  watchToken,
  verifyWatchToken,
  addDaily,
} from './studio.watch.js';
import { documents, saveNote, saveSnippet } from './studio.documents.js';
import { analytics, recap } from './studio.analytics.js';
import { localDate } from './studio.time.js';

export async function finalizeStudioDays() {
  const db = studioDb(),
    started = Date.now();
  const state = await db.scheduledJobState.findUnique({ where: { id: 'studio-rollover' } });
  const users = await db.user.findMany({
    where: {
      studioResources: { some: {} },
      ...(state?.cursor ? { id: { gt: state.cursor } } : {}),
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: 50,
  });
  let processed = 0,
    cursor: string | null = state?.cursor ?? null;
  for (const user of users) {
    await recap(user.id);
    cursor = user.id;
    processed++;
    if (Date.now() - started > 15000) break;
  }
  if (processed === users.length && users.length < 50) cursor = null;
  await db.scheduledJobState.upsert({
    where: { id: 'studio-rollover' },
    create: { id: 'studio-rollover', cursor },
    update: { cursor },
  });
  return { processed, hasMore: !!cursor };
}
export function studioRoutes(auth: AuthService) {
  const router = Router();
  const idParams = validate(z.strictObject({ id: z.uuid() }), 'params');
  const privatePaths = [
    '/resources',
    '/notes',
    '/snippets',
    '/analytics',
    '/recap',
    '/studio',
    '/progress/watch',
    '/progress/complete',
    '/progress/heartbeat',
  ];
  const limiter = (limit: number, windowMs = 60000) =>
    rateLimit({
      windowMs,
      limit,
      keyGenerator: (req) => req.auth!.user.id,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) =>
        res.status(429).json(failure('STUDIO_RATE_LIMIT', 'Take a short pause and try again.')),
    });
  router.post(
    '/progress/heartbeat/beacon',
    validate(heartbeatSchema.extend({ token: z.string().max(2000) })),
    asyncHandler(async (req, res) => {
      const { token, ...body } = req.body as z.infer<typeof heartbeatSchema> & { token: string };
      const claims = await verifyWatchToken(token);
      if (claims.itemId !== body.itemId || claims.sessionId !== body.sessionId)
        throw new AppError(401, 'WATCH_TOKEN_INVALID', 'Playback token does not match this item.');
      await heartbeat(claims.userId, body);
      res.status(204).end();
    }),
  );
  for (const method of ['get', 'post'] as const)
    router[method](
      '/cron/daily-rollover',
      asyncHandler(async (req, res) => {
        if (!env.CRON_SECRET)
          throw new AppError(503, 'JOBS_DISABLED', 'Daily rollover is not configured.');
        if (
          !matchesCronSecret(
            /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '')?.[1],
            env.CRON_SECRET,
          )
        )
          throw new AppError(401, 'JOB_UNAUTHORIZED', 'Invalid job credentials.');
        res.json(success(await finalizeStudioDays()));
      }),
    );
  router.use(privatePaths, requireAuth(auth), (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get(
    '/studio/settings',
    asyncHandler(
      async (req, res) => void res.json(success(await studioSettings(req.auth!.user.id))),
    ),
  );
  router.patch(
    '/studio/settings',
    validate(settingsSchema),
    asyncHandler(async (req, res) => {
      const input = settingsSchema.parse(req.body);
      res.json(
        success(
          await studioDb().userSettings.upsert({
            where: { userId: req.auth!.user.id },
            create: { userId: req.auth!.user.id, ...input, timezoneConfirmed: true },
            update: { ...input, timezoneConfirmed: true },
          }),
        ),
      );
    }),
  );
  router.get(
    '/studio/skills',
    asyncHandler(
      async (req, res) => void res.json(success(await skillProgressView(req.auth!.user.id))),
    ),
  );
  router.get(
    '/studio/skills/:id',
    idParams,
    asyncHandler(async (req, res) => {
      const skill = await studioDb().skill.findFirst({
        where: { id: req.params.id!, NOT: { category: 'Custom' } },
        select: { id: true, name: true },
      });
      if (!skill) throw new AppError(404, 'SKILL_NOT_FOUND', 'Skill not found.');
      res.json(success(skill));
    }),
  );
  router.patch(
    '/studio/skills/:id',
    idParams,
    validate(z.strictObject({ complete: z.boolean() })),
    asyncHandler(async (req, res) => {
      const skill = await studioDb().skill.findFirst({
        where: { id: req.params.id!, NOT: { category: 'Custom' } },
      });
      if (!skill) throw new AppError(404, 'SKILL_NOT_FOUND', 'Skill not found.');
      res.json(
        success(
          await studioTransaction((tx) =>
            writeSkillProgress(
              tx,
              req.auth!.user.id,
              skill.id,
              req.body.complete ? 'DONE' : 'NOT_STARTED',
              'MANUAL',
              req.body.complete ? 100 : 0,
            ),
          ),
        ),
      );
    }),
  );
  router.post(
    '/resources/import/preview',
    limiter(12, 3600000),
    validate(importSchema),
    asyncHandler(
      async (req, res) =>
        void res.json(
          success(await importPreview(req.auth!.user.id, importSchema.parse(req.body))),
        ),
    ),
  );
  router.get(
    '/resources',
    validate(z.strictObject({ page: z.coerce.number().int().min(1).max(100).default(1) }), 'query'),
    asyncHandler(
      async (req, res) =>
        void res.json(success(await listResources(req.auth!.user.id, Number(req.query.page ?? 1)))),
    ),
  );
  router.post(
    '/resources',
    limiter(12, 3600000),
    validate(saveResourceSchema),
    asyncHandler(async (req, res) => {
      const id = await saveResource(req.auth!.user.id, saveResourceSchema.parse(req.body));
      res.status(201).json(success(await getResource(req.auth!.user.id, id)));
    }),
  );
  router.get(
    '/resources/:id',
    idParams,
    asyncHandler(
      async (req, res) =>
        void res.json(success(await getResource(req.auth!.user.id, req.params.id!))),
    ),
  );
  router.patch(
    '/resources/:id',
    idParams,
    validate(
      z.strictObject({
        title: z.string().trim().min(1).max(200),
        version: z.number().int().positive(),
      }),
    ),
    asyncHandler(async (req, res) => {
      await ownedResource(req.auth!.user.id, req.params.id!);
      const changed = await studioDb().studioResource.updateMany({
        where: { id: req.params.id!, userId: req.auth!.user.id, version: req.body.version },
        data: { title: req.body.title, version: { increment: 1 } },
      });
      if (!changed.count)
        throw new AppError(409, 'RESOURCE_CHANGED', 'Reload before renaming this resource.');
      res.json(success(await getResource(req.auth!.user.id, req.params.id!)));
    }),
  );
  router.patch(
    '/resources/:id/sections',
    idParams,
    validate(editSectionsSchema),
    asyncHandler(
      async (req, res) =>
        void res.json(
          success(
            await editSections(
              req.auth!.user.id,
              req.params.id!,
              editSectionsSchema.parse(req.body),
            ),
          ),
        ),
    ),
  );
  router.delete(
    '/resources/:id',
    idParams,
    asyncHandler(
      async (req, res) =>
        void res.json(success(await deleteResource(req.auth!.user.id, req.params.id!))),
    ),
  );
  router.get(
    '/resources/:id/activity',
    idParams,
    validate(
      z.strictObject({ kind: z.string().max(40).default(''), cursor: z.uuid().optional() }),
      'query',
    ),
    asyncHandler(async (req, res) => {
      const userId = req.auth!.user.id,
        resourceId = req.params.id!;
      await ownedResource(userId, resourceId);
      if (
        req.query.cursor &&
        !(await studioDb().studioActivity.findFirst({
          where: { id: String(req.query.cursor), userId, resourceId },
        }))
      )
        throw new AppError(404, 'ACTIVITY_NOT_FOUND', 'Activity cursor not found.');
      const events = await studioDb().studioActivity.findMany({
        where: { userId, resourceId, ...(req.query.kind ? { kind: String(req.query.kind) } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 51,
        ...(req.query.cursor ? { cursor: { id: String(req.query.cursor) }, skip: 1 } : {}),
      });
      res.json(
        success({
          events: events.slice(0, 50),
          nextCursor: events.length > 50 ? events[49]!.id : null,
        }),
      );
    }),
  );
  router.get(
    '/resources/:id/export',
    idParams,
    asyncHandler(async (req, res) => {
      const userId = req.auth!.user.id,
        resourceId = req.params.id!,
        resource = await getResource(userId, resourceId);
      const [notes, snippets, events, activity] = await Promise.all([
        studioDb().studioNote.findMany({
          where: { userId, resourceId },
          orderBy: { createdAt: 'asc' },
        }),
        studioDb().codeSnippet.findMany({
          where: { userId, resourceId },
          include: { versions: true },
        }),
        studioDb().watchEvent.findMany({
          where: { userId, resourceId },
          orderBy: { startedAt: 'asc' },
        }),
        studioDb().studioActivity.findMany({
          where: { userId, resourceId },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      res
        .set('Content-Disposition', 'attachment; filename="linkup-resource.json"')
        .json(success({ resource, notes, snippets, events, activity }));
    }),
  );
  router.post(
    '/progress/watch',
    limiter(15),
    validate(
      z.strictObject({
        sessionId: z.uuid(),
        itemId: z.uuid(),
        takeover: z.boolean().default(false),
      }),
    ),
    asyncHandler(async (req, res) => {
      const started = await beginWatch(
        req.auth!.user.id,
        req.body.sessionId,
        req.body.itemId,
        req.body.takeover,
      );
      res.json(
        success({
          ...started,
          token: watchToken(
            req.auth!.user.id,
            req.auth!.familyId,
            req.body.sessionId,
            req.body.itemId,
          ),
        }),
      );
    }),
  );
  router.post(
    '/progress/heartbeat',
    limiter(20),
    validate(heartbeatSchema),
    asyncHandler(
      async (req, res) =>
        void res.json(
          success({
            progress: await heartbeat(req.auth!.user.id, heartbeatSchema.parse(req.body)),
            token: watchToken(
              req.auth!.user.id,
              req.auth!.familyId,
              req.body.sessionId,
              req.body.itemId,
            ),
          }),
        ),
    ),
  );
  router.post(
    '/progress/complete',
    limiter(30),
    validate(z.strictObject({ itemId: z.uuid(), complete: z.boolean() })),
    asyncHandler(
      async (req, res) =>
        void res.json(
          success(
            await studioTransaction((tx) =>
              completeItem(
                tx,
                req.auth!.user.id,
                req.body.itemId,
                req.body.complete,
                'manual',
                new Date(),
              ),
            ),
          ),
        ),
    ),
  );
  const documentQuery = z.strictObject({
    resourceId: z.uuid().optional(),
    itemId: z.uuid().optional(),
    search: z.string().max(100).default(''),
  });
  router.get(
    '/notes',
    validate(documentQuery, 'query'),
    asyncHandler(async (req, res) => {
      const query = documentQuery.parse(req.query);
      res.json(
        success(
          await documents(req.auth!.user.id, 'notes', query.resourceId, query.search, query.itemId),
        ),
      );
    }),
  );
  router.get(
    '/snippets',
    validate(documentQuery, 'query'),
    asyncHandler(async (req, res) => {
      const query = documentQuery.parse(req.query);
      res.json(
        success(
          await documents(
            req.auth!.user.id,
            'snippets',
            query.resourceId,
            query.search,
            query.itemId,
          ),
        ),
      );
    }),
  );
  for (const method of ['post', 'patch'] as const) {
    router[method](
      '/notes',
      limiter(45),
      validate(noteSchema),
      asyncHandler(
        async (req, res) =>
          void res.json(success(await saveNote(req.auth!.user.id, noteSchema.parse(req.body)))),
      ),
    );
    router[method](
      '/snippets',
      limiter(45),
      validate(snippetSchema),
      asyncHandler(
        async (req, res) =>
          void res.json(
            success(await saveSnippet(req.auth!.user.id, snippetSchema.parse(req.body))),
          ),
      ),
    );
  }
  for (const kind of ['notes', 'snippets'] as const)
    router.delete(
      `/${kind}/:id`,
      idParams,
      asyncHandler(async (req, res) => {
        const where = { id: req.params.id!, userId: req.auth!.user.id };
        const removed =
          kind === 'notes'
            ? await studioDb().studioNote.deleteMany({ where })
            : await studioDb().codeSnippet.deleteMany({ where });
        if (!removed.count)
          throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Saved document not found.');
        res.json(success({ deleted: true }));
      }),
    );
  router.get(
    '/snippets/:id/versions',
    idParams,
    asyncHandler(async (req, res) => {
      if (
        !(await studioDb().codeSnippet.findFirst({
          where: { id: req.params.id!, userId: req.auth!.user.id },
        }))
      )
        throw new AppError(404, 'SNIPPET_NOT_FOUND', 'Snippet not found.');
      res.json(
        success(
          await studioDb().snippetVersion.findMany({
            where: { snippetId: req.params.id! },
            orderBy: { savedAt: 'desc' },
            take: 20,
          }),
        ),
      );
    }),
  );
  router.post(
    '/snippets/:id/runs',
    idParams,
    limiter(15),
    validate(
      z.strictObject({
        id: z.uuid(),
        status: z.enum(['success', 'error', 'timeout']),
        durationMs: z.number().int().min(0).max(120000),
      }),
    ),
    asyncHandler(async (req, res) => {
      const userId = req.auth!.user.id;
      const snippet = await studioDb().codeSnippet.findFirst({
        where: { id: req.params.id!, userId },
      });
      if (!snippet) throw new AppError(404, 'SNIPPET_NOT_FOUND', 'Snippet not found.');
      res.json(
        success(
          await studioTransaction(async (tx) => {
            const existing = await tx.snippetRun.findUnique({ where: { id: req.body.id } });
            if (existing) {
              if (existing.snippetId !== snippet.id)
                throw new AppError(409, 'RUN_ID_REUSED', 'Use a new run identifier.');
              return existing;
            }
            const run = await tx.snippetRun.create({
              data: {
                id: req.body.id,
                snippetId: snippet.id,
                language: snippet.language,
                status: req.body.status,
                durationMs: req.body.durationMs,
              },
            });
            const timezone =
              (await tx.userSettings.findUnique({ where: { userId } }))?.timezone ?? 'UTC';
            await addDaily(tx, userId, snippet.resourceId, localDate(new Date(), timezone), {
              runsCount: 1,
            });
            await tx.studioActivity.create({
              data: {
                userId,
                resourceId: snippet.resourceId,
                itemId: snippet.itemId,
                kind: 'snippet_run',
                title: snippet.title,
              },
            });
            return run;
          }),
        ),
      );
    }),
  );
  const analyticsQuery = z.strictObject({
    days: z.coerce
      .number()
      .int()
      .refine((value) => [7, 30, 90].includes(value))
      .default(30),
  });
  router.get(
    '/analytics/overview',
    validate(analyticsQuery, 'query'),
    asyncHandler(
      async (req, res) =>
        void res.json(
          success(await analytics(req.auth!.user.id, undefined, Number(req.query.days ?? 30))),
        ),
    ),
  );
  router.get(
    '/analytics/resource/:id',
    idParams,
    validate(analyticsQuery, 'query'),
    asyncHandler(
      async (req, res) =>
        void res.json(
          success(await analytics(req.auth!.user.id, req.params.id!, Number(req.query.days ?? 30))),
        ),
    ),
  );
  router.get(
    '/recap/today',
    asyncHandler(async (req, res) => void res.json(success(await recap(req.auth!.user.id)))),
  );
  router.get(
    '/recap/:date',
    validate(z.strictObject({ date: z.iso.date() }), 'params'),
    asyncHandler(
      async (req, res) =>
        void res.json(success(await recap(req.auth!.user.id, String(req.params.date)))),
    ),
  );
  return router;
}
