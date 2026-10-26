import type { CookieOptions, RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { success } from '../../utils/response.js';
import type { AuthService } from './auth.service.js';

export const REFRESH_COOKIE = 'linkup_refresh';
export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/v1/auth',
};

function readRefresh(cookies: unknown): string | undefined {
  if (typeof cookies !== 'object' || cookies === null || !(REFRESH_COOKIE in cookies))
    return undefined;
  const value = (cookies as Record<string, unknown>)[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

export function authController(service: AuthService) {
  function sessionAction(action: 'register' | 'login' | 'refresh'): RequestHandler {
    return (req, res, next) => {
      const pending =
        action === 'refresh'
          ? service.refresh(readRefresh(req.cookies))
          : service[action](req.body);
      void pending
        .then((result) => {
          res.cookie(REFRESH_COOKIE, result.refreshToken, {
            ...cookieOptions,
            maxAge: Math.max(0, result.session.expiresAt.getTime() - Date.now()),
          });
          res.status(action === 'register' ? 201 : 200).json(
            success({
              user: result.user,
              accessToken: result.accessToken,
              expiresIn: result.expiresIn,
            }),
          );
        })
        .catch((error: unknown) => {
          if (action === 'refresh' && error instanceof AppError && error.statusCode === 401)
            res.clearCookie(REFRESH_COOKIE, cookieOptions);
          next(error);
        });
    };
  }

  const logout: RequestHandler = (req, res, next) => {
    void service
      .logout(readRefresh(req.cookies))
      .then(() => {
        res.clearCookie(REFRESH_COOKIE, cookieOptions);
        res.json(success({ message: 'You have been signed out.' }));
      })
      .catch(next);
  };
  const me: RequestHandler = (req, res) => res.json(success({ user: req.auth!.user }));
  return {
    register: sessionAction('register'),
    login: sessionAction('login'),
    refresh: sessionAction('refresh'),
    logout,
    me,
  };
}
