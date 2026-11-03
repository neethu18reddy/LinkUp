import { z } from 'zod';
import { api } from '@/lib/api';
export const languageSchema = z.enum(['en', 'hi', 'both']);
export type VideoLanguage = z.infer<typeof languageSchema>;
export const levelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
export const planningSchema = z.object({
  goal: z.string().min(2).max(200),
  level: levelSchema,
  language: languageSchema,
  timezone: z.string(),
  dailyMinutes: z.number().int().min(10).max(240),
  weekdays: z.array(z.number().min(1).max(7)).min(1),
  startDate: z.string(),
  targetDate: z.string().nullable(),
  estimates: z.record(z.string(), z.number()),
});
export type PlanningPreferences = z.infer<typeof planningSchema>;
const taskSchema = z.object({
  kind: z.enum(['watch', 'practice', 'review']),
  title: z.string(),
  itemId: z.string().nullable(),
  seconds: z.number(),
  startSec: z.number().nullable(),
  endSec: z.number().nullable(),
  estimated: z.boolean(),
});
export const scheduleSchema = z.object({
  days: z.array(z.object({ date: z.string(), minutes: z.number(), tasks: z.array(taskSchema) })),
  completionDate: z.string(),
  totalMinutes: z.number(),
  warning: z.string().nullable(),
  basis: z.string(),
});
export type StudySchedule = z.infer<typeof scheduleSchema>;
export const planSchema = z.object({
  resourceId: z.string(),
  version: z.number(),
  goal: z.string(),
  preferences: planningSchema,
  schedule: scheduleSchema,
  stale: z.boolean(),
});
export const recommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  channel: z.string(),
  url: z.string(),
  thumbnailUrl: z.string().nullable(),
  publishedAt: z.string(),
  durationSec: z.number(),
  views: z.string().nullable(),
  likes: z.string().nullable(),
  comments: z.string().nullable(),
  language: z.string().nullable(),
  languageVerified: z.boolean(),
});
export type RecommendedVideo = z.infer<typeof recommendationSchema>;
export const youtubeKeys = {
  preferences: ['youtube-preferences'] as const,
  plans: ['youtube-plans'] as const,
};
export async function getYouTubePreference() {
  return z
    .object({ language: languageSchema })
    .nullable()
    .parse((await api.get('/youtube/preferences')).data.data);
}
export async function findVideos(input: {
  topic: string;
  language: VideoLanguage;
  level: z.infer<typeof levelSchema>;
  order: 'relevance' | 'viewCount' | 'rating';
}) {
  return z
    .object({ videos: z.array(recommendationSchema), cached: z.boolean(), fetchedAt: z.string() })
    .parse((await api.get('/youtube/recommendations', { params: input })).data.data);
}
export async function getVideoComments(id: string) {
  return z
    .object({
      comments: z.array(
        z.object({
          id: z.string(),
          text: z.string(),
          author: z.string(),
          likes: z.number(),
          url: z.string(),
        }),
      ),
      unavailable: z.boolean(),
      cached: z.boolean(),
    })
    .parse((await api.get(`/youtube/videos/${id}/comments`)).data.data);
}
export async function getStudyPlan(id: string) {
  return planSchema.nullable().parse((await api.get(`/resources/${id}/study-plan`)).data.data);
}
export async function saveStudyPlan(id: string, version: number, preferences: PlanningPreferences) {
  return planSchema.parse(
    (await api.put(`/resources/${id}/study-plan`, { version, preferences })).data.data,
  );
}
