import { AppError } from '../../utils/AppError.js';
import type { RolesRepository } from './roles.types.js';
import { rolesByDatabaseId, categories } from '../../catalog/catalog.js';

export class RolesService {
  constructor(private readonly repository: RolesRepository) {}
  list() {
    return this.repository.list();
  }
  async summaries() {
    return (await this.repository.list()).map((role) => {
      const metadata = rolesByDatabaseId.get(role.id);
      return {
        ...role,
        requirements: [],
        skillCount: role.requirements.length,
        categoryName: categories.find((category) => category.id === metadata?.category)?.name,
        coreSkillCount:
          metadata?.skills.filter((row) => row.importance === 'core').length ??
          role.requirements.length,
      };
    });
  }
  async find(id: string) {
    const role = await this.repository.find(id);
    if (!role)
      throw new AppError(
        404,
        'ROLE_NOT_FOUND',
        'This role is not available. Please choose another.',
      );
    return role;
  }
}
