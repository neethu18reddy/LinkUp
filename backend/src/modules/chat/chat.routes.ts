import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { failure } from '../../utils/response.js';
import { success } from '../../utils/response.js';
import type { AuthService } from '../auth/auth.service.js';
import type { ChatService } from './chat.service.js';
import { messageSchema, historySchema, deleteHistorySchema } from './chat.schemas.js';
import { chatController } from './chat.controller.js';
export function chatRoutes(service: ChatService, auth: AuthService) {
  const router = Router(),
    controller = chatController(service),
    empty = validate(z.strictObject({}), 'query');
  router.use('/chat', requireAuth(auth), (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/chat/sessions', empty, controller.sessions);
  router.get('/chat/config', empty, (_req, res) => res.json(success(service.configuration())));
  router.get('/chat/history', validate(historySchema, 'query'), controller.history);
  router.delete('/chat/history', empty, validate(deleteHistorySchema), controller.delete);
  router.post(
    '/chat/message',
    empty,
    validate(messageSchema),
    rateLimit({
      windowMs: 60000,
      limit: 10,
      keyGenerator: (req) => req.auth!.user.id,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) => {
        res
          .status(429)
          .json(failure('CHAT_RATE_LIMIT', 'Please wait a minute before sending more messages.'));
      },
    }),
    controller.message,
  );
  return router;
}
