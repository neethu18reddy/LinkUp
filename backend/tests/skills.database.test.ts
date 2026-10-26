import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { disconnectDatabase, getDatabase } from '../src/config/database.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL)(
  'Prisma skill profile integration',
  () => {
    const app = createApp({
      authSecrets: {
        access: 'skills-db-access-'.repeat(4),
        refresh: 'skills-db-refresh-'.repeat(4),
      },
    });
    const users: string[] = [];
    const skillId = '00000000-0000-4000-8000-000000000005';
    afterAll(async () => {
      if (users.length) await getDatabase()!.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDatabase();
    });
    async function account() {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('X-Linkup-Request', '1')
        .send({
          name: 'Skill Learner',
          email: `skills-${randomUUID()}@example.test`,
          password: 'LearningTogether!42',
        });
      expect(response.status).toBe(201);
      users.push(response.body.data.user.id);
      return response.body.data.accessToken as string;
    }
    it('migrates every catalogue entry and resolves canonical names and aliases', async () => {
      const source: unknown[] = JSON.parse(
        await readFile(new URL('../prisma/data/skills.json', import.meta.url), 'utf8'),
      );
      expect(await getDatabase()!.skill.count()).toBe(source.length);
      for (const [search, name] of [
        ['ReactJS', 'React'],
        ['node js', 'Node.js'],
        ['postgres', 'PostgreSQL'],
        ['C++', 'C++'],
      ]) {
        const response = await request(app).get('/api/v1/skills').query({ search });
        expect(response.status).toBe(200);
        expect(
          response.body.data.skills.some((skill: { name: string }) => skill.name === name),
        ).toBe(true);
      }
    });
    it('persists changes across app instances and enforces account ownership', async () => {
      const owner = await account();
      const other = await account();
      const added = await request(app)
        .post('/api/v1/me/skills')
        .auth(owner, { type: 'bearer' })
        .send({ skillId, level: 'BEGINNER' });
      expect(added.status).toBe(201);
      expect(
        (
          await request(app)
            .post('/api/v1/me/skills')
            .auth(owner, { type: 'bearer' })
            .send({ skillId, level: 'ADVANCED' })
        ).status,
      ).toBe(409);
      expect(
        (await request(app).get('/api/v1/me/skills').auth(other, { type: 'bearer' })).body.data
          .skills,
      ).toEqual([]);
      expect(
        (
          await request(app)
            .patch(`/api/v1/me/skills/${skillId}`)
            .auth(other, { type: 'bearer' })
            .send({ level: 'ADVANCED' })
        ).status,
      ).toBe(404);
      expect(
        (await request(app).delete(`/api/v1/me/skills/${skillId}`).auth(other, { type: 'bearer' }))
          .status,
      ).toBe(404);
      const updated = await request(app)
        .patch(`/api/v1/me/skills/${skillId}`)
        .auth(owner, { type: 'bearer' })
        .send({ level: 'INTERMEDIATE' });
      expect(updated.status).toBe(200);
      expect(updated.body.data.skill.level).toBe('INTERMEDIATE');
      const freshApp = createApp({
        authSecrets: {
          access: 'skills-db-access-'.repeat(4),
          refresh: 'skills-db-refresh-'.repeat(4),
        },
      });
      const persisted = await request(freshApp)
        .get('/api/v1/me/skills')
        .auth(owner, { type: 'bearer' });
      expect(persisted.body.data.skills[0].level).toBe('INTERMEDIATE');
      expect(
        (await request(app).delete(`/api/v1/me/skills/${skillId}`).auth(owner, { type: 'bearer' }))
          .status,
      ).toBe(200);
      expect(await getDatabase()!.userSkill.count({ where: { userId: users[0] } })).toBe(0);
      expect(await getDatabase()!.skill.findUnique({ where: { id: skillId } })).not.toBeNull();
    }, 20_000);
    it('handles simultaneous duplicate additions with one success and one conflict', async () => {
      const token = await account();
      const responses = await Promise.all(
        [0, 1].map(() =>
          request(app)
            .post('/api/v1/me/skills')
            .auth(token, { type: 'bearer' })
            .send({ skillId, level: 'ADVANCED' }),
        ),
      );
      expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
      expect(await getDatabase()!.userSkill.count({ where: { userId: users.at(-1) } })).toBe(1);
    }, 20_000);
  },
);
