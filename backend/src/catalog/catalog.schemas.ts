import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const resourceSchema = z.object({
  title: z.string().min(2),
  url: z.url().refine((url) => url.startsWith('https://')),
  type: z.enum(['docs', 'course', 'video', 'book', 'practice']),
  free: z.boolean(),
});
export const catalogSkillSchema = z.object({
  id,
  databaseId: z.uuid(),
  name: z.string().min(1).max(100),
  aliases: z.array(z.string()),
  category: id,
  domains: z.array(id).min(1),
  type: z.enum(['technical', 'tool', 'concept', 'soft', 'certification', 'domain-knowledge']),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  prerequisites: z.array(id),
  related: z.array(id),
  estimatedHours: z.number().positive().max(100),
  demand: z.enum(['high', 'medium', 'low']),
  trending: z.boolean(),
  description: z.string().min(20),
  resources: z.array(resourceSchema).min(1).max(5),
});
export const catalogRoleSchema = z.object({
  id,
  databaseId: z.uuid(),
  name: z.string().min(2).max(150),
  category: id,
  family: id,
  description: z.string().min(20),
  experienceBand: z.enum(['entry', 'mid', 'senior']),
  trending: z.boolean(),
  demand: z.enum(['high', 'medium', 'low']),
  keywords: z.array(z.string()),
  aliases: z.array(z.string()),
  skills: z
    .array(
      z.object({
        skillId: id,
        importance: z.enum(['core', 'important', 'nice-to-have']),
        requiredLevel: z.enum(['beginner', 'intermediate', 'advanced']),
        weight: z.number().positive(),
      }),
    )
    .min(6)
    .max(15),
  relatedRoles: z.array(id),
  careerPath: z.object({ from: z.array(id), to: z.array(id) }),
  project: z.string().min(20),
  checkpoint: z.string().min(20),
});
export const stageSchema = z.object({
  order: z.number().int().positive(),
  title: z.string(),
  goal: z.string(),
  skills: z.array(id),
  estimatedWeeks: z.number().nonnegative(),
  milestoneProject: z.string(),
  checkpoint: z.string(),
});
export const catalogRoadmapSchema = z.object({
  roleId: id,
  stages: z.array(stageSchema).min(5),
  durationWeeks: z.object({ beginner: z.number(), intermediate: z.number(), advanced: z.number() }),
  interviewTopics: z.array(z.string()).min(3),
  resumeKeywords: z.array(z.string()).min(3),
});
export type CatalogSkill = z.infer<typeof catalogSkillSchema>;
export type CatalogRole = z.infer<typeof catalogRoleSchema>;
export type CatalogRoadmap = z.infer<typeof catalogRoadmapSchema>;
