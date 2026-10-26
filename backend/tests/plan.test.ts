import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { schedulePlan } from '../src/modules/plan/plan.scheduler.js';
import {
  planSettingsSchema,
  savePlanSchema,
  type PlanSettings,
} from '../src/modules/plan/plan.schemas.js';
import { PlanService } from '../src/modules/plan/plan.service.js';
import type { PlanSnapshot, PlanRepository } from '../src/modules/plan/plan.repository.js';

const settings: PlanSettings = {
  roadmapId: randomUUID(),
  hoursPerWeek: 5,
  flexibilityMode: 'STANDARD',
  startDate: '2026-10-27',
  targetEndDate: null,
  expectedPlanId: null,
};
const topics = [
  { id: randomUUID(), title: 'Foundation', estimatedHours: 7, status: 'TODO' },
  { id: randomUUID(), title: 'Project', estimatedHours: 5, status: 'TODO' },
];
describe('deterministic scheduler', () => {
  it('fills weeks in order and splits a topic without losing hours', () => {
    const result = schedulePlan(settings, topics);
    expect(result.weeks.map((week) => week.plannedHours)).toEqual([5, 5, 2]);
    expect(result.weeks[1]!.items.map((item) => item.allocatedHours)).toEqual([2, 3]);
    expect(result.projectedEndDate).toBe('2026-11-16');
    expect(result.remainingHours).toBe(12);
  });
  it('uses 80% capacity with a buffer after every four study weeks', () => {
    const result = schedulePlan({ ...settings, flexibilityMode: 'RELAXED' }, [
      { ...topics[0]!, estimatedHours: 40 },
    ]);
    expect(result.effectiveHoursPerWeek).toBe(4);
    expect(result.weeks.filter((week) => week.isBuffer)).toHaveLength(2);
    expect(result.weeks[4]!.plannedHours).toBe(0);
    expect(result.weeks[9]!.isBuffer).toBe(true);
    expect(result.weeks.at(-1)!.isBuffer).toBe(false);
  });
  it('uses 120% capacity without buffers', () => {
    const result = schedulePlan({ ...settings, flexibilityMode: 'INTENSIVE' }, topics);
    expect(result.weeks.map((week) => week.plannedHours)).toEqual([6, 6]);
  });
  it('calculates deadline hours using partial weeks and warns when the pace is unrealistic', () => {
    const result = schedulePlan(
      { ...settings, flexibilityMode: 'DEADLINE', targetEndDate: '2026-11-05' },
      topics,
    );
    expect(result.effectiveHoursPerWeek).toBe(8.4);
    expect(result.weeks.map((week) => week.plannedHours)).toEqual([8.4, 3.6]);
    expect(result.projectedEndDate).toBe('2026-11-05');
    expect(result.warnings).toHaveLength(1);
    expect(() =>
      schedulePlan({ ...settings, flexibilityMode: 'DEADLINE', targetEndDate: '2026-10-27' }, [
        { ...topics[0]!, estimatedHours: 30 },
      ]),
    ).toThrow('168 hours');
  });
  it('keeps done allocations, resets unfinished work, and does not schedule completed topics', () => {
    const done = [
      {
        topicId: topics[0]!.id,
        allocatedHours: 5,
        completedAt: '2026-10-20T12:00:00.000Z',
        startDate: '2026-10-20',
      },
    ];
    const result = schedulePlan(settings, topics, done);
    expect(result.remainingHours).toBe(7);
    expect(result.weeks[0]!.items[0]!.status).toBe('DONE');
    expect(result.weeks[1]!.items[0]!.allocatedHours).toBe(2);
    expect(
      schedulePlan(
        settings,
        topics.map((topic) => ({ ...topic, status: 'DONE' })),
      ).weeks,
    ).toEqual([]);
  });
  it.each(['STANDARD', 'RELAXED', 'INTENSIVE', 'DEADLINE'] as const)(
    'conserves exact hours for %s',
    (mode) => {
      const input = {
        ...settings,
        hoursPerWeek: 0.5,
        flexibilityMode: mode,
        targetEndDate: mode === 'DEADLINE' ? '2026-12-31' : null,
      };
      const result = schedulePlan(input, [
        { ...topics[0]!, estimatedHours: 1.33 },
        { ...topics[1]!, estimatedHours: 2.67 },
      ]);
      expect(
        Math.round(
          result.weeks
            .flatMap((week) => week.items)
            .reduce((sum, item) => sum + item.allocatedHours, 0) * 100,
        ),
      ).toBe(400);
      expect(
        result.weeks.flatMap((week) => week.items).every((item) => item.allocatedHours > 0),
      ).toBe(true);
    },
  );
  it('validates settings and rejects impossible/overlong schedules', () => {
    expect(planSettingsSchema.safeParse({ ...settings, hoursPerWeek: 0 }).success).toBe(false);
    expect(planSettingsSchema.safeParse({ ...settings, flexibilityMode: 'DEADLINE' }).success).toBe(
      false,
    );
    expect(planSettingsSchema.safeParse({ ...settings, startDate: '2026-02-30' }).success).toBe(
      false,
    );
    expect(savePlanSchema.safeParse(settings).success).toBe(false);
    expect(() =>
      schedulePlan({ ...settings, hoursPerWeek: 0.5 }, [{ ...topics[0]!, estimatedHours: 1000 }]),
    ).toThrow('10 years');
  });
  it('warns when an optional target is missed and handles leap dates', () => {
    expect(
      schedulePlan({ ...settings, targetEndDate: settings.startDate }, topics).warnings,
    ).toHaveLength(1);
    expect(
      schedulePlan({ ...settings, startDate: '2028-02-27' }, [{ ...topics[0]!, estimatedHours: 1 }])
        .projectedEndDate,
    ).toBe('2028-03-04');
  });
});
describe('preview concurrency guard', () => {
  it('confirms matching previews and rejects changed progress or stale active plans', async () => {
    const snapshot: PlanSnapshot = {
      roadmapId: settings.roadmapId,
      topics: structuredClone(topics),
      active: null,
      completed: [],
    };
    const repository = {
      snapshot: async () => snapshot,
      commit: async (
        _user: string,
        _id: string,
        build: Parameters<PlanRepository['commit']>[2],
      ) => {
        build(snapshot);
        return { id: 'saved' };
      },
    } as unknown as PlanRepository;
    const service = new PlanService(repository, () => settings.startDate);
    const preview = await service.preview('owner', settings);
    expect(
      await service.save('owner', { ...settings, previewToken: preview.previewToken }),
    ).toEqual({ id: 'saved' });
    snapshot.topics[0]!.status = 'DONE';
    await expect(
      service.save('owner', { ...settings, previewToken: preview.previewToken }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PREVIEW_EXPIRED' });
    await expect(
      service.preview('owner', { ...settings, expectedPlanId: randomUUID() }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PLAN_CHANGED' });
    await expect(
      service.preview('owner', { ...settings, startDate: '2020-01-01' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
