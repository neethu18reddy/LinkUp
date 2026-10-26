import { z } from 'zod';

const expectedGoalId = z.uuid().nullable().default(null);
const customTarget = z
  .string()
  .trim()
  .min(2, 'Describe what you want to learn.')
  .max(150)
  .refine(
    (value) =>
      [...value].every(
        (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
      ),
    'Use valid goal text.',
  )
  .transform((value) => value.replace(/\s+/g, ' '));
export const createGoalSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('ROLE'),
    roleId: z.uuid(),
    quizResponseId: z.uuid().optional(),
    expectedGoalId,
  }),
  z.strictObject({ kind: z.literal('CUSTOM'), targetRole: customTarget, expectedGoalId }),
]);
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
