import { z } from 'zod';
import { api } from '@/lib/api';
const resource = z.object({ title: z.string(), url: z.url(), type: z.string(), free: z.boolean() });
export const summarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  trending: z.boolean(),
  coreSkills: z.number(),
  skillCount: z.number(),
});
const matchedRole = z.object({
  roleId: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  matchPercent: z.number(),
  matchedSkills: z.array(z.string()),
  partialSkills: z.array(z.string()),
  missingCoreSkills: z.array(z.string()),
  explanation: z.string(),
});
export const recommendationSet = z.object({
  recommendations: z.array(matchedRole),
  alternatives: z.array(matchedRole),
  stretchRoles: z.array(matchedRole),
});
export type CareerMatch = z.infer<typeof matchedRole>;
export const questionnaireSchema = z.array(
  z.object({
    id: z.string(),
    prompt: z.string(),
    multiple: z.boolean(),
    options: z.array(
      z.object({ id: z.string(), label: z.string(), domains: z.array(z.string()).optional() }),
    ),
  }),
);
export type CareerQuestion = z.infer<typeof questionnaireSchema>[number];
export async function getCareerCategories() {
  return z
    .object({ categories: z.array(z.object({ id: z.string(), name: z.string() })) })
    .parse((await api.get('/career-catalog/categories')).data.data).categories;
}
export async function getCareers(query: {
  search: string;
  category: string;
  sort: string;
  page: number;
}) {
  return z
    .object({
      total: z.number(),
      page: z.number(),
      pages: z.number(),
      roles: z.array(summarySchema),
    })
    .parse((await api.get('/career-catalog/roles', { params: query })).data.data);
}
export async function getCareer(id: string) {
  const link = z.object({ id: z.string(), name: z.string() });
  return z
    .object({
      role: z.object({
        id: z.string(),
        databaseId: z.uuid(),
        name: z.string(),
        description: z.string(),
        demand: z.string(),
        trending: z.boolean(),
        experienceBand: z.string(),
        category: z.string(),
        skills: z.array(
          z.object({
            skillId: z.string(),
            importance: z.string(),
            weight: z.number(),
            requiredLevel: z.string(),
            skill: z.object({
              id: z.string(),
              databaseId: z.uuid(),
              name: z.string(),
              description: z.string(),
              related: z.array(z.string()).default([]),
              estimatedHours: z.number(),
              resources: z.array(resource),
            }),
          }),
        ),
      }),
      roadmap: z.object({
        durationWeeks: z.object({
          beginner: z.number(),
          intermediate: z.number(),
          advanced: z.number(),
        }),
        interviewTopics: z.array(z.string()),
        resumeKeywords: z.array(z.string()),
        stages: z.array(
          z.object({
            order: z.number(),
            title: z.string(),
            goal: z.string(),
            skills: z.array(z.string()),
            estimatedWeeks: z.number(),
            milestoneProject: z.string(),
            checkpoint: z.string(),
          }),
        ),
      }),
      relatedRoles: z.array(link),
      careerPath: z.object({ from: z.array(link), to: z.array(link) }),
    })
    .parse((await api.get(`/career-catalog/roles/${encodeURIComponent(id)}`)).data.data);
}
export async function getCareerMatches(interests = '') {
  return recommendationSet.parse(
    (await api.get('/career-catalog/recommendations', { params: { interests } })).data.data,
  );
}
export async function getCareerQuestions() {
  return questionnaireSchema.parse(
    (await api.get('/career-catalog/questionnaire')).data.data.questions,
  );
}
export async function saveCareerAnswers(answers: { questionId: string; optionIds: string[] }[]) {
  return recommendationSet
    .extend({ id: z.uuid(), hoursPerWeek: z.number(), learningStyle: z.string() })
    .parse((await api.post('/career-catalog/onboarding', { answers })).data.data);
}
export async function searchCareerSkills(search: string, category: string) {
  return z
    .array(
      z.object({ id: z.uuid(), name: z.string(), category: z.string(), description: z.string() }),
    )
    .parse(
      (
        await api.get('/career-catalog/skills', {
          params: { search, ...(category ? { category } : {}) },
        })
      ).data.data.skills,
    );
}
