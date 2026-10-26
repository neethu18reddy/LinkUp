import { z } from 'zod';
import { api } from '@/lib/api';

const roleSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  requirements: z.array(
    z.object({
      skillId: z.uuid(),
      requiredLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
      weight: z.number().int().positive(),
      skill: z.object({ name: z.string(), category: z.string() }),
    }),
  ),
});
const goalSchema = z.object({
  id: z.uuid(),
  targetRole: z.string(),
  roleTemplateId: z.uuid().nullable(),
  source: z.enum(['DIRECT', 'QUIZ']),
  status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const recommendationSchema = z.object({
  roleId: z.uuid(),
  title: z.string(),
  description: z.string(),
  reasons: z.array(z.string()).min(1),
});
const quizSchema = z.object({
  id: z.uuid(),
  answers: z.array(z.object({ questionId: z.string(), optionId: z.string() })),
  recommendations: z.array(recommendationSchema).length(3),
  createdAt: z.iso.datetime(),
});
const questionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string() })).min(2),
});
export const customGoalSchema = z
  .string()
  .trim()
  .min(2, 'Describe what you want to learn.')
  .max(150, 'Use at most 150 characters.')
  .refine(
    (value) =>
      [...value].every(
        (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
      ),
    'Use valid goal text.',
  )
  .transform((value) => value.replace(/\s+/g, ' '));
export type CareerRole = z.infer<typeof roleSchema>;
export type CurrentGoal = z.infer<typeof goalSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type QuizResult = z.infer<typeof quizSchema>;
export type QuizQuestion = z.infer<typeof questionSchema>;
export type GoalInput = (
  { kind: 'ROLE'; roleId: string; quizResponseId?: string } | { kind: 'CUSTOM'; targetRole: string }
) & { expectedGoalId: string | null };
export const goalKeys = {
  current: ['current-goal'] as const,
  roles: ['career-roles'] as const,
  questions: ['interest-questions'] as const,
  quiz: ['latest-quiz'] as const,
};
export async function getRoles() {
  const response = await api.get('/roles');
  return z.object({ roles: z.array(roleSchema) }).parse(response.data.data).roles;
}
export async function getCurrentGoal() {
  const response = await api.get('/goals/current');
  return z.object({ goal: goalSchema.nullable() }).parse(response.data.data).goal;
}
export async function saveGoal(input: GoalInput) {
  const response = await api.post('/goals', input);
  return goalSchema.parse(response.data.data.goal);
}
export async function getQuizQuestions() {
  const response = await api.get('/quiz/questions');
  return z
    .object({
      questions: z.array(questionSchema).min(6).max(8),
      method: z.literal('local-scoring'),
    })
    .parse(response.data.data).questions;
}
export async function getLatestQuiz() {
  const response = await api.get('/quiz/latest');
  return z.object({ quiz: quizSchema.nullable() }).parse(response.data.data).quiz;
}
export async function submitQuiz(answers: { questionId: string; optionId: string }[]) {
  const response = await api.post('/quiz/submit', { answers });
  return quizSchema.parse(response.data.data.quiz);
}
