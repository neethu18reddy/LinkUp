import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { getDatabase, disconnectDatabase } from '../src/config/database.js';
import { studioTransaction } from '../src/modules/studio/studio.db.js';
import { writeSkillProgress } from '../src/modules/studio/studio.sync.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'Studio preservation and synchronization',
  () => {
    const users: string[] = [];
    const db = () => getDatabase()!;
    afterAll(async () => {
      await db().user.deleteMany({ where: { id: { in: users } } });
      await disconnectDatabase();
    });
    it('backfills existing progress twice without changing old snapshots or later manual decisions', async () => {
      const userId = randomUUID();
      users.push(userId);
      await db().user.create({
        data: {
          id: userId,
          name: 'Studio preservation',
          email: `studio-${userId}@example.test`,
          passwordHash: 'test-only',
        },
      });
      const skillId = '00000000-0000-4000-8000-000000000005';
      const goal = await db().goal.create({ data: { userId, targetRole: 'Preserve this goal' } });
      const completedAt = new Date('2026-10-20T12:00:00Z');
      const roadmap = await db().roadmap.create({
        data: {
          userId,
          goalId: goal.id,
          title: 'Original snapshot',
          status: 'ACTIVE',
          totalEstimatedHours: 10,
          phases: {
            create: {
              order: 0,
              title: 'Original stage',
              description: 'Keep me',
              topics: {
                create: {
                  skillId,
                  order: 0,
                  title: 'React',
                  estimatedHours: 10,
                  difficulty: 'BEGINNER',
                  status: 'DONE',
                  completedAt,
                },
              },
            },
          },
        },
        include: { phases: { include: { topics: true } } },
      });
      const sql = readFileSync(new URL('../prisma/studio-backfill.sql', import.meta.url), 'utf8');
      const backfill = async () => {
        for (const statement of sql.split(';').filter((part) => part.trim()))
          await db().$executeRawUnsafe(statement);
      };
      await backfill();
      await backfill();
      const progress = await db().userSkillProgress.findUniqueOrThrow({
        where: { userId_skillId: { userId, skillId } },
      });
      expect(progress.status).toBe('DONE');
      expect(progress.completedAt).toEqual(completedAt);
      expect(
        await db().skillProgressEvent.count({ where: { userId, skillId, legacy: true } }),
      ).toBe(1);
      expect(
        await db().topic.findUnique({ where: { id: roadmap.phases[0]!.topics[0]!.id } }),
      ).toMatchObject({ status: 'DONE', completedAt });
      await studioTransaction((tx) =>
        writeSkillProgress(tx, userId, skillId, 'NOT_STARTED', 'MANUAL', 0),
      );
      await backfill();
      expect(
        await db().skillProgressEvent.findFirst({ where: { userId, skillId, legacy: true } }),
      ).toMatchObject({ occurredAt: completedAt, status: 'DONE' });
      expect(
        await db().userSkillProgress.findUniqueOrThrow({
          where: { userId_skillId: { userId, skillId } },
        }),
      ).toMatchObject({ status: 'NOT_STARTED', manualComplete: false });
      await studioTransaction((tx) =>
        writeSkillProgress(tx, userId, skillId, 'DONE', 'MANUAL', 100),
      );
      await studioTransaction((tx) =>
        writeSkillProgress(tx, userId, skillId, 'IN_PROGRESS', 'RESOURCE', 20),
      );
      expect(
        await db().userSkillProgress.findUniqueOrThrow({
          where: { userId_skillId: { userId, skillId } },
        }),
      ).toMatchObject({ status: 'DONE', manualComplete: true, percent: 100 });
      const originalTopicId = roadmap.phases[0]!.topics[0]!.id;
      const originalTopic = await db().topic.findUniqueOrThrow({ where: { id: originalTopicId } });
      const advanced = await db().roadmap.create({
        data: {
          userId,
          goalId: goal.id,
          version: 2,
          title: 'Advanced review',
          status: 'ACTIVE',
          totalEstimatedHours: 10,
          phases: {
            create: {
              order: 0,
              title: 'Advanced stage',
              description: 'A higher target',
              topics: {
                create: {
                  skillId,
                  order: 0,
                  title: 'Advanced React',
                  estimatedHours: 10,
                  difficulty: 'ADVANCED',
                },
              },
            },
          },
        },
        include: { phases: { include: { topics: true } } },
      });
      const advancedId = advanced.phases[0]!.topics[0]!.id;
      await studioTransaction((tx) =>
        writeSkillProgress(tx, userId, skillId, 'IN_PROGRESS', 'RESOURCE', 50),
      );
      expect(await db().topic.findUniqueOrThrow({ where: { id: advancedId } })).toMatchObject({
        status: 'IN_PROGRESS',
      });
      expect(await db().topic.findUniqueOrThrow({ where: { id: originalTopicId } })).toMatchObject({
        status: 'DONE',
        completedAt: originalTopic.completedAt,
      });
      await studioTransaction((tx) =>
        writeSkillProgress(tx, userId, skillId, 'DONE', 'RESOURCE', 100),
      );
      expect(await db().topic.findUniqueOrThrow({ where: { id: advancedId } })).toMatchObject({
        status: 'DONE',
      });
      expect(
        await db().userSkill.findUniqueOrThrow({ where: { userId_skillId: { userId, skillId } } }),
      ).toMatchObject({ level: 'ADVANCED' });
    });
  },
);
