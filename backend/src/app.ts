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
import { accountRoutes } from './modules/auth/account.routes.js';
import { PrismaAuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { AuthTokens, type AuthSecrets } from './modules/auth/auth.tokens.js';
import type { AuthRepository } from './modules/auth/auth.types.js';
import { skillsRoutes } from './modules/skills/skills.routes.js';
import { SkillsService } from './modules/skills/skills.service.js';
import { PrismaSkillsRepository } from './modules/skills/skills.repository.js';
import type { SkillsRepository } from './modules/skills/skills.types.js';
import { rolesRoutes } from './modules/roles/roles.routes.js';
import { RolesService } from './modules/roles/roles.service.js';
import { PrismaRolesRepository } from './modules/roles/roles.repository.js';
import type { RolesRepository } from './modules/roles/roles.types.js';
import { quizRoutes } from './modules/quiz/quiz.routes.js';
import { QuizService } from './modules/quiz/quiz.service.js';
import { PrismaQuizRepository } from './modules/quiz/quiz.repository.js';
import type { QuizRepository } from './modules/quiz/quiz.types.js';
import { goalsRoutes } from './modules/goals/goals.routes.js';
import { GoalsService } from './modules/goals/goals.service.js';
import { PrismaGoalsRepository } from './modules/goals/goals.repository.js';
import type { GoalsRepository } from './modules/goals/goals.types.js';
import {
  PrismaRoadmapRepository,
  type RoadmapRepository,
} from './modules/roadmap/roadmap.repository.js';
import { RoadmapService } from './modules/roadmap/roadmap.service.js';
import { roadmapRoutes } from './modules/roadmap/roadmap.routes.js';
import { configuredProvider, type LLMProvider } from './ai/roadmap.provider.js';
import { PrismaPlanRepository, type PlanRepository } from './modules/plan/plan.repository.js';
import { PlanService } from './modules/plan/plan.service.js';
import { planRoutes } from './modules/plan/plan.routes.js';
import { PrismaProgressRepository } from './modules/progress/progress.repository.js';
import type { ProgressRepository } from './modules/progress/progress.types.js';
import { ProgressService } from './modules/progress/progress.service.js';
import { progressRoutes } from './modules/progress/progress.routes.js';
import { PrismaChatRepository } from './modules/chat/chat.repository.js';
import type { ChatRepository } from './modules/chat/chat.types.js';
import { ChatService } from './modules/chat/chat.service.js';
import { chatRoutes } from './modules/chat/chat.routes.js';
import type { MentorProvider } from './ai/mentor.provider.js';
import { configuredMentorProvider } from './ai/mentor.groq.js';
import { fileURLToPath } from 'node:url';
import { documentationRoutes } from './docs/docs.routes.js';
import { serveWeb } from './web.js';
import { WeeklyJob } from './jobs/weekly.js';
import { dailyRoutes } from './jobs/daily.routes.js';
import { PrismaNotificationRepository } from './modules/notifications/notifications.repository.js';
import type { NotificationRepository } from './modules/notifications/notifications.types.js';
import { notificationRoutes } from './modules/notifications/notifications.routes.js';
import { certificateRoutes } from './modules/certificates/certificates.routes.js';
import {
  PrismaCertificateRepository,
  type CertificateRepository,
} from './modules/certificates/certificates.repository.js';

export function createApp(
  options: {
    authRepository?: AuthRepository;
    authSecrets?: AuthSecrets;
    skillsRepository?: SkillsRepository;
    rolesRepository?: RolesRepository;
    quizRepository?: QuizRepository;
    goalsRepository?: GoalsRepository;
    roadmapRepository?: RoadmapRepository;
    roadmapProvider?: LLMProvider | null;
    planRepository?: PlanRepository;
    progressRepository?: ProgressRepository;
    chatRepository?: ChatRepository;
    mentorProvider?: MentorProvider;
    webRoot?: string;
    notificationRepository?: NotificationRepository;
    weeklyJob?: WeeklyJob;
    cronSecret?: string;
    certificateRepository?: CertificateRepository;
  } = {},
) {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY_HOPS) app.set('trust proxy', env.TRUST_PROXY_HOPS);
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
  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: String(req.url).split('?')[0],
            remoteAddress: req.remoteAddress,
          };
        },
      },
    }),
  );
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
  app.use('/api', documentationRoutes());
  const authService = new AuthService(
    options.authRepository ?? new PrismaAuthRepository(),
    new AuthTokens(options.authSecrets),
  );
  app.use('/api/v1/auth', authRoutes(authService));
  app.use('/api/v1', accountRoutes(authService));
  app.use('/api/v1', dailyRoutes());
  const notifications = options.notificationRepository ?? new PrismaNotificationRepository();
  app.use(
    '/api/v1',
    notificationRoutes(
      notifications,
      options.weeklyJob ?? new WeeklyJob(notifications),
      authService,
      options.cronSecret ?? env.CRON_SECRET,
    ),
  );
  app.use(
    '/api/v1',
    certificateRoutes(
      options.certificateRepository ?? new PrismaCertificateRepository(),
      authService,
    ),
  );
  app.use(
    '/api/v1',
    chatRoutes(
      new ChatService(
        options.chatRepository ?? new PrismaChatRepository(),
        options.progressRepository ?? new PrismaProgressRepository(),
        options.skillsRepository ?? new PrismaSkillsRepository(),
        options.mentorProvider ?? configuredMentorProvider(),
      ),
      authService,
    ),
  );
  app.use(
    '/api/v1',
    progressRoutes(
      new ProgressService(options.progressRepository ?? new PrismaProgressRepository()),
      authService,
    ),
  );
  app.use(
    '/api/v1',
    planRoutes(new PlanService(options.planRepository ?? new PrismaPlanRepository()), authService),
  );
  const rolesService = new RolesService(options.rolesRepository ?? new PrismaRolesRepository());
  app.use(
    '/api/v1',
    roadmapRoutes(
      new RoadmapService(
        options.roadmapRepository ?? new PrismaRoadmapRepository(),
        options.goalsRepository ?? new PrismaGoalsRepository(),
        options.rolesRepository ?? new PrismaRolesRepository(),
        options.skillsRepository ?? new PrismaSkillsRepository(),
        options.roadmapProvider === null
          ? undefined
          : (options.roadmapProvider ?? configuredProvider()),
      ),
      authService,
    ),
  );
  const quizService = new QuizService(
    options.quizRepository ?? new PrismaQuizRepository(),
    rolesService,
  );
  const goalsService = new GoalsService(
    options.goalsRepository ?? new PrismaGoalsRepository(),
    rolesService,
    quizService,
  );
  app.use(
    '/api/v1',
    rolesRoutes(rolesService),
    quizRoutes(quizService, authService),
    goalsRoutes(goalsService, authService),
  );
  app.use(
    '/api/v1',
    skillsRoutes(
      new SkillsService(options.skillsRepository ?? new PrismaSkillsRepository()),
      authService,
    ),
  );

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

  if (options.webRoot || env.SERVE_WEB)
    serveWeb(
      app,
      options.webRoot ?? fileURLToPath(new URL('../../frontend/dist/', import.meta.url)),
    );
  app.use((_req, _res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'This endpoint does not exist.')),
  );
  app.use(errorHandler);
  return app;
}
