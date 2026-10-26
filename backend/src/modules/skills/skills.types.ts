import type { Proficiency } from '../../generated/prisma/client.js';

export interface CatalogueSkill {
  id: string;
  name: string;
  category: string;
}
export interface ProfileSkill {
  skillId: string;
  level: Proficiency;
  createdAt: Date;
  updatedAt: Date;
  skill: CatalogueSkill;
}
export interface SkillsRepository {
  listCatalogue(search: string): Promise<CatalogueSkill[]>;
  findSkill(id: string): Promise<CatalogueSkill | null>;
  listProfile(userId: string): Promise<ProfileSkill[]>;
  add(userId: string, skillId: string, level: Proficiency): Promise<ProfileSkill>;
  update(userId: string, skillId: string, level: Proficiency): Promise<ProfileSkill | null>;
  remove(userId: string, skillId: string): Promise<boolean>;
}
