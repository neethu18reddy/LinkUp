import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import type { NewRefreshToken } from './auth.types.js';

export const ACCESS_SECONDS = 15 * 60;
export const REFRESH_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
export interface AuthSecrets {
  access: string;
  refresh: string;
}

const claimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  jti: z.uuid(),
  kind: z.enum(['access', 'refresh']),
  exp: z.number(),
});

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export class AuthTokens {
  constructor(private readonly secrets?: AuthSecrets) {}

  private configuration(): AuthSecrets {
    const secrets =
      this.secrets ??
      (env.JWT_ACCESS_SECRET && env.JWT_REFRESH_SECRET
        ? { access: env.JWT_ACCESS_SECRET, refresh: env.JWT_REFRESH_SECRET }
        : undefined);
    if (!secrets)
      throw new AppError(
        503,
        'AUTH_NOT_CONFIGURED',
        'Authentication is not configured. Please contact the administrator.',
      );
    return secrets;
  }

  issue(userId: string, familyId: string, expiresAt = new Date(Date.now() + REFRESH_MILLISECONDS)) {
    const secrets = this.configuration();
    const id = randomUUID();
    const accessToken = jwt.sign({ sid: familyId, kind: 'access' }, secrets.access, {
      algorithm: 'HS256',
      issuer: 'linkup',
      audience: 'linkup:access',
      subject: userId,
      jwtid: randomUUID(),
      expiresIn: ACCESS_SECONDS,
    });
    const refreshToken = jwt.sign(
      { sid: familyId, kind: 'refresh', exp: Math.floor(expiresAt.getTime() / 1000) },
      secrets.refresh,
      {
        algorithm: 'HS256',
        issuer: 'linkup',
        audience: 'linkup:refresh',
        subject: userId,
        jwtid: id,
      },
    );
    const session: NewRefreshToken = {
      id,
      userId,
      familyId,
      expiresAt,
      tokenHash: hashToken(refreshToken),
    };
    return { accessToken, refreshToken, session, expiresIn: ACCESS_SECONDS };
  }

  verify(token: string, kind: 'access' | 'refresh') {
    const secrets = this.configuration();
    try {
      const decoded = jwt.verify(token, secrets[kind], {
        algorithms: ['HS256'],
        issuer: 'linkup',
        audience: `linkup:${kind}`,
      });
      const claims = claimsSchema.parse(decoded);
      if (claims.kind !== kind) throw new Error('Token type mismatch');
      return claims;
    } catch {
      throw new AppError(401, 'INVALID_SESSION', 'Your session has expired. Please sign in again.');
    }
  }
}
