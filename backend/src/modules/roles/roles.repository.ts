import { getDatabase } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import type { RolesRepository } from './roles.types.js';
import { rolesByDatabaseId } from '../../catalog/catalog.js';

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
  async list() {
    const roles = await database().roleTemplate.findMany({
      select: roleSelect,
      orderBy: { title: 'asc' },
    });
    return roles.map(enrichRole);
  }
  async find(id: string) {
    const role = await database().roleTemplate.findUnique({ where: { id }, select: roleSelect });
    return role ? enrichRole(role) : null;
  }
}
function enrichRole<T extends { id: string }>(role: T) {
  const metadata = rolesByDatabaseId.get(role.id);
  return {
    ...role,
    ...(metadata
      ? {
          catalogId: metadata.id,
          category: metadata.category,
          trending: metadata.trending,
          demand: metadata.demand,
        }
      : {}),
  };
}
