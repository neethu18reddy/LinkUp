import type { User, RefreshToken } from '../../generated/prisma/client.js';

export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'role' | 'createdAt'>;
export interface AuthPrincipal {
  user: PublicUser;
  familyId: string;
}

export interface AuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  createUserWithSession(
    user: Pick<User, 'id' | 'name' | 'email' | 'passwordHash'>,
    session: NewRefreshToken,
  ): Promise<User>;
  createSession(session: NewRefreshToken): Promise<void>;
  findRefreshToken(hash: string): Promise<RefreshToken | null>;
  rotateSession(hash: string, replacement: NewRefreshToken): Promise<boolean>;
  revokeFamily(userId: string, familyId: string): Promise<void>;
  findSessionUser(userId: string, familyId: string): Promise<User | null>;
}

export type NewRefreshToken = Pick<
  RefreshToken,
  'id' | 'userId' | 'tokenHash' | 'familyId' | 'expiresAt'
>;

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthPrincipal;
  }
}
