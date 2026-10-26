export function utcWeek(now: Date) {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
export interface ReminderWeek {
  startDate: string;
  items: { status: string; topicDone: boolean; allocatedHours: number }[];
}
export function reminderContent(weeks: ReminderWeek[], now: Date) {
  const today = now.toISOString().slice(0, 10);
  const unfinished = weeks.flatMap((week) =>
    week.items
      .filter((item) => item.status !== 'DONE' && !item.topicDone)
      .map((item) => ({ ...item, startDate: week.startDate })),
  );
  if (!unfinished.length || !unfinished.some((item) => item.startDate <= today)) return [];
  const overdue = unfinished.filter(
    (item) => Date.parse(item.startDate) + 7 * 86400000 <= Date.parse(today),
  );
  const content = [
    {
      type: 'WEEKLY_REMINDER' as const,
      title: 'Your weekly learning check-in',
      message:
        'Review your weekly plan, choose your next task and record what you learn. Small steps count.',
    },
  ];
  return overdue.length
    ? [
        ...content,
        {
          type: 'BEHIND_SCHEDULE' as const,
          title: 'Your plan has unfinished work',
          message: `${Math.round(overdue.reduce((sum, item) => sum + item.allocatedHours, 0) * 100) / 100} planned hours from earlier weeks remain unfinished. Review your plan or replan around the time you have.`,
        },
      ]
    : content;
}
