import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { User } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/AppError.js';
import { AuthTokens, hashToken } from './auth.tokens.js';
import type { AuthRepository, PublicUser } from './auth.types.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const dummyHash = bcrypt.hash('invalid-account-timing-placeholder', 12);
const invalidSession = () =>
  new AppError(401, 'INVALID_SESSION', 'Your session has expired. Please sign in again.');

export function publicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly tokens: AuthTokens,
  ) {}

  async register(input: RegisterInput) {
    const id = randomUUID();
    const issued = this.tokens.issue(id, randomUUID());
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.repository.createUserWithSession(
      { id, email: input.email, name: input.name, passwordHash },
      issued.session,
    );
    return { ...issued, user: publicUser(user) };
  }

  async login(input: LoginInput) {
    const user = await this.repository.findUserByEmail(input.email);
    const matches = await bcrypt.compare(input.password, user?.passwordHash ?? (await dummyHash));
    if (!user || !matches)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const issued = this.tokens.issue(user.id, randomUUID());
    await this.repository.createSession(issued.session);
    return { ...issued, user: publicUser(user) };
  }

  async refresh(token: string | undefined) {
    if (!token) throw invalidSession();
    const claims = this.tokens.verify(token, 'refresh');
    const record = await this.repository.findRefreshToken(hashToken(token));
    if (
      !record ||
      record.id !== claims.jti ||
      record.userId !== claims.sub ||
      record.familyId !== claims.sid
    )
      throw invalidSession();
    if (record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
      await this.repository.revokeFamily(record.userId, record.familyId);
      throw invalidSession();
    }
    const user = await this.repository.findSessionUser(record.userId, record.familyId);
    if (!user) throw invalidSession();
    const issued = this.tokens.issue(user.id, record.familyId, record.expiresAt);
    if (!(await this.repository.rotateSession(record.tokenHash, issued.session))) {
      await this.repository.revokeFamily(record.userId, record.familyId);
      throw invalidSession();
    }
    return { ...issued, user: publicUser(user) };
  }

  async authenticate(token: string) {
    const claims = this.tokens.verify(token, 'access');
    const user = await this.repository.findSessionUser(claims.sub, claims.sid);
    if (!user) throw invalidSession();
    return { user: publicUser(user), familyId: claims.sid };
  }

  async logout(token: string | undefined) {
    if (!token) return;
    let claims;
    try {
      claims = this.tokens.verify(token, 'refresh');
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 401) return;
      throw error;
    }
    // A signed token identifies the session family even if it has already been rotated.
    await this.repository.revokeFamily(claims.sub, claims.sid);
  }
}
