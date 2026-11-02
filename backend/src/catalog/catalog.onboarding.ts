import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { Router } from 'express';
import { catalogSkills, catalogRoles } from './catalog.js';
import { rankRoles, mergeLearningProfile } from './catalog.matching.js';
import { studioDb } from '../modules/studio/studio.db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { success } from '../utils/response.js';
import type { AuthService } from '../modules/auth/auth.service.js';
import type { SkillsRepository } from '../modules/skills/skills.types.js';
import type { QuizRepository } from '../modules/quiz/quiz.types.js';

export const questionnaire = z
  .array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      multiple: z.boolean(),
      options: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          domains: z.array(z.string()).optional(),
          skill: z.string().optional(),
        }),
      ),
    }),
  )
  .parse(
    JSON.parse(
      readFileSync(
        new URL('../../prisma/data/catalog/questionnaire.json', import.meta.url),
        'utf8',
      ),
    ),
  );
const submission = z.strictObject({
  answers: z
    .array(
      z.strictObject({
        questionId: z.string().max(60),
        optionIds: z.array(z.string().max(100)).min(1).max(20),
      }),
    )
    .length(questionnaire.length),
});
export function onboardingRoutes(
  auth: AuthService,
  skills: SkillsRepository,
  quizzes: QuizRepository,
) {
  const router = Router();
  router.get('/career-catalog/questionnaire', (_req, res) =>
    res.json(success({ questions: questionnaire })),
  );
  router.post(
    '/career-catalog/onboarding',
    requireAuth(auth),
    validate(submission),
    asyncHandler(async (req, res) => {
      const { answers } = submission.parse(req.body);
      const selected = new Map(answers.map((answer) => [answer.questionId, answer.optionIds]));
      if (selected.size !== questionnaire.length)
        throw new AppError(422, 'QUESTIONNAIRE_INVALID', 'Answer each question once.');
      for (const question of questionnaire) {
        const values = selected.get(question.id);
        if (
          !values ||
          (!question.multiple && values.length !== 1) ||
          new Set(values).size !== values.length ||
          values.some((id) => !question.options.some((option) => option.id === id))
        )
          throw new AppError(
            422,
            'QUESTIONNAIRE_INVALID',
            'Choose valid answers for every question.',
          );
      }
      const interest = selected.get('interest')![0]!;
      const tools = selected.get('tools')!;
      const toolQuestion = questionnaire.find((question) => question.id === 'tools')!;
      if (tools.includes('none') && tools.length > 1)
        throw new AppError(422, 'QUESTIONNAIRE_INVALID', 'Choose tools or None yet.');
      const toolOptions = toolQuestion.options.filter((option) => tools.includes(option.id));
      if (toolOptions.some((option) => option.domains && !option.domains.includes(interest)))
        throw new AppError(422, 'QUESTIONNAIRE_INVALID', 'Choose tools from your interest area.');
      const profile = await skills.listProfile(req.auth!.user.id);
      for (const option of toolOptions) {
        const skill = catalogSkills.find((skill) => skill.name === option.skill);
        if (skill && !profile.some((row) => row.skillId === skill.databaseId)) {
          try {
            profile.push(await skills.add(req.auth!.user.id, skill.databaseId, 'BEGINNER'));
          } catch (error) {
            if (!(error instanceof AppError && error.code === 'SKILL_ALREADY_ADDED')) throw error;
          }
        }
      }
      const ranked = rankRoles(
        mergeLearningProfile(
          profile,
          await studioDb().userSkillProgress.findMany({
            where: { userId: req.auth!.user.id },
            select: { skillId: true, status: true, percent: true },
          }),
        ),
        [interest],
        catalogRoles.filter((role) => role.category === interest),
      );
      const recommendations = ranked.recommendations.map((role) => ({
        ...role,
        reasons: [role.explanation],
      }));
      const record = await quizzes.save(
        req.auth!.user.id,
        answers.flatMap((answer) =>
          answer.optionIds.map((optionId) => ({ questionId: answer.questionId, optionId })),
        ),
        recommendations,
      );
      res.status(201).json(
        success({
          id: record.id,
          recommendations,
          alternatives: ranked.alternatives,
          stretchRoles: ranked.stretchRoles,
          hoursPerWeek: Number(selected.get('weekly-hours')![0]),
          learningStyle: selected.get('style')![0],
        }),
      );
    }),
  );
  return router;
}
