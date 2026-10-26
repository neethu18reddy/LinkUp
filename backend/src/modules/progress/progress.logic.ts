import type { ProgressSnapshot } from './progress.types.js';
const shift = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
const round = (value: number) => Math.round(value * 100) / 100;
const percent = (completed: number, total: number) =>
  total ? (completed >= total ? 100 : Math.min(99.99, round((completed / total) * 100))) : 0;
export function learningStreak(days: string[], today: string) {
  const dates = new Set(days);
  let date = dates.has(today) ? today : shift(today, -1),
    streak = 0;
  while (dates.has(date)) {
    streak++;
    date = shift(date, -1);
  }
  return streak;
}
export function summarizeProgress(snapshot: ProgressSnapshot, today: string) {
  const topics = snapshot.roadmap?.phases.flatMap((phase) => phase.topics) ?? [];
  const allocations = snapshot.plan?.weeks.flatMap((week) => week.items) ?? [];
  const earned = (topic: (typeof topics)[number]) =>
    topic.status === 'DONE'
      ? topic.estimatedHours
      : Math.min(
          topic.estimatedHours,
          allocations
            .filter((item) => item.topicId === topic.id && item.status === 'DONE')
            .reduce((sum, item) => sum + item.allocatedHours, 0),
        );
  const total = topics.reduce((sum, topic) => sum + topic.estimatedHours, 0);
  const completed = topics.reduce((sum, topic) => sum + earned(topic), 0);
  const skills = new Map<string, { name: string; totalHours: number; completedHours: number }>();
  for (const topic of topics)
    if (topic.skillId) {
      const skill = skills.get(topic.skillId) ?? {
        name: topic.skillName ?? topic.title,
        totalHours: 0,
        completedHours: 0,
      };
      skill.totalHours += topic.estimatedHours;
      skill.completedHours += earned(topic);
      skills.set(topic.skillId, skill);
    }
  const week =
    snapshot.plan?.weeks.find(
      (week) =>
        week.focusSummary !== 'Completed work (preserved)' &&
        week.startDate <= today &&
        shift(week.startDate, 6) >= today,
    ) ?? null;
  const overdueHours = round(
    (snapshot.plan?.weeks ?? [])
      .filter((week) => shift(week.startDate, 6) < today)
      .flatMap((week) => week.items)
      .filter((item) => item.status !== 'DONE')
      .reduce((sum, item) => sum + item.allocatedHours, 0),
  );
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = shift(today, index - 6);
    return { date, minutes: snapshot.days.find((day) => day.date === date)?.minutes ?? 0 };
  });
  const milestone = snapshot.roadmap?.phases.find((phase) =>
    phase.topics.some((topic) => topic.status !== 'DONE'),
  );
  return {
    roadmap: snapshot.roadmap
      ? { id: snapshot.roadmap.id, title: snapshot.roadmap.title, status: snapshot.roadmap.status }
      : null,
    overallPercent: percent(completed, total),
    totalHours: round(total),
    completedHours: round(completed),
    completedTopics: topics.filter((topic) => topic.status === 'DONE').length,
    totalTopics: topics.length,
    streak: learningStreak(
      snapshot.days.map((day) => day.date),
      today,
    ),
    daily,
    loggedMinutesLast7Days: daily.reduce((sum, day) => sum + day.minutes, 0),
    skills: [...skills.entries()].map(([skillId, skill]) => ({
      skillId,
      name: skill.name,
      percent: percent(skill.completedHours, skill.totalHours),
    })),
    currentWeek: week
      ? {
          startDate: week.startDate,
          plannedHours: week.plannedHours,
          loggedMinutes: snapshot.days
            .filter((day) => day.date >= week.startDate && day.date <= shift(week.startDate, 6))
            .reduce((sum, day) => sum + day.minutes, 0),
          tasks: week.items,
        }
      : null,
    overdueHours,
    behindSchedule: overdueHours > 0,
    nextMilestone: milestone
      ? {
          id: milestone.id,
          title: milestone.title,
          remainingTopics: milestone.topics.filter((topic) => topic.status !== 'DONE').length,
        }
      : null,
    topics: topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      isProject: topic.isProject,
      status: topic.status,
      submitted: topic.submitted,
    })),
    projectsRequired: topics.filter((topic) => topic.isProject).length,
    projectsSubmitted: topics.filter((topic) => topic.isProject && topic.submitted).length,
  };
}
