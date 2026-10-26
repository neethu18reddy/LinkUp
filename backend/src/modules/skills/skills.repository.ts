import { getDatabase } from '../../config/database.js';
import { Prisma, type Proficiency } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { normalizeSkillName } from './skills.schemas.js';
import type { SkillsRepository } from './skills.types.js';

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
    return database().skill.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
              ...(normalized
                ? [{ normalizedName: { contains: normalized } }, { aliases: { has: normalized } }]
                : []),
            ],
          }
        : undefined,
      select: publicSkill,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: 100,
    });
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
