import { z } from 'zod';
const note = z.string().trim().min(1).max(2000);
export const taskSchema = z.strictObject({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED']),
  expectedStatus: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED']),
});
export const logSchema = z.strictObject({
  requestId: z.uuid(),
  topicId: z.uuid().nullable().default(null),
  minutes: z.number().int().min(1).max(720),
  note,
  loggedOn: z.iso.date(),
});
export const projectSchema = z
  .strictObject({
    topicId: z.uuid(),
    title: z.string().trim().min(1).max(200),
    repoUrl: z
      .url()
      .max(2048)
      .refine((value) => {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password;
      }, 'Use a public HTTPS link without credentials.')
      .nullable()
      .default(null),
    notes: z.string().trim().max(5000).default(''),
  })
  .refine(
    (value) => !!value.repoUrl || value.notes.length >= 10,
    'Add a project link or at least 10 characters of notes.',
  );
export const logQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.uuid().optional(),
});
export type TaskInput = z.infer<typeof taskSchema>;
export type LogInput = z.infer<typeof logSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
