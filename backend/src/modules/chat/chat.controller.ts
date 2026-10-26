import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { success } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import type { ChatService } from './chat.service.js';

async function send(res: Response, event: string, data: unknown, signal: AbortSignal) {
  if (signal.aborted || res.destroyed)
    throw new AppError(408, 'CHAT_CANCELLED', 'Reply cancelled.');
  if (!res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
    await new Promise<void>((resolve, reject) => {
      const clean = () => {
        res.off('drain', drain);
        signal.removeEventListener('abort', abort);
      };
      const drain = () => {
        clean();
        resolve();
      };
      const abort = () => {
        clean();
        reject(new AppError(408, 'CHAT_CANCELLED', 'Reply cancelled.'));
      };
      res.once('drain', drain);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
}
export function chatController(service: ChatService) {
  return {
    sessions: asyncHandler(async (req, res) => {
      res.json(success({ sessions: await service.sessions(req.auth!.user.id) }));
    }),
    history: asyncHandler(async (req, res) => {
      res.json(
        success(
          await service.history(
            req.auth!.user.id,
            req.query.sessionId as string,
            Number(req.query.limit),
            req.query.before === undefined ? undefined : Number(req.query.before),
          ),
        ),
      );
    }),
    delete: asyncHandler(async (req, res) => {
      await service.delete(req.auth!.user.id, req.body.sessionId);
      res.json(success({ deleted: true }));
    }),
    message: asyncHandler(async (req, res) => {
      const controller = new AbortController();
      let prepared: Awaited<ReturnType<ChatService['prepare']>> | undefined;
      const abort = () => {
        if (!res.writableEnded) controller.abort();
      };
      req.once('aborted', abort);
      res.once('close', abort);
      res.once('error', abort);
      const timeout = setTimeout(() => controller.abort(), 30000);
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      try {
        prepared = await service.prepare(req.auth!.user, req.body);
        if (controller.signal.aborted) {
          if (res.destroyed) return;
          throw new AppError(408, 'MENTOR_TIMEOUT', 'The mentor took too long. Please retry.');
        }
        res.status(200).set({
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        });
        res.flushHeaders();
        heartbeat = setInterval(() => {
          if (!res.destroyed && !controller.signal.aborted) res.write(': keepalive\n\n');
        }, 10000);
        for await (const event of service.reply(
          req.auth!.user.id,
          req.body,
          prepared,
          controller.signal,
        ))
          await send(res, event.event, event.data, controller.signal);
      } catch (error) {
        if (!res.headersSent) throw error;
        if (!res.destroyed && !controller.signal.aborted) {
          const known = error instanceof AppError;
          res.write(
            `event: error\ndata: ${JSON.stringify({ code: known ? error.code : 'MENTOR_UNAVAILABLE', message: known ? error.message : 'The mentor could not finish this reply. Please retry.' })}\n\n`,
          );
        }
      } finally {
        clearTimeout(timeout);
        if (heartbeat) clearInterval(heartbeat);
        req.off('aborted', abort);
        res.off('close', abort);
        res.off('error', abort);
        if (prepared)
          await service
            .release(req.auth!.user.id, prepared.reservation)
            .catch(() => logger.warn('Mentor reservation release failed'));
        if (res.headersSent && !res.destroyed) res.end();
      }
    }),
  };
}
