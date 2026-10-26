import { z } from 'zod';
import { api } from '@/lib/api';
export const modeSchema = z.enum(['RELAXED', 'STANDARD', 'INTENSIVE', 'DEADLINE']);
export const planInputSchema = z.object({
  roadmapId: z.uuid(),
  hoursPerWeek: z.number().min(0.5).max(60),
  flexibilityMode: modeSchema,
  startDate: z.iso.date(),
  targetEndDate: z.iso.date().nullable(),
  expectedPlanId: z.uuid().nullable(),
});
const item = z.object({
  topicId: z.uuid(),
  allocatedHours: z.number(),
  status: z.string(),
  completedAt: z.string().nullable(),
});
const week = z.object({
  weekNumber: z.number(),
  startDate: z.iso.date(),
  plannedHours: z.number(),
  focusSummary: z.string(),
  isBuffer: z.boolean(),
  items: z.array(item.extend({ title: z.string().optional(), isProject: z.boolean().optional() })),
});
export const planSchema = planInputSchema.omit({ expectedPlanId: true }).extend({
  id: z.uuid(),
  version: z.number(),
  isActive: z.boolean(),
  projectedEndDate: z.iso.date(),
  weeks: z.array(week),
});
const previewSchema = z.object({
  settings: planInputSchema,
  previewToken: z.string(),
  schedule: z.object({
    projectedEndDate: z.iso.date(),
    effectiveHoursPerWeek: z.number(),
    remainingHours: z.number(),
    warnings: z.array(z.string()),
    weeks: z.array(week),
  }),
});
export type PlanInput = z.infer<typeof planInputSchema>;
export type Plan = z.infer<typeof planSchema>;
export type PlanPreview = z.infer<typeof previewSchema>;
export const planKey = (roadmapId: string) => ['plan', roadmapId] as const;
export async function getCurrentPlan(roadmapId: string) {
  return z
    .object({ plan: planSchema.nullable() })
    .parse((await api.get('/plans/current', { params: { roadmapId } })).data.data).plan;
}
export async function previewPlan(input: PlanInput) {
  return previewSchema.parse((await api.post('/plans/preview', input)).data.data.preview);
}
export async function savePlan(preview: PlanPreview) {
  const input = { ...preview.settings, previewToken: preview.previewToken };
  const response = preview.settings.expectedPlanId
    ? await api.post(`/plans/${preview.settings.expectedPlanId}/replan`, input)
    : await api.post('/plans', input);
  return planSchema.parse(response.data.data.plan);
}
