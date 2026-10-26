import { z } from 'zod';
import { api } from '@/lib/api';
const gap = z.object({
  skillId: z.uuid(),
  name: z.string(),
  currentLevel: z.string().nullable(),
  requiredLevel: z.string(),
  weight: z.number(),
  score: z.number(),
});
const roadmap = z.object({
  id: z.uuid(),
  goalId: z.uuid(),
  title: z.string(),
  version: z.number(),
  generationSource: z.string(),
  totalEstimatedHours: z.number(),
  phases: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      description: z.string(),
      topics: z.array(
        z.object({
          id: z.uuid(),
          title: z.string(),
          subtopics: z.array(z.string()),
          estimatedHours: z.number(),
          difficulty: z.string(),
          isProject: z.boolean(),
          resources: z.array(z.object({ title: z.string(), url: z.url() })),
        }),
      ),
    }),
  ),
});
export const currentRoadmapSchema = z.object({
  goalId: z.uuid(),
  analysis: z.object({ gaps: z.array(gap), strengths: z.array(gap) }),
  roadmap: roadmap.nullable(),
  provider: z.string(),
});
export const roadmapKey = ['current-roadmap'] as const;
export async function getCurrentRoadmap() {
  return currentRoadmapSchema.parse((await api.get('/roadmaps/current')).data.data);
}
export async function generateRoadmap(goalId: string) {
  return z
    .object({ roadmap, notice: z.string().nullable() })
    .parse((await api.post('/roadmaps/generate', { goalId })).data.data);
}
