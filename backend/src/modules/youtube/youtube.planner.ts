import { Temporal } from '@js-temporal/polyfill';
import { AppError } from '../../utils/AppError.js';
import type { PlanningPreferences } from './youtube.schemas.js';
export interface PlanningChapter {
  title: string;
  items: { id: string; title: string; durationSec: number; available: boolean }[];
}
export function buildYouTubePlan(chapters: PlanningChapter[], p: PlanningPreferences) {
  const tasks: {
    kind: 'watch' | 'practice' | 'review';
    title: string;
    itemId: string | null;
    seconds: number;
    startSec: number | null;
    endSec: number | null;
    estimated: boolean;
  }[] = [];
  for (const chapter of chapters) {
    const items = chapter.items.filter((i) => i.available);
    if (!items.length) continue;
    for (const item of items) {
      const seconds = item.durationSec || p.estimates[item.id];
      if (!seconds)
        throw new AppError(
          422,
          'DURATION_REQUIRED',
          `Enter an estimated duration for “${item.title.slice(0, 80)}”.`,
        );
      tasks.push({
        kind: 'watch',
        title: item.title,
        itemId: item.id,
        seconds,
        startSec: 0,
        endSec: seconds,
        estimated: !item.durationSec,
      });
    }
    tasks.push({
      kind: 'practice',
      title: `Suggested practice: ${p.level === 'beginner' ? 'explain the key ideas and try one small example' : p.level === 'intermediate' ? 'apply these ideas in a small exercise' : 'build an example and test its edge cases'} — ${chapter.title}`,
      itemId: null,
      seconds: (p.level === 'beginner' ? 10 : p.level === 'intermediate' ? 15 : 20) * 60,
      startSec: null,
      endSec: null,
      estimated: true,
    });
    tasks.push({
      kind: 'review',
      title: `Review ${chapter.title}: recall three ideas and note one question`,
      itemId: null,
      seconds: 300,
      startSec: null,
      endSec: null,
      estimated: true,
    });
  }
  if (!tasks.length)
    throw new AppError(422, 'PLAN_EMPTY', 'This resource has no available learning items.');
  type Task = (typeof tasks)[number];
  const days: { date: string; minutes: number; tasks: Task[] }[] = [];
  let date = Temporal.PlainDate.from(p.startDate),
    available = 0,
    day: (typeof days)[number] | undefined;
  for (const task of tasks) {
    let remaining = task.seconds,
      position = 0;
    while (remaining > 0) {
      if (!available) {
        while (!p.weekdays.includes(date.dayOfWeek)) date = date.add({ days: 1 });
        if (date.year > 9998 || days.length >= 3660)
          throw new AppError(422, 'PLAN_TOO_LONG', 'Choose more study time or a shorter resource.');
        day = { date: date.toString(), minutes: 0, tasks: [] };
        days.push(day);
        available = p.dailyMinutes * 60;
        date = date.add({ days: 1 });
      }
      const seconds = Math.min(available, remaining);
      day!.tasks.push({
        ...task,
        seconds,
        startSec: task.kind === 'watch' ? position : null,
        endSec: task.kind === 'watch' ? position + seconds : null,
      });
      day!.minutes += seconds / 60;
      position += seconds;
      remaining -= seconds;
      available -= seconds;
    }
  }
  const completionDate = days.at(-1)!.date;
  return {
    days,
    completionDate,
    totalMinutes: tasks.reduce((n, t) => n + t.seconds, 0) / 60,
    warning:
      p.targetDate && completionDate > p.targetDate
        ? `This plan finishes on ${completionDate}, after your deadline. Increase your study time or choose a later deadline.`
        : null,
    basis:
      'Study plan based on available titles, durations and your preferences. Practice is suggested by LinkUp; videos and transcripts have not been analyzed.',
  };
}
