import { z } from 'zod';
import { dimensions, questionIds } from './quiz.data.js';

export const quizAnswerSchema = z.strictObject({
  questionId: z.enum(questionIds),
  optionId: z.enum(dimensions),
});
export const quizSubmitSchema = z.strictObject({
  answers: z
    .array(quizAnswerSchema)
    .length(questionIds.length)
    .refine(
      (answers) => new Set(answers.map((answer) => answer.questionId)).size === questionIds.length,
      'Answer each question exactly once.',
    ),
});
export const recommendationSchema = z.object({
  roleId: z.uuid(),
  title: z.string(),
  description: z.string(),
  reasons: z.array(z.string()).min(1).max(3),
});
export type QuizAnswer = z.infer<typeof quizAnswerSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
