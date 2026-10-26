import { z } from 'zod';
import { api, type ApiResponse } from '@/lib/api';

export const levelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
export type SkillLevel = z.infer<typeof levelSchema>;
export const levelLabels: Record<SkillLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};
const catalogueSkillSchema = z.object({ id: z.uuid(), name: z.string(), category: z.string() });
const profileSkillSchema = z.object({
  skillId: z.uuid(),
  level: levelSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  skill: catalogueSkillSchema,
});
export type CatalogueSkill = z.infer<typeof catalogueSkillSchema>;
export type ProfileSkill = z.infer<typeof profileSkillSchema>;
export const skillKeys = {
  profile: ['my-skills'] as const,
  catalogue: (search: string) => ['skill-catalogue', search] as const,
};

export async function getCatalogue(search = '') {
  const response = await api.get<ApiResponse<{ skills: CatalogueSkill[] }>>('/skills', {
    params: { search },
  });
  return z.object({ skills: z.array(catalogueSkillSchema) }).parse(response.data.data).skills;
}
export async function getProfileSkills() {
  const response = await api.get<ApiResponse<{ skills: ProfileSkill[] }>>('/me/skills');
  return z.object({ skills: z.array(profileSkillSchema) }).parse(response.data.data).skills;
}
export async function addProfileSkill(input: { skillId: string; level: SkillLevel }) {
  const response = await api.post('/me/skills', input);
  return profileSkillSchema.parse(response.data.data.skill);
}
export async function updateProfileSkill(input: { skillId: string; level: SkillLevel }) {
  const response = await api.patch(`/me/skills/${encodeURIComponent(input.skillId)}`, {
    level: input.level,
  });
  return profileSkillSchema.parse(response.data.data.skill);
}
export async function removeProfileSkill(skillId: string) {
  await api.delete(`/me/skills/${encodeURIComponent(skillId)}`);
}
