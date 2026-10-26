import type { ProgressSummary } from '@/features/progress/progress.api';
export function progressFixture(): ProgressSummary {
  return {
    roadmap: {
      id: '20000000-0000-4000-8000-000000000001',
      title: 'Frontend learning path',
      status: 'ACTIVE',
    },
    overallPercent: 25,
    totalHours: 20,
    completedHours: 5,
    completedTopics: 0,
    totalTopics: 2,
    streak: 2,
    daily: [{ date: '2026-10-27', minutes: 30 }],
    loggedMinutesLast7Days: 30,
    skills: [{ skillId: '00000000-0000-4000-8000-000000000005', name: 'React', percent: 50 }],
    currentWeek: {
      startDate: '2026-10-26',
      plannedHours: 5,
      loggedMinutes: 30,
      tasks: [
        {
          id: '40000000-0000-4000-8000-000000000001',
          topicId: '50000000-0000-4000-8000-000000000001',
          title: 'React basics',
          allocatedHours: 5,
          status: 'TODO',
          isProject: false,
        },
      ],
    },
    overdueHours: 0,
    behindSchedule: false,
    nextMilestone: {
      id: '60000000-0000-4000-8000-000000000001',
      title: 'Foundations',
      remainingTopics: 2,
    },
    topics: [
      {
        id: '50000000-0000-4000-8000-000000000001',
        title: 'React basics',
        isProject: false,
        status: 'IN_PROGRESS',
        submitted: false,
      },
      {
        id: '50000000-0000-4000-8000-000000000002',
        title: 'Build a small app',
        isProject: true,
        status: 'TODO',
        submitted: false,
      },
    ],
    projectsRequired: 1,
    projectsSubmitted: 0,
  };
}
