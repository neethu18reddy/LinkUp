import { randomUUID } from 'node:crypto';
import { afterAll, describe, it, expect } from 'vitest';
import { getDatabase, disconnectDatabase } from '../src/config/database.js';
import { PrismaNotificationRepository } from '../src/modules/notifications/notifications.repository.js';
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'Prisma notifications',
  () => {
    const repository = new PrismaNotificationRepository();
    const users: string[] = [];
    const now = new Date('2026-10-27T08:00:00Z');
    afterAll(async () => {
      if (users.length) await getDatabase()!.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDatabase();
    });
    it('returns bounded account batches and resumes from the returned cursor', async () => {
      const db = getDatabase()!;
      const ids = Array.from({ length: 102 }, () => randomUUID());
      users.push(...ids);
      await db.user.createMany({
        data: ids.map((id) => ({
          id,
          name: 'Batch fixture',
          email: `batch-${id}@example.test`,
          passwordHash: 'unused-test-hash',
          remindersEnabled: false,
        })),
      });
      let cursor: string | undefined;
      let processed = 0;
      const seen = new Set<string>();
      for (let batch = 0; batch < 10; batch++) {
        const result = await repository.weekly(now, cursor);
        expect(result.processed).toBeLessThanOrEqual(100);
        processed += result.processed;
        if (!result.nextCursor) break;
        expect(seen.has(result.nextCursor)).toBe(false);
        seen.add(result.nextCursor);
        cursor = result.nextCursor;
      }
      expect(processed).toBeGreaterThanOrEqual(102);
      expect(seen.size).toBeGreaterThanOrEqual(1);
      await db.user.deleteMany({ where: { id: { in: ids } } });
    });
    async function fixture() {
      const db = getDatabase()!;
      const user = await db.user.create({
        data: {
          name: 'Reminder learner',
          email: `notice-${randomUUID()}@example.test`,
          passwordHash: 'test-only-unused',
        },
      });
      users.push(user.id);
      const goal = await db.goal.create({ data: { userId: user.id, targetRole: 'Learning' } });
      const roadmap = await db.roadmap.create({
        data: {
          userId: user.id,
          goalId: goal.id,
          title: 'Reminder path',
          totalEstimatedHours: 2,
          status: 'ACTIVE',
          phases: {
            create: {
              title: 'Practice',
              description: 'Learn',
              order: 0,
              topics: {
                create: {
                  title: 'Practice topic',
                  order: 0,
                  estimatedHours: 2,
                  difficulty: 'BEGINNER',
                },
              },
            },
          },
        },
        include: { phases: { include: { topics: true } } },
      });
      const plan = await db.plan.create({
        data: {
          roadmapId: roadmap.id,
          hoursPerWeek: 2,
          startDate: new Date('2026-10-19'),
          projectedEndDate: new Date('2026-10-25'),
          weeks: {
            create: {
              weekNumber: 1,
              startDate: new Date('2026-10-19'),
              plannedHours: 2,
              focusSummary: 'Practice',
              items: { create: { topicId: roadmap.phases[0]!.topics[0]!.id, allocatedHours: 2 } },
            },
          },
        },
      });
      return { user, roadmap, plan };
    }
    it('deduplicates concurrent batches per week, handles new weeks and read retries', async () => {
      const { user } = await fixture();
      await Promise.all([repository.weekly(now), new PrismaNotificationRepository().weekly(now)]);
      const first = await repository.list(user.id);
      expect(first.notifications).toHaveLength(2);
      expect(first.unreadCount).toBe(2);
      expect(first.notifications.map((row) => row.type).sort()).toEqual([
        'BEHIND_SCHEDULE',
        'WEEKLY_REMINDER',
      ]);
      await repository.weekly(new Date('2026-10-28T08:00:00Z'));
      expect((await repository.list(user.id)).notifications).toHaveLength(2);
      const id = first.notifications[0]!.id;
      await repository.read(user.id, id, now);
      await repository.read(user.id, id, new Date('2026-10-29'));
      expect(
        (await repository.list(user.id)).notifications.find((row) => row.id === id)!.readAt,
      ).toBe(now.toISOString());
      await repository.weekly(new Date('2026-11-02T08:00:00Z'));
      expect((await repository.list(user.id)).notifications).toHaveLength(4);
    });
    it('respects opt-out, completed/archived work, future plans and inactive versions', async () => {
      const { user, roadmap, plan } = await fixture(),
        db = getDatabase()!;
      await repository.setPreferences(user.id, false);
      await repository.weekly(now);
      expect((await repository.list(user.id)).notifications).toEqual([]);
      await repository.setPreferences(user.id, true);
      await db.plan.update({ where: { id: plan.id }, data: { isActive: false } });
      await repository.weekly(now);
      expect((await repository.list(user.id)).notifications).toEqual([]);
      await db.plan.update({
        where: { id: plan.id },
        data: { isActive: true, startDate: new Date('2026-11-01') },
      });
      await repository.weekly(now);
      expect((await repository.list(user.id)).notifications).toEqual([]);
      await db.plan.update({ where: { id: plan.id }, data: { startDate: new Date('2026-10-19') } });
      await db.topic.updateMany({
        where: { phase: { roadmapId: roadmap.id } },
        data: { status: 'DONE' },
      });
      await repository.weekly(now);
      expect((await repository.list(user.id)).notifications).toEqual([]);
      await db.topic.updateMany({
        where: { phase: { roadmapId: roadmap.id } },
        data: { status: 'TODO' },
      });
      await db.roadmap.update({ where: { id: roadmap.id }, data: { status: 'ARCHIVED' } });
      await repository.weekly(now);
      expect((await repository.list(user.id)).notifications).toEqual([]);
      await db.roadmap.update({ where: { id: roadmap.id }, data: { status: 'ACTIVE' } });
      await repository.weekly(now);
      expect((await repository.list(user.id)).notifications).toHaveLength(2);
    });
    it('paginates equal timestamps without leaks and rejects other-owner cursors and reads', async () => {
      const owner = await fixture(),
        other = await fixture(),
        db = getDatabase()!;
      await db.notification.createMany({
        data: Array.from({ length: 25 }, (_, i) => ({
          userId: owner.user.id,
          type: 'WEEKLY_REMINDER' as const,
          title: `Notice ${i}`,
          message: 'Local reminder',
          deduplicationKey: randomUUID(),
          createdAt: now,
        })),
      });
      const first = await repository.list(owner.user.id);
      const second = await repository.list(owner.user.id, first.nextCursor!);
      expect(first.notifications).toHaveLength(20);
      expect(second.notifications).toHaveLength(5);
      expect(second.nextCursor).toBeNull();
      expect(
        new Set([...first.notifications, ...second.notifications].map((row) => row.id)).size,
      ).toBe(25);
      await expect(repository.list(other.user.id, first.nextCursor!)).rejects.toMatchObject({
        code: 'NOTIFICATION_NOT_FOUND',
      });
      await expect(
        repository.read(other.user.id, first.notifications[0]!.id, now),
      ).rejects.toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
      expect((await repository.list(other.user.id)).unreadCount).toBe(0);
    });
  },
);
