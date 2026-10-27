import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { getDatabase } from '../../config/database.js';
import { configuredEmailProvider } from '../../email/email.provider.js';
import { configuredMentorProvider } from '../../ai/mentor.groq.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { success } from '../../utils/response.js';
import { REFRESH_COOKIE, cookieOptions } from './auth.controller.js';
import type { AuthService } from './auth.service.js';
import { AccountService } from './account.service.js';
import { GoogleService } from './google.service.js';
import { forgotSchema, resetSchema, tokenSchema } from './account.schemas.js';

export function accountRoutes(auth: AuthService) {
  const router = Router();
  const email = configuredEmailProvider();
  const origin = env.PUBLIC_WEB_URL ?? env.CLIENT_URL[0]!;
  const db = () => {
    const value = getDatabase();
    if (!value)
      throw new AppError(503, 'DATABASE_NOT_CONFIGURED', 'The database is not configured.');
    return value;
  };
  const account = () => new AccountService(db(), origin, email);
  const google = () => {
    if (!env.GOOGLE_OAUTH_ENABLED)
      throw new AppError(503, 'GOOGLE_DISABLED', 'Google sign-in is not configured yet.');
    return new GoogleService(
      db(),
      origin,
      env.GOOGLE_CLIENT_ID!,
      env.GOOGLE_CLIENT_SECRET!,
      env.JWT_ACCESS_SECRET!,
    );
  };
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/auth/options', (_req, res) =>
    res.json(
      success({
        googleEnabled: env.GOOGLE_OAUTH_ENABLED,
        emailEnabled: !!email,
        mentorMode: configuredMentorProvider().mode,
      }),
    ),
  );
  const limit = rateLimit({
    windowMs: 15 * 60000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  router.use(
    [
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/verify-email',
      '/auth/request-verification',
    ],
    limit,
    (req, _res, next) => {
      if (req.get('X-Linkup-Request') !== '1')
        return next(
          new AppError(
            403,
            'REQUEST_NOT_ALLOWED',
            'Use the linkup application to submit this request.',
          ),
        );
      next();
    },
  );
  router.post(
    '/auth/forgot-password',
    validate(forgotSchema),
    asyncHandler(async (req, res) => {
      if (!email)
        throw new AppError(503, 'EMAIL_DISABLED', 'Email features are not configured yet.');
      const started = Date.now();
      const task = account()
        .request(req.body.email, 'RESET')
        .catch(() => {});
      if (process.env.VERCEL === '1') waitUntil(task);
      else void task;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 500 - (Date.now() - started))),
      );
      res.json(
        success({
          message:
            'If this address has an account, a reset link will be sent. Check your inbox and spam folder.',
        }),
      );
    }),
  );
  router.post(
    '/auth/reset-password',
    validate(resetSchema),
    asyncHandler(async (req, res) => {
      await account().consume(req.body.token, req.body.password);
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      res.json(success({ message: 'Password updated. Sign in again on each device.' }));
    }),
  );
  router.post(
    '/auth/verify-email',
    validate(tokenSchema),
    asyncHandler(async (req, res) => {
      await account().consume(req.body.token);
      res.json(success({ message: 'Your email is verified.' }));
    }),
  );
  router.get(
    '/account/status',
    requireAuth(auth),
    asyncHandler(async (req, res) => {
      res.json(success(await account().status(req.auth!.user.id)));
    }),
  );
  router.post(
    '/auth/request-verification',
    requireAuth(auth),
    validate(z.strictObject({})),
    asyncHandler(async (req, res) => {
      await account().request(req.auth!.user.email, 'VERIFY', req.auth!.user.id);
      res.json(
        success({
          message:
            'If verification is needed, a link will be sent. Check your inbox and spam folder.',
        }),
      );
    }),
  );
  const stateCookie = 'linkup_google_state';
  const googleCookie = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/v1/auth/google',
    maxAge: 10 * 60000,
  };
  router.get(
    '/auth/google/start',
    limit,
    asyncHandler(async (_req, res) => {
      const result = await google().start();
      res.cookie(stateCookie, result.cookie, googleCookie);
      res.redirect(result.url);
    }),
  );
  router.get(
    '/auth/google/callback',
    limit,
    asyncHandler(async (req, res) => {
      res.clearCookie(stateCookie, googleCookie);
      try {
        const query = z
          .object({ code: z.string().min(1).max(4096), state: z.string().length(64) })
          .parse(req.query);
        const user = await google().complete(req.cookies?.[stateCookie], query.state, query.code);
        const session = await auth.externalSession(user);
        res.cookie(REFRESH_COOKIE, session.refreshToken, {
          ...cookieOptions,
          maxAge: Math.max(0, session.session.expiresAt.getTime() - Date.now()),
        });
        res.redirect(new URL('/dashboard', origin).href);
      } catch (error) {
        const code =
          error instanceof AppError && error.code === 'GOOGLE_ACCOUNT_EXISTS'
            ? 'existing-account'
            : 'failed';
        res.redirect(new URL(`/login?google=${code}`, origin).href);
      }
    }),
  );
  return router;
}
