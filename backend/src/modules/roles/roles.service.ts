import { AppError } from '../../utils/AppError.js';
import type { RolesRepository } from './roles.types.js';

export class RolesService {
  constructor(private readonly repository: RolesRepository) {}
  list() {
    return this.repository.list();
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
