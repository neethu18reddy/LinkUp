import { getDatabase } from '../../config/database.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { isTransactionConflict } from '../../utils/transactionConflict.js';
export function studioDb() {
  const db = getDatabase();
  if (!db) throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'The database is not configured.');
  return db;
}
export async function studioTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await studioDb().$transaction(fn, { isolationLevel: 'Serializable', timeout: 20000 });
    } catch (error) {
      if (isTransactionConflict(error) && attempt < 3) continue;
      throw error;
    }
  }
}
export async function studioSettings(userId: string) {
  return studioDb().userSettings.upsert({ where: { userId }, create: { userId }, update: {} });
}
export async function ownedResource(
  userId: string,
  id: string,
  tx: Prisma.TransactionClient = studioDb(),
) {
  const resource = await tx.studioResource.findFirst({ where: { id, userId } });
  if (!resource) throw new AppError(404, 'RESOURCE_NOT_FOUND', 'Learning resource not found.');
  return resource;
}
export async function ownedItem(
  userId: string,
  id: string,
  tx: Prisma.TransactionClient = studioDb(),
) {
  const item = await tx.resourceItem.findFirst({
    where: { id, resource: { userId } },
    include: { section: { include: { skills: true } } },
  });
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Learning item not found.');
  return item;
}
