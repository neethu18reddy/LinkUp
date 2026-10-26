import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError.js';
import type { AuthService } from '../modules/auth/auth.service.js';
import type { PublicUser } from '../modules/auth/auth.types.js';

export function requireAuth(service: AuthService): RequestHandler {
  return (req, _res, next) => {
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match?.[1]) {
      next(new AppError(401, 'AUTH_REQUIRED', 'Please sign in to continue.'));
      return;
    }
    void service
      .authenticate(match[1])
      .then((principal) => {
        req.auth = principal;
        next();
      })
      .catch(next);
  };
}

export function requireRole(...roles: PublicUser['role'][]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(new AppError(401, 'AUTH_REQUIRED', 'Please sign in to continue.'));
      return;
    }
    if (!roles.includes(req.auth.user.role)) {
      next(new AppError(403, 'FORBIDDEN', 'You do not have access to this resource.'));
      return;
    }
    next();
  };
}

export function assertOwnership(ownerId: string, userId: string) {
  if (ownerId !== userId)
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this resource.');
}
