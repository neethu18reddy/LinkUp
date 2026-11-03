import { z } from 'zod';
import { Temporal } from '@js-temporal/polyfill';
export const languageSchema = z.enum(['en', 'hi', 'both']);
export const levelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
export const discoverySchema = z.strictObject({
  topic: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .refine((v) => [...v].every((character) => character.charCodeAt(0) >= 32)),
  language: languageSchema,
  level: levelSchema.default('beginner'),
  order: z.enum(['relevance', 'viewCount', 'rating']).default('relevance'),
});
const date = z.iso.date().refine((v) => {
  try {
    Temporal.PlainDate.from(v);
    return true;
  } catch {
    return false;
  }
});
export const planningSchema = z
  .strictObject({
    goal: z.string().trim().min(2).max(200),
    level: levelSchema,
    language: languageSchema,
    timezone: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }),
    dailyMinutes: z.number().int().min(10).max(240),
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .max(7)
      .refine((v) => new Set(v).size === v.length),
    startDate: date,
    targetDate: date.nullable().default(null),
    estimates: z
      .record(z.uuid(), z.number().int().min(60).max(86400))
      .refine((v) => Object.keys(v).length <= 2000, 'Use at most 2,000 duration estimates.')
      .default({}),
  })
  .refine((v) => !v.targetDate || v.targetDate >= v.startDate, {
    message: 'Deadline must be on or after the start date.',
    path: ['targetDate'],
  });
export type PlanningPreferences = z.infer<typeof planningSchema>;
