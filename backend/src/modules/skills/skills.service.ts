import type { Proficiency } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import type { SkillsRepository } from './skills.types.js';

export class SkillsService {
  constructor(private readonly repository: SkillsRepository) {}
  catalogue(search: string) {
    return this.repository.listCatalogue(search);
  }
  profile(userId: string) {
    return this.repository.listProfile(userId);
  }
  custom(userId: string, name: string, level: Proficiency) {
    if (!this.repository.addCustom)
      throw new AppError(503, 'CUSTOM_SKILLS_UNAVAILABLE', 'Custom skills are unavailable.');
    return this.repository.addCustom(userId, name, level);
  }
  async add(userId: string, skillId: string, level: Proficiency) {
    if (!(await this.repository.findSkill(skillId)))
      throw new AppError(
        404,
        'SKILL_NOT_FOUND',
        'This skill is not in the catalogue. Please choose another.',
      );
    return this.repository.add(userId, skillId, level);
  }
  async update(userId: string, skillId: string, level: Proficiency) {
    const skill = await this.repository.update(userId, skillId, level);
    if (!skill)
      throw new AppError(404, 'PROFILE_SKILL_NOT_FOUND', 'This skill is not in your profile.');
    return skill;
  }
  async remove(userId: string, skillId: string) {
    if (!(await this.repository.remove(userId, skillId)))
      throw new AppError(404, 'PROFILE_SKILL_NOT_FOUND', 'This skill is not in your profile.');
    return { skillId };
  }
}
