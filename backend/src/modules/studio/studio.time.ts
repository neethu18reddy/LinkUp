import { Temporal } from '@js-temporal/polyfill';

export function localDate(now: Date, timezone: string) {
  return Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(timezone)
    .toPlainDate()
    .toString();
}
export function previousDate(date: string) {
  return Temporal.PlainDate.from(date).subtract({ days: 1 }).toString();
}
export function splitInterval(start: Date, end: Date, timezone: string) {
  const parts: { localDate: string; startedAt: Date; endedAt: Date; seconds: number }[] = [];
  let cursor = start.getTime();
  while (cursor < end.getTime()) {
    const zoned = Temporal.Instant.fromEpochMilliseconds(cursor).toZonedDateTimeISO(timezone);
    const next = Math.min(zoned.startOfDay().add({ days: 1 }).epochMilliseconds, end.getTime());
    parts.push({
      localDate: zoned.toPlainDate().toString(),
      startedAt: new Date(cursor),
      endedAt: new Date(next),
      seconds: (next - cursor) / 1000,
    });
    cursor = next;
  }
  return parts;
}
export function watchCredit(
  previous: { wallSec: number; contentSec: number; lastAt: Date },
  incoming: { wallSec: number; contentSec: number },
  now: Date,
) {
  const elapsed = Math.max(0, (now.getTime() - previous.lastAt.getTime()) / 1000);
  const wall = Math.max(0, Math.min(incoming.wallSec - previous.wallSec, elapsed, 30));
  const content = Math.max(0, Math.min(incoming.contentSec - previous.contentSec, wall * 3));
  return { wall, content };
}
export function streaks(dates: string[], today: string) {
  const sorted = [...new Set(dates)].sort();
  let longest = 0,
    run = 0,
    last = '';
  for (const date of sorted) {
    run = last === previousDate(date) ? run + 1 : 1;
    longest = Math.max(longest, run);
    last = date;
  }
  const set = new Set(sorted);
  let cursor = set.has(today) ? today : previousDate(today),
    current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = previousDate(cursor);
  }
  return { current, longest };
}
