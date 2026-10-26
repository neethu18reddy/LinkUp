import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/AppError.js';
import { failure } from '../../utils/response.js';
import { authController } from './auth.controller.js';
import { emptyBodySchema, loginSchema, registerSchema } from './auth.schemas.js';
import type { AuthService } from './auth.service.js';

export function authRoutes(service: AuthService) {
  const router = Router();
  const controller = authController(service);
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use((req, _res, next) => {
    if (req.method !== 'GET' && req.get('X-Linkup-Request') !== '1') {
      next(
        new AppError(
          403,
          'REQUEST_NOT_ALLOWED',
          'Use the linkup application to submit this request.',
        ),
      );
      return;
    }
    next();
  });
  const credentialsLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res
        .status(429)
        .json(
          failure(
            'AUTH_RATE_LIMITED',
            'Too many sign-in attempts. Please try again in 15 minutes.',
          ),
        ),
  });
  const refreshLimit = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res
        .status(429)
        .json(failure('AUTH_RATE_LIMITED', 'Too many session requests. Please try again shortly.')),
  });
  router.post('/register', credentialsLimit, validate(registerSchema), controller.register);
  router.post('/login', credentialsLimit, validate(loginSchema), controller.login);
  router.post('/refresh', refreshLimit, validate(emptyBodySchema), controller.refresh);
  router.post('/logout', refreshLimit, validate(emptyBodySchema), controller.logout);
  router.get('/me', requireAuth(service), controller.me);
  return router;
}
