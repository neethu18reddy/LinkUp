import type { User, RefreshToken } from '../../src/generated/prisma/client.js';
import type { AuthRepository, NewRefreshToken } from '../../src/modules/auth/auth.types.js';
import { AppError } from '../../src/utils/AppError.js';

// Test-only implementation. The production app always uses Prisma.
export class MemoryAuthRepository implements AuthRepository {
  users = new Map<string, User>();
  tokens = new Map<string, RefreshToken>();
  async findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }
  async createUserWithSession(
    input: Parameters<AuthRepository['createUserWithSession']>[0],
    session: NewRefreshToken,
  ) {
    if (await this.findUserByEmail(input.email))
      throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    const user: User = {
      ...input,
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
      remindersEnabled: true,
    };
    this.users.set(user.id, user);
    await this.createSession(session);
    return user;
  }
  async createSession(input: NewRefreshToken, expectedPasswordHash?: string) {
    if (
      expectedPasswordHash !== undefined &&
      this.users.get(input.userId)?.passwordHash !== expectedPasswordHash
    )
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    this.tokens.set(input.tokenHash, { ...input, createdAt: new Date(), revokedAt: null });
  }
  async findRefreshToken(hash: string) {
    return this.tokens.get(hash) ?? null;
  }
  async rotateSession(hash: string, replacement: NewRefreshToken) {
    const previous = this.tokens.get(hash);
    if (!previous || previous.revokedAt || previous.expiresAt.getTime() <= Date.now()) return false;
    previous.revokedAt = new Date();
    await this.createSession(replacement);
    return true;
  }
  async revokeFamily(userId: string, familyId: string) {
    for (const token of this.tokens.values())
      if (token.userId === userId && token.familyId === familyId) token.revokedAt = new Date();
  }
  async findSessionUser(userId: string, familyId: string) {
    const active = [...this.tokens.values()].some(
      (token) =>
        token.userId === userId &&
        token.familyId === familyId &&
        !token.revokedAt &&
        token.expiresAt.getTime() > Date.now(),
    );
    return active ? (this.users.get(userId) ?? null) : null;
  }
}
