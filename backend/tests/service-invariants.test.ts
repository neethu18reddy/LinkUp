import { describe, it, expect } from 'vitest';
import { schedulePlan } from '../src/modules/plan/plan.scheduler.js';
import { analyzeGaps } from '../src/modules/roadmap/roadmap.gaps.js';
import type { ProfileSkill } from '../src/modules/skills/skills.types.js';
const modes = ['STANDARD', 'RELAXED', 'INTENSIVE', 'DEADLINE'] as const;
describe('scheduler conservation regression matrix', () => {
  it.each(modes.flatMap((mode) => [1, 7, 31].map((seed) => ({ mode, seed }))))(
    'conserves per-topic work for $mode seed $seed after partial completion',
    ({ mode, seed }) => {
      const topics = Array.from({ length: 8 }, (_, i) => ({
        id: `topic-${i}`,
        title: `Topic ${i}`,
        estimatedHours: (((seed * (i + 3) * 137) % 3000) + 100) / 100,
        status: 'TODO',
      }));
      const completed = topics.slice(0, 3).map((topic) => ({
        topicId: topic.id,
        allocatedHours: 0.5,
        completedAt: '2026-10-20T12:00:00.000Z',
        startDate: '2026-10-19',
      }));
      const settings = {
        roadmapId: 'owned-roadmap',
        hoursPerWeek: 4.5,
        flexibilityMode: mode,
        startDate: '2026-10-27',
        targetEndDate: mode === 'DEADLINE' ? '2027-02-15' : null,
        expectedPlanId: null,
      };
      const result = schedulePlan(settings, topics, completed);
      expect(schedulePlan(settings, topics, completed)).toEqual(result);
      const items = result.weeks.flatMap((week) => week.items);
      for (const topic of topics) {
        expect(
          items
            .filter((item) => item.topicId === topic.id)
            .reduce((sum, item) => sum + Math.round(item.allocatedHours * 100), 0),
        ).toBe(Math.round(topic.estimatedHours * 100));
      }
      expect(items.filter((item) => item.status === 'DONE')).toHaveLength(3);
      expect(
        items.every((item) => Number.isFinite(item.allocatedHours) && item.allocatedHours > 0),
      ).toBe(true);
      expect(
        result.weeks.filter((week) => week.isBuffer).every((week) => week.items.length === 0),
      ).toBe(true);
      expect(result.weeks.map((week) => week.startDate)).toEqual(
        result.weeks.map((week) => week.startDate).sort(),
      );
    },
  );
});
describe('skill gap boundaries', () => {
  const levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
  it.each([null, ...levels])('does not invent deficits for current level %s', (current) => {
    const profile: ProfileSkill[] = current
      ? [
          {
            skillId: 'skill',
            level: current,
            skill: { id: 'skill', name: 'Learning', category: 'Core' },
            createdAt: new Date(0),
            updatedAt: new Date(0),
          },
        ]
      : [];
    for (const [index, requiredLevel] of levels.entries()) {
      const result = analyzeGaps(
        [
          {
            skillId: 'skill',
            requiredLevel,
            weight: 2,
            skill: { name: 'Learning', category: 'Core' },
          },
        ],
        profile,
      );
      const currentLevel = current ? levels.indexOf(current) + 1 : 0;
      const expected = Math.max(0, index + 1 - currentLevel) * 2;
      expect(result.gaps.length + result.strengths.length).toBe(1);
      expect((result.gaps[0] ?? result.strengths[0])!.score).toBe(expected);
      expect(result.strengths.length).toBe(expected === 0 ? 1 : 0);
    }
  });
});
