import type { Proficiency } from '../../src/generated/prisma/client.js';
import type {
  CatalogueSkill,
  ProfileSkill,
  SkillsRepository,
} from '../../src/modules/skills/skills.types.js';
import { normalizeSkillName } from '../../src/modules/skills/skills.schemas.js';
import { AppError } from '../../src/utils/AppError.js';

export const reactSkill: CatalogueSkill = {
  id: '00000000-0000-4000-8000-000000000005',
  name: 'React',
  category: 'Frontend',
};
export const pythonSkill: CatalogueSkill = {
  id: '00000000-0000-4000-8000-000000000015',
  name: 'Python',
  category: 'Languages',
};
export class MemorySkillsRepository implements SkillsRepository {
  catalogue = [reactSkill, pythonSkill];
  profiles = new Map<string, ProfileSkill>();
  async listCatalogue(search: string) {
    return this.catalogue.filter(
      (skill) =>
        normalizeSkillName(skill.name).includes(normalizeSkillName(search)) ||
        skill.category.toLowerCase().includes(search.toLowerCase()) ||
        (skill.id === reactSkill.id && normalizeSkillName(search) === 'reactjs'),
    );
  }
  async findSkill(id: string) {
    return this.catalogue.find((skill) => skill.id === id) ?? null;
  }
  async listProfile(userId: string) {
    return [...this.profiles.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, value]) => value);
  }
  async add(userId: string, skillId: string, level: Proficiency) {
    const key = `${userId}:${skillId}`;
    if (this.profiles.has(key))
      throw new AppError(409, 'SKILL_ALREADY_ADDED', 'This skill is already in your profile.');
    const skill = (await this.findSkill(skillId))!;
    const result = { skillId, level, createdAt: new Date(), updatedAt: new Date(), skill };
    this.profiles.set(key, result);
    return result;
  }
  async update(userId: string, skillId: string, level: Proficiency) {
    const previous = this.profiles.get(`${userId}:${skillId}`);
    if (!previous) return null;
    const updated = { ...previous, level, updatedAt: new Date() };
    this.profiles.set(`${userId}:${skillId}`, updated);
    return updated;
  }
  async remove(userId: string, skillId: string) {
    return this.profiles.delete(`${userId}:${skillId}`);
  }
}
