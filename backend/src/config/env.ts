import 'dotenv/config';
import { z } from 'zod';

const webOrigin = z
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname === '/'
      );
    } catch {
      return false;
    }
  }, 'Use an HTTP(S) origin without credentials or a path.')
  .transform((value) => new URL(value).origin);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.url().optional(),
    SERVE_WEB: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    CRON_SECRET: z.preprocess((value) => value || undefined, z.string().min(32).optional()),
    LOCAL_JOBS_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    PUBLIC_WEB_URL: webOrigin.optional(),
    CLIENT_URL: z
      .string()
      .default('http://localhost:5173,http://127.0.0.1:5173')
      .transform((value) => value.split(',').map((origin) => origin.trim()))
      .pipe(z.array(webOrigin).min(1)),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    LLM_PROVIDER: z.enum(['disabled', 'groq']).default('disabled'),
    LLM_LIVE_CALLS_APPROVED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    LLM_MODEL: z.string().default(''),
    GROQ_API_KEY: z.string().optional(),
    JWT_ACCESS_SECRET: z.preprocess((value) => value || undefined, z.string().min(32).optional()),
    JWT_REFRESH_SECRET: z.preprocess((value) => value || undefined, z.string().min(32).optional()),
  })
  .superRefine((value, ctx) => {
    if (value.JWT_ACCESS_SECRET && value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'Use distinct secrets.',
      });
    }
    if (value.NODE_ENV === 'production') {
      if (
        value.SERVE_WEB &&
        (!value.PUBLIC_WEB_URL || !value.CLIENT_URL.includes(value.PUBLIC_WEB_URL))
      )
        ctx.addIssue({
          code: 'custom',
          path: ['PUBLIC_WEB_URL'],
          message:
            'Serving the production frontend requires a canonical origin included in CLIENT_URL.',
        });
      for (const key of ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
        if (!value[key])
          ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production.' });
      }
    }
  });

export type Environment = z.infer<typeof envSchema>;

export function parseEnv(input: NodeJS.ProcessEnv): Environment {
  const renderOrigin = input.RENDER === 'true' ? input.RENDER_EXTERNAL_URL : undefined;
  const vercelOrigin =
    input.VERCEL === '1' && input.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${input.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined;
  const result = envSchema.safeParse({
    ...input,
    CLIENT_URL: input.CLIENT_URL || vercelOrigin || renderOrigin,
    PUBLIC_WEB_URL: input.PUBLIC_WEB_URL || vercelOrigin || renderOrigin,
  });
  if (!result.success) {
    // Report field names, never values that may contain credentials.
    throw new Error(
      `Invalid environment configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  }
  return result.data;
}

export const env = parseEnv(process.env);
