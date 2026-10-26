import type { LogInput, ProjectInput, TaskInput } from './progress.schemas.js';
export interface ProgressTopic {
  id: string;
  title: string;
  skillId: string | null;
  skillName: string | null;
  estimatedHours: number;
  status: string;
  isProject: boolean;
  submitted: boolean;
}
export interface ProgressTask {
  id: string;
  topicId: string;
  title: string;
  allocatedHours: number;
  status: string;
  isProject: boolean;
}
export interface ProgressWeek {
  startDate: string;
  plannedHours: number;
  focusSummary: string;
  items: ProgressTask[];
}
export interface ProgressSnapshot {
  roadmap: {
    id: string;
    title: string;
    status: string;
    phases: { id: string; title: string; topics: ProgressTopic[] }[];
  } | null;
  plan: { id: string; weeks: ProgressWeek[] } | null;
  days: { date: string; minutes: number }[];
}
export interface PublicLog {
  id: string;
  requestId: string;
  topicId: string | null;
  topicTitle: string | null;
  minutes: number;
  note: string;
  loggedAt: string;
}
export interface PublicProject {
  id: string;
  topicId: string;
  title: string;
  repoUrl: string | null;
  notes: string | null;
  submittedAt: string;
}
export interface ProgressRepository {
  snapshot(userId: string, roadmapId: string | undefined, now: Date): Promise<ProgressSnapshot>;
  updateTask(userId: string, id: string, input: TaskInput): Promise<{ id: string; status: string }>;
  addLog(userId: string, input: LogInput): Promise<PublicLog>;
  logs(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ logs: PublicLog[]; nextCursor: string | null }>;
  submitProject(userId: string, input: ProjectInput): Promise<PublicProject>;
  projects(userId: string, roadmapId: string): Promise<PublicProject[]>;
}
