import { getDatabase } from '../../config/database.js';
import { Prisma, type Proficiency } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { normalizeSkillName } from './skills.schemas.js';
import type { SkillsRepository } from './skills.types.js';
import { searchCatalogSkills } from '../../catalog/catalog.js';

const publicSkill = { id: true, name: true, category: true } as const;
const profileSkill = {
  skillId: true,
  level: true,
  createdAt: true,
  updatedAt: true,
  skill: { select: publicSkill },
} as const;
function database() {
  const client = getDatabase();
  if (!client)
    throw new AppError(
      503,
      'DATABASE_NOT_CONFIGURED',
      'The database is not configured. Please contact the administrator.',
    );
  return client;
}
function isMissing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

export class PrismaSkillsRepository implements SkillsRepository {
  listCatalogue(search: string) {
    const normalized = normalizeSkillName(search);
    const fuzzyIds = search ? searchCatalogSkills(search).map((skill) => skill.databaseId) : [];
    return database().skill.findMany({
      where: search
        ? {
            category: { not: 'Custom' },
            OR: [
              { id: { in: fuzzyIds } },
              { name: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
              ...(normalized
                ? [{ normalizedName: { contains: normalized } }, { aliases: { has: normalized } }]
                : []),
            ],
          }
        : { category: { not: 'Custom' } },
      select: publicSkill,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: 100,
    });
  }
  async addCustom(userId: string, name: string, level: Proficiency) {
    return database().$transaction(
      async (tx) => {
        if ((await tx.userSkill.count({ where: { userId } })) >= 3000)
          throw new AppError(422, 'PROFILE_LIMIT', 'Your profile has reached its skill limit.');
        const canonical = await tx.skill.findFirst({
          where: {
            OR: [
              { normalizedName: normalizeSkillName(name) },
              { aliases: { has: normalizeSkillName(name) } },
            ],
          },
        });
        const skill =
          canonical ??
          (await tx.skill.upsert({
            where: { normalizedName: normalizeSkillName(name) },
            create: { name, normalizedName: normalizeSkillName(name), category: 'Custom' },
            update: {},
          }));
        return tx.userSkill.upsert({
          where: { userId_skillId: { userId, skillId: skill.id } },
          create: { userId, skillId: skill.id, level },
          update: {},
          select: profileSkill,
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  findSkill(id: string) {
    return database().skill.findUnique({ where: { id }, select: publicSkill });
  }
  listProfile(userId: string) {
    return database().userSkill.findMany({
      where: { userId },
      select: profileSkill,
      orderBy: { skill: { name: 'asc' } },
    });
  }
  async add(userId: string, skillId: string, level: Proficiency) {
    try {
      return await database().userSkill.create({
        data: { userId, skillId, level },
        select: profileSkill,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new AppError(
          409,
          'SKILL_ALREADY_ADDED',
          'This skill is already in your profile. You can change its level below.',
        );
      throw error;
    }
  }
  async update(userId: string, skillId: string, level: Proficiency) {
    try {
      return await database().userSkill.update({
        where: { userId_skillId: { userId, skillId } },
        data: { level },
        select: profileSkill,
      });
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }
  async remove(userId: string, skillId: string) {
    try {
      await database().userSkill.delete({ where: { userId_skillId: { userId, skillId } } });
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }
}
