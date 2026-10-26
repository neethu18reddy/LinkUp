import { z } from 'zod';

export const proficiencySchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
export const catalogueQuerySchema = z.strictObject({
  search: z
    .string()
    .trim()
    .max(100)
    .refine(
      (value) =>
        [...value].every(
          (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
        ),
      'Use valid search text.',
    )
    .default(''),
});
export const skillParamsSchema = z.strictObject({ skillId: z.uuid() });
export const addSkillSchema = z.strictObject({ skillId: z.uuid(), level: proficiencySchema });
export const updateSkillSchema = z.strictObject({ level: proficiencySchema });
export const emptyQuerySchema = z.strictObject({});

export function normalizeSkillName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]/g, '');
}
