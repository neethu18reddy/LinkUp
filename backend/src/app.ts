import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { getDatabase } from './config/database.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/AppError.js';
import { failure, success } from './utils/response.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { PrismaAuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { AuthTokens, type AuthSecrets } from './modules/auth/auth.tokens.js';
import type { AuthRepository } from './modules/auth/auth.types.js';

export function createApp(
  options: { authRepository?: AuthRepository; authSecrets?: AuthSecrets } = {},
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin: (origin, callback) => {
        if (!origin || env.CLIENT_URL.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed.'));
      },
    }),
  );
  app.use(pinoHttp({ logger }));
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) =>
        res
          .status(429)
          .json(failure('RATE_LIMITED', 'Too many requests. Please try again shortly.')),
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  const authService = new AuthService(
    options.authRepository ?? new PrismaAuthRepository(),
    new AuthTokens(options.authSecrets),
  );
  app.use('/api/v1/auth', authRoutes(authService));

  app.get('/api/v1/health', (_req, res) => {
    res.json(success({ name: 'linkup', status: 'ok', timestamp: new Date().toISOString() }));
  });

  app.get('/api/v1/health/ready', async (_req, res, next) => {
    const database = getDatabase();
    if (!database) {
      res.status(503).json(failure('DATABASE_NOT_CONFIGURED', 'The database is not configured.'));
      return;
    }
    try {
      await database.$queryRaw`SELECT 1`;
      res.json(success({ status: 'ready', database: 'connected' }));
    } catch (error) {
      logger.warn({ err: error }, 'Database readiness check failed');
      next(new AppError(503, 'DATABASE_UNAVAILABLE', 'The database is temporarily unavailable.'));
    }
  });

  app.use((_req, _res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'This endpoint does not exist.')),
  );
  app.use(errorHandler);
  return app;
}
