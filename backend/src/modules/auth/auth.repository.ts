import { Prisma } from '../../generated/prisma/client.js';
import { getDatabase } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import type { AuthRepository, NewRefreshToken } from './auth.types.js';

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

async function serializable<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await database().$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
}

export class PrismaAuthRepository implements AuthRepository {
  findUserByEmail(email: string) {
    return database().user.findUnique({ where: { email } });
  }

  async createUserWithSession(
    user: Parameters<AuthRepository['createUserWithSession']>[0],
    session: NewRefreshToken,
  ) {
    try {
      return await database().$transaction(async (tx) => {
        const created = await tx.user.create({ data: user });
        await tx.refreshToken.create({ data: session });
        return created;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
      }
      throw error;
    }
  }

  async createSession(session: NewRefreshToken, expectedPasswordHash?: string) {
    if (expectedPasswordHash !== undefined) {
      await database().$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          { passwordHash: string }[]
        >`SELECT "passwordHash" FROM "User" WHERE "id" = ${session.userId}::uuid FOR UPDATE`;
        if (rows[0]?.passwordHash !== expectedPasswordHash)
          throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
        await tx.refreshToken.create({ data: session });
      });
      return;
    }
    await database().refreshToken.create({ data: session });
  }
  findRefreshToken(tokenHash: string) {
    return database().refreshToken.findUnique({ where: { tokenHash } });
  }

  rotateSession(tokenHash: string, replacement: NewRefreshToken) {
    return serializable(async (tx) => {
      const updated = await tx.refreshToken.updateMany({
        where: {
          tokenHash,
          userId: replacement.userId,
          familyId: replacement.familyId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });
      if (updated.count !== 1) return false;
      await tx.refreshToken.create({ data: replacement });
      return true;
    });
  }

  async revokeFamily(userId: string, familyId: string) {
    await serializable(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId, familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async findSessionUser(userId: string, familyId: string) {
    const session = await database().refreshToken.findFirst({
      where: { userId, familyId, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    return session?.user ?? null;
  }
}
