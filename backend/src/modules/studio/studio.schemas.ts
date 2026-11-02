import { z } from 'zod';
const safeUrl = z
  .url()
  .max(2048)
  .refine((value) => ['https:', 'http:'].includes(new URL(value).protocol), 'Use an HTTP(S) link.');
export const importSchema = z.strictObject({
  provider: z.enum(['youtube', 'custom']),
  input: z.string().trim().max(150000).default(''),
  title: z.string().trim().min(1).max(200).default('My learning resource'),
  items: z
    .array(
      z.strictObject({
        title: z.string().trim().min(1).max(200),
        url: safeUrl.optional(),
        durationSec: z.number().int().min(0).max(86400).default(0),
      }),
    )
    .max(500)
    .default([]),
});
export const previewItemSchema = z.object({
  key: z.uuid(),
  externalVideoId: z.string().nullable(),
  title: z.string(),
  url: z.string().nullable(),
  durationSec: z.number(),
  thumbnailUrl: z.string().nullable(),
  available: z.boolean(),
});
export const sectionSchema = z.strictObject({
  id: z.uuid().optional(),
  title: z.string().trim().min(1).max(200),
  topicSummary: z.string().trim().max(500).default(''),
  topicTags: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
  skills: z
    .array(z.strictObject({ skillId: z.uuid(), confidence: z.number().min(0).max(1).default(1) }))
    .max(8)
    .default([]),
  itemKeys: z.array(z.uuid()).min(1).max(2000),
});
export const saveResourceSchema = z.strictObject({
  previewToken: z.string().min(1).max(1500000),
  title: z.string().trim().min(1).max(200),
  targetRoleId: z.uuid().nullable().optional(),
  sections: z.array(sectionSchema).min(1).max(500),
});
export const editSectionsSchema = z.strictObject({
  version: z.number().int().positive(),
  sections: z.array(sectionSchema).min(1).max(500),
});
export const settingsSchema = z.strictObject({
  timezone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
  dailyGoalType: z.enum(['minutes', 'videos']),
  dailyGoalValue: z.number().int().min(1).max(600),
  autoplayNext: z.boolean(),
  emojiRecap: z.boolean(),
  confirmSkillCompletion: z.boolean(),
  completionThreshold: z.number().min(0.5).max(1),
});
export const heartbeatSchema = z.strictObject({
  sessionId: z.uuid(),
  requestId: z.uuid(),
  itemId: z.uuid(),
  wallSec: z.number().finite().min(0).max(1000000),
  contentSec: z.number().finite().min(0).max(3000000),
  positionSec: z.number().finite().min(0).max(604800),
  ended: z.boolean().default(false),
  release: z.boolean().default(false),
});
export const noteSchema = z.strictObject({
  id: z.uuid().optional(),
  resourceId: z.uuid(),
  itemId: z.uuid().nullable().default(null),
  timestampSec: z.number().min(0).max(604800).default(0),
  bodyMd: z.string().max(20000),
  type: z.enum(['Key idea', 'Question', 'Todo', 'Definition', 'Warning']).default('Key idea'),
  pinned: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  version: z.number().int().positive().optional(),
});
export const snippetSchema = z.strictObject({
  id: z.uuid().optional(),
  resourceId: z.uuid(),
  itemId: z.uuid().nullable().default(null),
  title: z.string().trim().min(1).max(200),
  language: z.enum(['javascript', 'typescript', 'html', 'css', 'python', 'java', 'c', 'cpp', 'go']),
  code: z.string().max(50000),
  timestampSec: z.number().min(0).max(604800).default(0),
  version: z.number().int().positive().optional(),
});
export type PreviewItem = z.infer<typeof previewItemSchema>;
export type StudioSectionInput = z.infer<typeof sectionSchema>;
