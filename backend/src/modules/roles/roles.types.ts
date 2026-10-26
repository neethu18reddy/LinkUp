import type { Proficiency } from '../../generated/prisma/client.js';

export interface CareerRole {
  id: string;
  slug: string;
  title: string;
  description: string;
  requirements: {
    skillId: string;
    requiredLevel: Proficiency;
    weight: number;
    skill: { name: string; category: string };
  }[];
}
export interface RolesRepository {
  list(): Promise<CareerRole[]>;
  find(id: string): Promise<CareerRole | null>;
}
