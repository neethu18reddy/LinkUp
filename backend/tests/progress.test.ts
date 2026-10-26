import { randomUUID } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { learningStreak, summarizeProgress } from '../src/modules/progress/progress.logic.js';
import { logSchema, projectSchema, taskSchema } from '../src/modules/progress/progress.schemas.js';
import { ProgressService } from '../src/modules/progress/progress.service.js';
import type {
  ProgressRepository,
  ProgressSnapshot,
} from '../src/modules/progress/progress.types.js';

const topic = randomUUID(),
  skill = randomUUID();
function snapshot(): ProgressSnapshot {
  return {
    roadmap: {
      id: randomUUID(),
      title: 'Frontend',
      status: 'ACTIVE',
      phases: [
        {
          id: randomUUID(),
          title: 'Foundations',
          topics: [
            {
              id: topic,
              title: 'React',
              skillId: skill,
              skillName: 'React',
              estimatedHours: 10,
              status: 'IN_PROGRESS',
              isProject: false,
              submitted: false,
            },
            {
              id: randomUUID(),
              title: 'Capstone',
              skillId: null,
              skillName: null,
              estimatedHours: 10,
              status: 'TODO',
              isProject: true,
              submitted: false,
            },
          ],
        },
      ],
    },
    plan: {
      id: randomUUID(),
      weeks: [
        {
          startDate: '2026-10-19',
          plannedHours: 5,
          focusSummary: 'React',
          items: [
            {
              id: randomUUID(),
              topicId: topic,
              title: 'React',
              allocatedHours: 5,
              status: 'DONE',
              isProject: false,
            },
          ],
        },
        {
          startDate: '2026-10-26',
          plannedHours: 5,
          focusSummary: 'React',
          items: [
            {
              id: randomUUID(),
              topicId: topic,
              title: 'React',
              allocatedHours: 5,
              status: 'TODO',
              isProject: false,
            },
          ],
        },
      ],
    },
    days: [
      { date: '2026-10-27', minutes: 60 },
      { date: '2026-10-26', minutes: 30 },
    ],
  };
}
describe('progress calculations', () => {
  it('weights earned hours, counts only the active snapshot, and groups skill progress', () => {
    const data = summarizeProgress(snapshot(), '2026-10-27');
    expect(data.overallPercent).toBe(25);
    expect(data.skills[0]!.percent).toBe(50);
    expect(data.currentWeek?.loggedMinutes).toBe(90);
    expect(data.loggedMinutesLast7Days).toBe(90);
    expect(data.nextMilestone?.remainingTopics).toBe(2);
    expect(data.streak).toBe(2);
  });
  it('caps earned hours and distinguishes submitted projects from completed tasks', () => {
    const input = snapshot();
    input.plan!.weeks[0]!.items[0]!.allocatedHours = 30;
    input.roadmap!.phases[0]!.topics[1]!.submitted = true;
    const result = summarizeProgress(input, '2026-10-27');
    expect(result.overallPercent).toBe(50);
    expect(result.projectsSubmitted).toBe(1);
    expect(result.completedTopics).toBe(0);
  });
  it('detects overdue unfinished allocations without counting future or done tasks', () => {
    const input = snapshot();
    input.plan!.weeks[0]!.items[0]!.status = 'SKIPPED';
    const result = summarizeProgress(input, '2026-10-27');
    expect(result.behindSchedule).toBe(true);
    expect(result.overdueHours).toBe(5);
  });
  it('excludes carried history from this week and handles empty/completed roadmaps', () => {
    const input = snapshot();
    input.plan!.weeks[1]!.focusSummary = 'Completed work (preserved)';
    expect(summarizeProgress(input, '2026-10-27').currentWeek).toBeNull();
    input.roadmap!.phases[0]!.topics.forEach((topic) => (topic.status = 'DONE'));
    expect(summarizeProgress(input, '2026-10-27').overallPercent).toBe(100);
    expect(
      summarizeProgress({ ...input, roadmap: null, plan: null }, '2026-10-27').overallPercent,
    ).toBe(0);
  });
  it.each([
    [['2026-10-27', '2026-10-26', '2026-10-26', '2026-10-25'], 3],
    [['2026-10-26', '2026-10-25'], 2],
    [['2026-10-25'], 0],
    [[], 0],
  ] as [string[], number][])('calculates a UTC streak for %j', (dates, count) => {
    expect(learningStreak(dates, '2026-10-27')).toBe(count);
  });
  it('keeps daily charts to seven dates and handles leap days', () => {
    expect(learningStreak(['2028-03-01', '2028-02-29', '2028-02-28'], '2028-03-01')).toBe(3);
    expect(summarizeProgress(snapshot(), '2026-10-27').daily).toHaveLength(7);
  });
});
describe('progress validation and dates', () => {
  it('rejects spoofed identities, unsafe links, invalid minutes and missing evidence', () => {
    const log = {
      requestId: randomUUID(),
      topicId: null,
      minutes: 30,
      note: 'Read React documentation',
      loggedOn: '2026-10-27',
    };
    expect(logSchema.safeParse({ ...log, userId: randomUUID() }).success).toBe(false);
    expect(logSchema.safeParse({ ...log, minutes: 0 }).success).toBe(false);
    const project = {
      topicId: topic,
      title: 'App',
      repoUrl: 'https://example.test/project',
      notes: '',
    };
    expect(projectSchema.safeParse(project).success).toBe(true);
    expect(
      projectSchema.safeParse({ ...project, repoUrl: 'https://user:secret@example.test/' }).success,
    ).toBe(false);
    expect(projectSchema.safeParse({ ...project, repoUrl: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(projectSchema.safeParse({ ...project, repoUrl: null }).success).toBe(false);
    expect(taskSchema.safeParse({ status: 'DONE' }).success).toBe(false);
  });
  it('rejects future/too-old logs before repository writes and accepts today', async () => {
    const addLog = vi.fn().mockResolvedValue({ id: 'saved' });
    const service = new ProgressService(
      { addLog } as unknown as ProgressRepository,
      () => new Date('2026-10-27T12:00:00Z'),
    );
    const input = {
      requestId: randomUUID(),
      topicId: null,
      minutes: 30,
      note: 'Practice',
      loggedOn: '2026-10-27',
    };
    expect(await service.addLog('owner', input)).toEqual({ id: 'saved' });
    expect(() => service.addLog('owner', { ...input, loggedOn: '2026-10-28' })).toThrow(
      'past year',
    );
    expect(() => service.addLog('owner', { ...input, loggedOn: '2020-01-01' })).toThrow(
      'past year',
    );
    expect(addLog).toHaveBeenCalledTimes(1);
  });
});
