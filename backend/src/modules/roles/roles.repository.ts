import { getDatabase } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import type { RolesRepository } from './roles.types.js';

const roleSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  requirements: {
    select: {
      skillId: true,
      requiredLevel: true,
      weight: true,
      skill: { select: { name: true, category: true } },
    },
    orderBy: { skill: { name: 'asc' as const } },
  },
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
export class PrismaRolesRepository implements RolesRepository {
  list() {
    return database().roleTemplate.findMany({ select: roleSelect, orderBy: { title: 'asc' } });
  }
  find(id: string) {
    return database().roleTemplate.findUnique({ where: { id }, select: roleSelect });
  }
}
