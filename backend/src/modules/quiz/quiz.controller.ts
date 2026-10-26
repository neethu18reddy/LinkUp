import { asyncHandler } from '../../utils/asyncHandler.js';
import { success } from '../../utils/response.js';
import { quizSubmitSchema } from './quiz.schemas.js';
import type { QuizService } from './quiz.service.js';

export function quizController(service: QuizService) {
  return {
    questions: asyncHandler(async (_req, res) => {
      res.json(success({ questions: service.questions(), method: 'local-scoring' }));
    }),
    submit: asyncHandler(async (req, res) => {
      const { answers } = quizSubmitSchema.parse(req.body);
      res.status(201).json(success({ quiz: await service.submit(req.auth!.user.id, answers) }));
    }),
    latest: asyncHandler(async (req, res) => {
      res.json(success({ quiz: await service.latest(req.auth!.user.id) }));
    }),
  };
}
