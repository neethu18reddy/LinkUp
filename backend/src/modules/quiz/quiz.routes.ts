import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import type { AuthService } from '../auth/auth.service.js';
import { quizController } from './quiz.controller.js';
import { quizSubmitSchema } from './quiz.schemas.js';
import type { QuizService } from './quiz.service.js';

export function quizRoutes(service: QuizService, auth: AuthService) {
  const router = Router();
  const controller = quizController(service);
  router.get('/quiz/questions', validate(z.strictObject({}), 'query'), controller.questions);
  router.use('/quiz', requireAuth(auth), (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/quiz/latest', validate(z.strictObject({}), 'query'), controller.latest);
  router.post(
    '/quiz/submit',
    validate(z.strictObject({}), 'query'),
    validate(quizSubmitSchema),
    controller.submit,
  );
  return router;
}
