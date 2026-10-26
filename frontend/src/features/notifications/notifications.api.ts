import { z } from 'zod';
import { api } from '@/lib/api';
const noticeSchema = z.object({
  id: z.uuid(),
  type: z.enum(['WEEKLY_REMINDER', 'BEHIND_SCHEDULE', 'MILESTONE', 'CERTIFICATE_READY']),
  title: z.string(),
  message: z.string(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});
const pageSchema = z.object({
  notifications: z.array(noticeSchema),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.uuid().nullable(),
});
const preferenceSchema = z.object({ remindersEnabled: z.boolean() });
export type Notice = z.infer<typeof noticeSchema>;
export async function getNotifications(cursor?: string) {
  return pageSchema.parse(
    (await api.get('/notifications', { params: cursor ? { cursor } : {} })).data.data,
  );
}
export async function markNotificationRead(id: string) {
  await api.patch(`/notifications/${id}/read`, {});
}
export async function getNotificationPreferences() {
  return preferenceSchema.parse((await api.get('/notifications/preferences')).data.data);
}
export async function setNotificationPreferences(remindersEnabled: boolean) {
  return preferenceSchema.parse(
    (await api.patch('/notifications/preferences', { remindersEnabled })).data.data,
  );
}
