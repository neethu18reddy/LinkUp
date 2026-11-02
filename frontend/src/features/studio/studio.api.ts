import { z } from 'zod';
import { api } from '@/lib/api';
export const skillProgressSchema = z.object({
  progress: z.array(
    z.object({
      skillId: z.string(),
      status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'SKIPPED']),
      percent: z.number(),
      source: z.string(),
      manualComplete: z.boolean(),
      beforeTracking: z.boolean(),
      skill: z.object({ name: z.string() }).optional(),
    }),
  ),
  links: z.array(
    z.object({
      skillId: z.string(),
      resourceId: z.string(),
      title: z.string(),
      sectionTitle: z.string(),
      total: z.number(),
      done: z.number(),
      itemId: z.string().optional(),
    }),
  ),
});
export const studioKeys = {
  progress: ['studio-skills'] as const,
  resources: ['studio-resources'] as const,
  overview: ['studio-overview'] as const,
  settings: ['studio-settings'] as const,
};
export async function getSkillProgress() {
  return skillProgressSchema.parse((await api.get('/studio/skills')).data.data);
}

const itemProgress = z.object({
  status: z.string(),
  watchedSec: z.number(),
  contentWatchedSec: z.number(),
  lastPositionSec: z.number(),
  completedBy: z.string().nullable().optional(),
});
export const studioItemSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  title: z.string(),
  externalVideoId: z.string().nullable(),
  durationSec: z.number(),
  thumbnailUrl: z.string().nullable(),
  url: z.string().nullable(),
  available: z.boolean(),
  progress: itemProgress.nullable(),
});
export const sectionInputSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  topicSummary: z.string(),
  topicTags: z.array(z.string()),
  skills: z.array(z.object({ skillId: z.string(), confidence: z.number() })),
  itemKeys: z.array(z.string()),
});
export type SectionDraft = z.infer<typeof sectionInputSchema>;
const resourceSummary = z.object({
  id: z.string(),
  title: z.string(),
  provider: z.string(),
  channel: z.string(),
  totalDurationSec: z.number(),
  total: z.number(),
  done: z.number(),
});
export const studioResourceSchema = resourceSummary.extend({
  targetRoleId: z.string().nullable().optional(),
  version: z.number(),
  percent: z.number(),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      topicSummary: z.string(),
      topicTags: z.array(z.string()),
      skills: z.array(
        z.object({
          skillId: z.string(),
          confidence: z.number(),
          skill: z.object({ name: z.string() }),
        }),
      ),
      items: z.array(studioItemSchema),
    }),
  ),
});
export type StudioResource = z.infer<typeof studioResourceSchema>;
export type StudioItem = z.infer<typeof studioItemSchema>;
export const previewSchema = z.object({
  title: z.string(),
  channel: z.string(),
  provider: z.string(),
  previewToken: z.string(),
  notice: z.string().optional(),
  youtubeConfigured: z.boolean(),
  items: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      durationSec: z.number(),
      available: z.boolean(),
    }),
  ),
  sections: z.array(sectionInputSchema),
  skillNames: z.record(z.string(), z.string()),
});
export type ImportPreview = z.infer<typeof previewSchema>;
export const settingsSchema = z.object({
  timezone: z.string(),
  timezoneConfirmed: z.boolean(),
  dailyGoalType: z.enum(['minutes', 'videos']),
  dailyGoalValue: z.number(),
  autoplayNext: z.boolean(),
  emojiRecap: z.boolean(),
  confirmSkillCompletion: z.boolean(),
  completionThreshold: z.number(),
});
export type StudioSettings = z.infer<typeof settingsSchema>;
export const noteSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  itemId: z.string().nullable(),
  timestampSec: z.number(),
  bodyMd: z.string(),
  type: z.enum(['Key idea', 'Question', 'Todo', 'Definition', 'Warning']),
  pinned: z.boolean(),
  tags: z.array(z.string()),
  version: z.number(),
  updatedAt: z.string().optional(),
});
export type StudioNote = z.infer<typeof noteSchema>;
export const snippetSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  itemId: z.string().nullable(),
  timestampSec: z.number(),
  title: z.string(),
  language: z.enum(['javascript', 'typescript', 'html', 'css', 'python', 'java', 'c', 'cpp', 'go']),
  code: z.string(),
  version: z.number(),
  updatedAt: z.string().optional(),
});
export type StudioSnippet = z.infer<typeof snippetSchema>;
export const analyticsSchema = z.object({
  nextRolloverAt: z.string().optional(),
  today: z.string(),
  timezone: z.string(),
  daily: z.array(
    z.object({
      date: z.string(),
      secondsWatched: z.number(),
      videosCompleted: z.number(),
      notes: z.number(),
      snippets: z.number(),
      runs: z.number(),
      legacyMinutes: z.number(),
    }),
  ),
  streak: z.object({ current: z.number(), longest: z.number() }),
  totalItems: z.number(),
  completedItems: z.number(),
  percent: z.number(),
  watchedSec: z.number(),
  durationSec: z.number(),
  eta: z.string().nullable(),
  averageSessionMinutes: z.number(),
  bestHour: z.string().nullable(),
  bestWeekday: z.string().nullable(),
  notes: z.number(),
  snippets: z.number(),
  runs: z.number(),
  topicTags: z.array(z.string()),
  activeResources: z.number(),
  goal: z.object({ type: z.string(), target: z.number(), actual: z.number(), pace: z.string() }),
  resume: z
    .object({
      resourceId: z.string(),
      itemId: z.string(),
      title: z.string(),
      positionSec: z.number(),
    })
    .nullable(),
  skills: z.array(
    z.object({
      skillId: z.string(),
      name: z.string(),
      percent: z.number(),
      status: z.string(),
      beforeTracking: z.boolean(),
    }),
  ),
  legacy: z.object({ minutes: z.number(), notice: z.string() }),
  history: z
    .array(
      z.object({
        skillId: z.string(),
        name: z.string(),
        status: z.string(),
        occurredAt: z.string().nullable(),
        beforeTracking: z.boolean(),
      }),
    )
    .default([]),
  sections: z.array(
    z.object({ id: z.string(), title: z.string(), done: z.number(), total: z.number() }),
  ),
});
export type StudioAnalytics = z.infer<typeof analyticsSchema>;
export async function getResources(page = 1) {
  return z
    .object({ resources: z.array(resourceSummary), total: z.number(), page: z.number() })
    .parse((await api.get('/resources', { params: { page } })).data.data);
}
export async function getResource(id: string) {
  return studioResourceSchema.parse((await api.get(`/resources/${id}`)).data.data);
}
export async function getSettings() {
  return settingsSchema.parse((await api.get('/studio/settings')).data.data);
}
export async function saveSettings(input: StudioSettings) {
  const body = settingsSchema.omit({ timezoneConfirmed: true }).parse(input);
  return settingsSchema.parse((await api.patch('/studio/settings', body)).data.data);
}
export async function getAnalytics(resourceId?: string, days = 30) {
  return analyticsSchema.parse(
    (
      await api.get(resourceId ? `/analytics/resource/${resourceId}` : '/analytics/overview', {
        params: { days },
      })
    ).data.data,
  );
}
export function duration(seconds: number) {
  return seconds
    ? `${Math.floor(seconds / 3600) ? `${Math.floor(seconds / 3600)}h ` : ''}${Math.ceil((seconds % 3600) / 60)}m`
    : 'Time not provided';
}
export function timestamp(seconds: number) {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
export function downloadFile(filename: string, body: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
