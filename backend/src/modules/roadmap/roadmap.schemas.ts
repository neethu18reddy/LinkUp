import { z } from 'zod';

export const levelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
const text = z.string().trim().min(1).max(200);
export const roadmapDraftSchema = z
  .strictObject({
    title: text,
    phases: z
      .array(
        z.strictObject({
          title: text,
          description: z.string().trim().min(1).max(1000),
          topics: z
            .array(
              z.strictObject({
                title: text,
                skillId: z.uuid().nullable(),
                subtopics: z.array(text).min(1).max(12),
                estimatedHours: z.number().min(0.5).max(100).multipleOf(0.5),
                difficulty: levelSchema,
                resources: z
                  .array(
                    z.strictObject({
                      title: text,
                      url: z
                        .url()
                        .refine((value) => value.startsWith('https://'), 'Use HTTPS resources.'),
                    }),
                  )
                  .max(5),
                isProject: z.boolean(),
              }),
            )
            .min(1)
            .max(15),
        }),
      )
      .min(1)
      .max(8),
  })
  .refine(
    (value) => value.phases.some((phase) => phase.topics.some((topic) => topic.isProject)),
    'Include a project.',
  );
export type RoadmapDraft = z.infer<typeof roadmapDraftSchema>;
export const generationSchema = z.strictObject({ goalId: z.uuid() });
