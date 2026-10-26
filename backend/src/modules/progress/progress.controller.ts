import { asyncHandler } from '../../utils/asyncHandler.js';
import { success } from '../../utils/response.js';
import type { ProgressService } from './progress.service.js';
export function progressController(service: ProgressService) {
  return {
    summary: asyncHandler(async (req, res) => {
      res.json(
        success(
          await service.summary(req.auth!.user.id, req.query.roadmapId as string | undefined),
        ),
      );
    }),
    task: asyncHandler(async (req, res) => {
      res.json(
        success({ task: await service.updateTask(req.auth!.user.id, req.params.id!, req.body) }),
      );
    }),
    log: asyncHandler(async (req, res) => {
      res.status(201).json(success({ log: await service.addLog(req.auth!.user.id, req.body) }));
    }),
    logs: asyncHandler(async (req, res) => {
      res.json(
        success(
          await service.logs(
            req.auth!.user.id,
            Number(req.query.limit),
            req.query.cursor as string | undefined,
          ),
        ),
      );
    }),
    project: asyncHandler(async (req, res) => {
      res.json(success({ project: await service.submitProject(req.auth!.user.id, req.body) }));
    }),
    projects: asyncHandler(async (req, res) => {
      res.json(
        success({
          projects: await service.projects(req.auth!.user.id, req.query.roadmapId as string),
        }),
      );
    }),
  };
}
