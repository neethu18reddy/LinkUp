import { z } from 'zod';
export const messageSchema = z
  .strictObject({
    requestId: z.uuid(),
    sessionId: z.uuid().nullable(),
    expectedVersion: z.number().int().min(0).max(1000000),
    message: z.string().trim().min(1).max(1000),
  })
  .refine(
    (value) => value.sessionId !== null || value.expectedVersion === 0,
    'New conversations must start at version zero.',
  );
export const historySchema = z.strictObject({
  sessionId: z.uuid(),
  before: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(40),
});
export const deleteHistorySchema = z.strictObject({ sessionId: z.uuid().optional() });
export type MessageInput = z.infer<typeof messageSchema>;
