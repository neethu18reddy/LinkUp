export interface Notice {
  id: string;
  type: 'WEEKLY_REMINDER' | 'BEHIND_SCHEDULE' | 'MILESTONE' | 'CERTIFICATE_READY';
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}
export interface NoticePage {
  notifications: Notice[];
  unreadCount: number;
  nextCursor: string | null;
}
export interface JobResult {
  processed: number;
  created: number;
  nextCursor: string | null;
}
export interface NotificationRepository {
  list(userId: string, cursor?: string): Promise<NoticePage>;
  read(userId: string, id: string, now: Date): Promise<void>;
  preferences(userId: string): Promise<{ remindersEnabled: boolean }>;
  setPreferences(userId: string, enabled: boolean): Promise<{ remindersEnabled: boolean }>;
  weekly(now: Date, cursor?: string): Promise<JobResult>;
}
