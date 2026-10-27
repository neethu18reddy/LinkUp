import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { afterAll, describe, it, expect } from 'vitest';
import { getDatabase, disconnectDatabase } from '../src/config/database.js';
import { seedDemo, DEMO_USER_ID, demoOptions } from '../src/scripts/seed-demo.js';
describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'demo data persistence',
  () => {
    const created: string[] = [];
    afterAll(async () => {
      if (created.length) await getDatabase()!.user.deleteMany({ where: { id: { in: created } } });
      await disconnectDatabase();
    });
    it('seeds illustrative related data without overwriting passwords or other accounts', async () => {
      const db = getDatabase()!;
      const options = demoOptions({
        NODE_ENV: 'test',
        DEMO_SEED_EMAIL: `demo-${randomUUID()}@example.invalid`,
        DEMO_SEED_PASSWORD: 'PrivateDemo!42',
      });
      const result = await seedDemo(db, options);
      expect(result.created).toBe(true);
      created.push(result.userId);
      const account = await db.user.findUniqueOrThrow({ where: { id: DEMO_USER_ID } });
      expect(await bcrypt.compare(options.password, account.passwordHash)).toBe(true);
      expect(await db.roadmap.count({ where: { userId: DEMO_USER_ID } })).toBe(1);
      expect(await db.learningLog.count({ where: { userId: DEMO_USER_ID } })).toBe(3);
      expect(await db.projectSubmission.count({ where: { userId: DEMO_USER_ID } })).toBe(1);
      expect(await db.chatMessage.count({ where: { session: { userId: DEMO_USER_ID } } })).toBe(2);
      expect((await seedDemo(db, { ...options, password: 'DifferentDemo!42' })).created).toBe(
        false,
      );
      expect((await db.user.findUniqueOrThrow({ where: { id: DEMO_USER_ID } })).passwordHash).toBe(
        account.passwordHash,
      );
      expect(await db.learningLog.count({ where: { userId: DEMO_USER_ID } })).toBe(3);
      await expect(seedDemo(db, { ...options, email: 'another@example.invalid' })).rejects.toThrow(
        'conflicts',
      );
    }, 20000);
  },
);
