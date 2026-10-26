import { AppError } from '../../utils/AppError.js';
import type { PlanSettings } from './plan.schemas.js';

export interface ScheduleTopic {
  id: string;
  title: string;
  estimatedHours: number;
  status: string;
}
export interface ScheduledItem {
  topicId: string;
  allocatedHours: number;
  status: 'TODO' | 'DONE';
  completedAt: string | null;
}
export interface ScheduledWeek {
  weekNumber: number;
  startDate: string;
  plannedHours: number;
  focusSummary: string;
  isBuffer: boolean;
  items: ScheduledItem[];
}
export interface CompletedAllocation {
  topicId: string;
  allocatedHours: number;
  completedAt: string | null;
  startDate: string;
}
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export function schedulePlan(
  settings: PlanSettings,
  topics: ScheduleTopic[],
  completed: CompletedAllocation[] = [],
) {
  const done = new Map<string, number>();
  const weeks: ScheduledWeek[] = [];
  // Preserve completed allocations from the active version; inactive history is never summed twice.
  const history = new Map<string, ScheduledItem[]>();
  for (const item of completed) {
    if (!topics.some((topic) => topic.id === item.topicId)) continue;
    done.set(item.topicId, (done.get(item.topicId) ?? 0) + Math.round(item.allocatedHours * 100));
    const entries = history.get(item.startDate) ?? [];
    const existing = entries.find((entry) => entry.topicId === item.topicId);
    if (existing) existing.allocatedHours += item.allocatedHours;
    else
      entries.push({
        topicId: item.topicId,
        allocatedHours: item.allocatedHours,
        status: 'DONE',
        completedAt: item.completedAt,
      });
    history.set(item.startDate, entries);
  }
  for (const [date, items] of [...history].sort(([a], [b]) => a.localeCompare(b)))
    weeks.push({
      weekNumber: weeks.length + 1,
      startDate: date,
      plannedHours: items.reduce((sum, item) => sum + item.allocatedHours, 0),
      focusSummary: 'Completed work (preserved)',
      isBuffer: false,
      items,
    });
  const remaining = topics.map((topic) => ({
    topic,
    units:
      topic.status === 'DONE'
        ? 0
        : Math.max(0, Math.round(topic.estimatedHours * 100) - (done.get(topic.id) ?? 0)),
  }));
  const totalUnits = remaining.reduce((sum, row) => sum + row.units, 0);
  let capacity = Math.round(
    settings.hoursPerWeek *
      100 *
      (settings.flexibilityMode === 'RELAXED'
        ? 0.8
        : settings.flexibilityMode === 'INTENSIVE'
          ? 1.2
          : 1),
  );
  const warnings: string[] = [];
  if (settings.flexibilityMode === 'DEADLINE') {
    if (!settings.targetEndDate || settings.targetEndDate < settings.startDate)
      throw new AppError(422, 'INVALID_DEADLINE', 'Choose a deadline on or after the start date.');
    const availableDays =
      Math.round((Date.parse(settings.targetEndDate) - Date.parse(settings.startDate)) / 86400000) +
      1;
    capacity = Math.max(1, Math.ceil((totalUnits * 7) / availableDays));
    if (capacity > 168 * 100)
      throw new AppError(
        422,
        'DEADLINE_IMPOSSIBLE',
        'This deadline requires more than 168 hours per week. Choose a later date.',
      );
    if (capacity > settings.hoursPerWeek * 100)
      warnings.push('Meeting this deadline requires more time than your stated weekly hours.');
  }
  if (capacity > 40 * 100)
    warnings.push('More than 40 study hours per week may be difficult to sustain.');
  let index = 0,
    offset = 0,
    studyWeeks = 0;
  while (index < remaining.length) {
    while (index < remaining.length && remaining[index]!.units === 0) index++;
    if (index === remaining.length) break;
    if (offset >= 520)
      throw new AppError(
        422,
        'PLAN_TOO_LONG',
        'This plan exceeds 10 years. Increase your weekly hours.',
      );
    if (settings.flexibilityMode === 'RELAXED' && studyWeeks > 0 && studyWeeks % 4 === 0) {
      weeks.push({
        weekNumber: weeks.length + 1,
        startDate: addDays(settings.startDate, offset * 7),
        plannedHours: 0,
        focusSummary: 'Buffer week: review or catch up',
        isBuffer: true,
        items: [],
      });
      offset++;
      studyWeeks = 0;
    }
    const items: ScheduledItem[] = [];
    let available = capacity;
    if (settings.flexibilityMode === 'DEADLINE' && settings.targetEndDate) {
      const daysLeft =
        Math.round(
          (Date.parse(settings.targetEndDate) -
            Date.parse(addDays(settings.startDate, offset * 7))) /
            86400000,
        ) + 1;
      if (daysLeft <= 0)
        throw new AppError(
          422,
          'DEADLINE_IMPOSSIBLE',
          'Not enough time remains before this deadline.',
        );
      available = Math.floor((capacity * Math.min(7, daysLeft)) / 7);
    }
    while (index < remaining.length && available > 0) {
      const row = remaining[index]!;
      const units = Math.min(available, row.units);
      if (units > 0)
        items.push({
          topicId: row.topic.id,
          allocatedHours: units / 100,
          status: 'TODO',
          completedAt: null,
        });
      row.units -= units;
      available -= units;
      if (row.units === 0) index++;
    }
    weeks.push({
      weekNumber: weeks.length + 1,
      startDate: addDays(settings.startDate, offset * 7),
      plannedHours: (capacity - available) / 100,
      focusSummary: items
        .map((item) => topics.find((topic) => topic.id === item.topicId)!.title)
        .join(' · ')
        .slice(0, 1000),
      isBuffer: false,
      items,
    });
    offset++;
    studyWeeks++;
  }
  weeks.forEach(
    (week) =>
      (week.plannedHours =
        Math.round(week.items.reduce((sum, item) => sum + item.allocatedHours, 0) * 100) / 100),
  );
  const future = weeks.filter((week) => week.items.some((item) => item.status === 'TODO'));
  let projectedEndDate = future.length ? addDays(future.at(-1)!.startDate, 6) : settings.startDate;
  if (
    settings.flexibilityMode === 'DEADLINE' &&
    settings.targetEndDate &&
    projectedEndDate > settings.targetEndDate
  )
    projectedEndDate = settings.targetEndDate;
  if (settings.targetEndDate && projectedEndDate > settings.targetEndDate)
    warnings.push('At this pace the plan finishes after your target date.');
  return {
    weeks,
    projectedEndDate,
    effectiveHoursPerWeek: capacity / 100,
    remainingHours: totalUnits / 100,
    warnings,
  };
}
