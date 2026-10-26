import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { AuthTokens } from '../src/modules/auth/auth.tokens.js';
import { normalizeSkillName } from '../src/modules/skills/skills.schemas.js';
import { MemoryAuthRepository } from './helpers/memory-auth-repository.js';
import { MemorySkillsRepository, reactSkill } from './helpers/memory-skills-repository.js';

describe('skills API and ownership', () => {
  let app: ReturnType<typeof createApp>;
  let ownerToken: string;
  let otherToken: string;
  let ownerId: string;
  beforeEach(async () => {
    const authRepository = new MemoryAuthRepository();
    const authSecrets = {
      access: 'skill-test-access-'.repeat(4),
      refresh: 'skill-test-refresh-'.repeat(4),
    };
    const auth = new AuthService(authRepository, new AuthTokens(authSecrets));
    const owner = await auth.register({
      name: 'Owner',
      email: 'owner@example.test',
      password: 'Learning!42',
    });
    const other = await auth.register({
      name: 'Other',
      email: 'other@example.test',
      password: 'Learning!42',
    });
    ownerToken = owner.accessToken;
    otherToken = other.accessToken;
    ownerId = owner.user.id;
    app = createApp({
      authRepository,
      authSecrets,
      skillsRepository: new MemorySkillsRepository(),
    });
  });

  it('serves the public catalogue and validates search queries', async () => {
    const all = await request(app).get('/api/v1/skills');
    expect(all.status).toBe(200);
    expect(all.body.data.skills).toHaveLength(2);
    expect((await request(app).get('/api/v1/skills?search=ReactJS')).body.data.skills[0].name).toBe(
      'React',
    );
    expect((await request(app).get('/api/v1/skills?search=unknown')).body.data.skills).toEqual([]);
    expect(
      (
        await request(app)
          .get('/api/v1/skills')
          .query({ search: 'x'.repeat(101) })
      ).status,
    ).toBe(422);
    expect((await request(app).get('/api/v1/skills?search[]=React')).status).toBe(422);
    expect((await request(app).get('/api/v1/skills').query({ search: '\u0000' })).status).toBe(422);
  });

  it('requires authentication for every profile method', async () => {
    expect((await request(app).get('/api/v1/me/skills')).status).toBe(401);
    expect((await request(app).post('/api/v1/me/skills').send({})).status).toBe(401);
    expect(
      (await request(app).patch(`/api/v1/me/skills/${reactSkill.id}`).send({ level: 'ADVANCED' }))
        .status,
    ).toBe(401);
    expect((await request(app).delete(`/api/v1/me/skills/${reactSkill.id}`)).status).toBe(401);
  });

  it('adds a skill, prevents duplicates, changes its level, and removes it', async () => {
    const added = await request(app)
      .post('/api/v1/me/skills')
      .auth(ownerToken, { type: 'bearer' })
      .send({ skillId: reactSkill.id, level: 'BEGINNER' });
    expect(added.status).toBe(201);
    expect(added.body.data.skill.skill.name).toBe('React');
    expect(added.body.data.skill.userId).toBeUndefined();
    expect(
      (
        await request(app)
          .post('/api/v1/me/skills')
          .auth(ownerToken, { type: 'bearer' })
          .send({ skillId: reactSkill.id, level: 'ADVANCED' })
      ).status,
    ).toBe(409);
    const updated = await request(app)
      .patch(`/api/v1/me/skills/${reactSkill.id}`)
      .auth(ownerToken, { type: 'bearer' })
      .send({ level: 'INTERMEDIATE' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.skill.level).toBe('INTERMEDIATE');
    expect(
      (await request(app).get('/api/v1/me/skills').auth(ownerToken, { type: 'bearer' })).body.data
        .skills,
    ).toHaveLength(1);
    expect(
      (
        await request(app)
          .delete(`/api/v1/me/skills/${reactSkill.id}`)
          .auth(ownerToken, { type: 'bearer' })
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get('/api/v1/me/skills').auth(ownerToken, { type: 'bearer' })).body.data
        .skills,
    ).toEqual([]);
  });

  it('cannot read, modify, or delete another account’s skills', async () => {
    await request(app)
      .post('/api/v1/me/skills')
      .auth(ownerToken, { type: 'bearer' })
      .send({ skillId: reactSkill.id, level: 'ADVANCED' });
    expect(
      (await request(app).get('/api/v1/me/skills').auth(otherToken, { type: 'bearer' })).body.data
        .skills,
    ).toEqual([]);
    expect(
      (
        await request(app)
          .patch(`/api/v1/me/skills/${reactSkill.id}`)
          .auth(otherToken, { type: 'bearer' })
          .send({ level: 'BEGINNER' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(`/api/v1/me/skills/${reactSkill.id}`)
          .auth(otherToken, { type: 'bearer' })
      ).status,
    ).toBe(404);
    const own = await request(app).get('/api/v1/me/skills').auth(ownerToken, { type: 'bearer' });
    expect(own.body.data.skills[0].level).toBe('ADVANCED');
    expect(own.headers['cache-control']).toBe('no-store');
  });

  it('rejects spoofed ownership, invalid levels, and malformed IDs', async () => {
    expect(
      (
        await request(app)
          .post('/api/v1/me/skills')
          .auth(otherToken, { type: 'bearer' })
          .send({ userId: ownerId, skillId: reactSkill.id, level: 'BEGINNER' })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .get(`/api/v1/me/skills?userId=${ownerId}`)
          .auth(otherToken, { type: 'bearer' })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .post('/api/v1/me/skills')
          .auth(ownerToken, { type: 'bearer' })
          .send({ skillId: reactSkill.id, level: 'EXPERT' })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .patch('/api/v1/me/skills/not-an-id')
          .auth(ownerToken, { type: 'bearer' })
          .send({ level: 'BEGINNER' })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(app)
          .post('/api/v1/me/skills')
          .auth(ownerToken, { type: 'bearer' })
          .send({ skillId: randomUUID(), level: 'BEGINNER' })
      ).status,
    ).toBe(404);
  });
});

describe('starter catalogue integrity', () => {
  it('uses canonical unique names and normalized aliases without conflating C++ and C#', async () => {
    const skills = z
      .array(
        z.object({
          id: z.uuid(),
          name: z.string(),
          normalizedName: z.string(),
          category: z.string(),
          aliases: z.array(z.string()),
        }),
      )
      .parse(
        JSON.parse(await readFile(new URL('../prisma/data/skills.json', import.meta.url), 'utf8')),
      );
    expect(skills.length).toBe(32);
    for (const key of ['id', 'name', 'normalizedName'] as const)
      expect(new Set(skills.map((skill) => skill[key])).size).toBe(skills.length);
    for (const skill of skills) {
      expect(skill.normalizedName).toBe(normalizeSkillName(skill.name));
      for (const alias of skill.aliases) expect(alias).toBe(normalizeSkillName(alias));
    }
    expect(normalizeSkillName('C++')).not.toBe(normalizeSkillName('C#'));
  });
});
