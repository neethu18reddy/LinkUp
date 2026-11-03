import { describe, it, expect } from 'vitest';
import { buildYouTubePlan } from '../src/modules/youtube/youtube.planner.js';
import { planningSchema } from '../src/modules/youtube/youtube.schemas.js';
const preferences = planningSchema.parse({
  goal: 'Learn arrays',
  level: 'beginner',
  language: 'both',
  timezone: 'Asia/Kolkata',
  dailyMinutes: 20,
  weekdays: [1, 2, 3, 4, 5],
  startDate: '2026-11-06',
  targetDate: '2026-11-06',
});
const chapters = [
  {
    title: 'Arrays',
    items: [
      { id: 'a', title: 'First', durationSec: 1800, available: true },
      { id: 'b', title: 'Unavailable', durationSec: 500, available: false },
    ],
  },
];
describe('YouTube learning schedule', () => {
  it('preserves order, splits a long video, skips weekends and includes practice/review', () => {
    const plan = buildYouTubePlan(chapters, preferences);
    expect(plan.days.map((d) => d.date)).toEqual(['2026-11-06', '2026-11-09', '2026-11-10']);
    expect(plan.days[0]!.tasks[0]).toMatchObject({ itemId: 'a', startSec: 0, endSec: 1200 });
    expect(plan.days[1]!.tasks[0]).toMatchObject({ itemId: 'a', startSec: 1200, endSec: 1800 });
    expect(plan.totalMinutes).toBe(45);
    expect(plan.warning).toContain('after your deadline');
    expect(plan.days.every((d) => d.minutes <= 20)).toBe(true);
  });
  it('requires an unknown-duration estimate instead of silently omitting an item', () => {
    const input = [
      { title: 'Unknown', items: [{ id: 'a', title: 'Video', durationSec: 0, available: true }] },
    ];
    expect(() => buildYouTubePlan(input, preferences)).toThrow('Enter an estimated duration');
    expect(
      buildYouTubePlan(input, { ...preferences, estimates: { a: 600 } }).days[0]!.tasks[0],
    ).toMatchObject({ estimated: true, endSec: 600 });
  });
  it('rejects impossible dates, duplicate weekdays and empty resources', () => {
    expect(planningSchema.safeParse({ ...preferences, startDate: '2026-02-30' }).success).toBe(
      false,
    );
    expect(planningSchema.safeParse({ ...preferences, weekdays: [1, 1] }).success).toBe(false);
    expect(() => buildYouTubePlan([], preferences)).toThrow('no available learning items');
  });
  it('uses calendar dates across daylight saving transitions and keeps all videos', () => {
    const plan = buildYouTubePlan(
      [
        {
          title: 'Course',
          items: [
            ...chapters[0]!.items.slice(0, 1),
            { id: 'c', title: 'Next video', durationSec: 600, available: true },
          ],
        },
      ],
      {
        ...preferences,
        timezone: 'America/New_York',
        startDate: '2026-10-31',
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        targetDate: null,
      },
    );
    expect(plan.days.map((d) => d.date)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02']);
    expect(
      plan.days
        .flatMap((d) => d.tasks)
        .filter((t) => t.kind === 'watch')
        .map((t) => t.itemId),
    ).toEqual(['a', 'a', 'c']);
    expect(plan.warning).toBeNull();
  });
});
