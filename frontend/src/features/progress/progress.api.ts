import { z } from 'zod';
import { api } from '@/lib/api';
const task = z.object({
  id: z.uuid(),
  topicId: z.uuid(),
  title: z.string(),
  allocatedHours: z.number(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'SKIPPED']),
  isProject: z.boolean(),
});
export const progressSchema = z.object({
  roadmap: z.object({ id: z.uuid(), title: z.string(), status: z.string() }).nullable(),
  overallPercent: z.number(),
  totalHours: z.number(),
  completedHours: z.number(),
  completedTopics: z.number(),
  totalTopics: z.number(),
  streak: z.number(),
  daily: z.array(z.object({ date: z.iso.date(), minutes: z.number() })),
  loggedMinutesLast7Days: z.number(),
  skills: z.array(z.object({ skillId: z.uuid(), name: z.string(), percent: z.number() })),
  currentWeek: z
    .object({
      startDate: z.iso.date(),
      plannedHours: z.number(),
      loggedMinutes: z.number(),
      tasks: z.array(task),
    })
    .nullable(),
  overdueHours: z.number(),
  behindSchedule: z.boolean(),
  nextMilestone: z
    .object({ id: z.uuid(), title: z.string(), remainingTopics: z.number() })
    .nullable(),
  topics: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      isProject: z.boolean(),
      status: z.string(),
      submitted: z.boolean(),
    }),
  ),
  projectsRequired: z.number(),
  projectsSubmitted: z.number(),
});
const log = z.object({
  id: z.uuid(),
  requestId: z.uuid(),
  topicId: z.uuid().nullable(),
  topicTitle: z.string().nullable(),
  minutes: z.number(),
  note: z.string(),
  loggedAt: z.iso.datetime(),
});
const project = z.object({
  id: z.uuid(),
  topicId: z.uuid(),
  title: z.string(),
  repoUrl: z.string().nullable(),
  notes: z.string().nullable(),
  submittedAt: z.iso.datetime(),
});
export type ProgressSummary = z.infer<typeof progressSchema>;
export type TaskStatus = z.infer<typeof task>['status'];
export const progressKey = ['progress-summary'] as const;
export async function getProgress() {
  return progressSchema.parse((await api.get('/progress/summary')).data.data);
}
export async function updateTask(input: {
  id: string;
  status: TaskStatus;
  expectedStatus: TaskStatus;
}) {
  const { id, ...body } = input;
  return (await api.patch(`/plan-items/${id}`, body)).data.data;
}
export async function addLog(input: {
  requestId: string;
  topicId: string | null;
  minutes: number;
  note: string;
  loggedOn: string;
}) {
  return log.parse((await api.post('/logs', input)).data.data.log);
}
export async function getLogs(cursor?: string) {
  return z
    .object({ logs: z.array(log), nextCursor: z.uuid().nullable() })
    .parse(
      (await api.get('/logs', { params: { limit: 20, ...(cursor ? { cursor } : {}) } })).data.data,
    );
}
export async function submitProject(input: {
  topicId: string;
  title: string;
  repoUrl: string | null;
  notes: string;
}) {
  return project.parse((await api.post('/projects', input)).data.data.project);
}
export async function getProjects(roadmapId: string) {
  return z
    .array(project)
    .parse((await api.get('/projects', { params: { roadmapId } })).data.data.projects);
}
