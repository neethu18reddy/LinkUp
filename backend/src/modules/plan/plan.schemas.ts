import { z } from 'zod';

export const planSettingsSchema = z
  .strictObject({
    roadmapId: z.uuid(),
    hoursPerWeek: z.number().min(0.5).max(60).multipleOf(0.5),
    flexibilityMode: z.enum(['RELAXED', 'STANDARD', 'INTENSIVE', 'DEADLINE']),
    startDate: z.iso.date(),
    targetEndDate: z.iso.date().nullable().default(null),
    expectedPlanId: z.uuid().nullable(),
  })
  .superRefine((input, ctx) => {
    if (input.flexibilityMode === 'DEADLINE' && !input.targetEndDate)
      ctx.addIssue({ code: 'custom', path: ['targetEndDate'], message: 'Choose a deadline.' });
    if (input.targetEndDate && input.targetEndDate < input.startDate)
      ctx.addIssue({
        code: 'custom',
        path: ['targetEndDate'],
        message: 'Deadline must be on or after the start date.',
      });
  });
export const savePlanSchema = planSettingsSchema.safeExtend({
  previewToken: z.string().regex(/^[a-f0-9]{64}$/),
});
export type PlanSettings = z.infer<typeof planSettingsSchema>;
export type SavePlan = z.infer<typeof savePlanSchema>;
