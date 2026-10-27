import { z } from 'zod';
import { registerSchema, loginSchema } from '../modules/auth/auth.schemas.js';
import {
  addSkillSchema,
  updateSkillSchema,
  catalogueQuerySchema,
} from '../modules/skills/skills.schemas.js';
import { createGoalSchema } from '../modules/goals/goals.schemas.js';
import { quizSubmitSchema } from '../modules/quiz/quiz.schemas.js';
import { generationSchema } from '../modules/roadmap/roadmap.schemas.js';
import { planSettingsSchema, savePlanSchema } from '../modules/plan/plan.schemas.js';
import {
  logSchema,
  logQuerySchema,
  projectSchema,
  taskSchema,
} from '../modules/progress/progress.schemas.js';
import { messageSchema, historySchema, deleteHistorySchema } from '../modules/chat/chat.schemas.js';
const paths: Record<string, Record<string, unknown>> = {};
const empty = z.strictObject({}),
  uuid = z.uuid();
function schema(value: z.ZodType) {
  return z.toJSONSchema(value, { target: 'openapi-3.0', io: 'input' });
}
function add(
  method: string,
  path: string,
  tag: string,
  summary: string,
  options: {
    body?: z.ZodType;
    query?: z.ZodObject;
    public?: boolean;
    code?: number;
    description?: string;
    media?: string;
    job?: boolean;
    authHeader?: boolean;
  } = {},
) {
  const parameters: object[] = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    schema:
      match[1] === 'code'
        ? { type: 'string', pattern: '^[a-f0-9]{64}$' }
        : { type: 'string', format: 'uuid' },
  }));
  if (options.query) {
    const query = schema(options.query);
    for (const [name, value] of Object.entries(query.properties ?? {}))
      parameters.push({
        name,
        in: 'query',
        required: query.required?.includes(name) ?? false,
        schema: value,
      });
  }
  if (options.authHeader)
    parameters.push({
      name: 'X-Linkup-Request',
      in: 'header',
      required: true,
      schema: { type: 'string', enum: ['1'] },
    });
  const responses: Record<string, unknown> = {};
  for (const code of [400, 401, 403, 404, 409, 413, 422, 429, 500, 503])
    responses[code] = {
      description:
        'Typed failure: JSON validation, authentication, ownership, state conflict, quota or service availability. See error.code/message.',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    };
  responses[options.code ?? 200] = {
    description: 'Success',
    content: {
      [options.media ?? 'application/json']: {
        schema: options.media
          ? { type: 'string', ...(options.media === 'application/pdf' ? { format: 'binary' } : {}) }
          : { $ref: '#/components/schemas/Success' },
      },
    },
  };
  paths[path] ??= {};
  paths[path]![method] = {
    operationId: `${method}_${path.replace(/[^a-z0-9]/gi, '_')}`,
    tags: [tag],
    summary,
    description:
      options.description ??
      'Owned resources are scoped to the signed-in account. Runtime cross-field rules supplement these input schemas.',
    security: options.public ? [] : options.job ? [{ cronBearer: [] }] : [{ bearerAuth: [] }],
    parameters,
    ...(options.body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: schema(options.body) } },
          },
        }
      : {}),
    responses,
  };
}
add('get', '/health', 'Health', 'API liveness', { public: true });
add('get', '/health/ready', 'Health', 'PostgreSQL readiness', { public: true });
add('post', '/auth/register', 'Accounts', 'Register and start a session', {
  public: true,
  body: registerSchema,
  code: 201,
  authHeader: true,
  description:
    'Returns user, accessToken, expiresIn; sets an httpOnly refresh cookie. Keep access JWTs in memory. Passwords use bcrypt. Register/login share 20 attempts/IP/15 minutes.',
});
add('post', '/auth/login', 'Accounts', 'Sign in', {
  public: true,
  body: loginSchema,
  authHeader: true,
  description:
    'Returns user, accessToken, expiresIn and sets the refresh cookie. Same-origin browser clients send credentials.',
});
for (const action of ['refresh', 'logout'])
  add('post', `/auth/${action}`, 'Accounts', `${action} the session`, {
    public: true,
    body: empty,
    authHeader: true,
    description:
      'Uses linkup_refresh cookie at /api/v1/auth. Refresh rotates tokens and detects replay; logout revokes the family. Thirty requests/IP/minute.',
  });
add('get', '/auth/me', 'Accounts', 'Read current public profile');
add('get', '/skills', 'Skills', 'Search skill catalogue', {
  public: true,
  query: catalogueQuerySchema,
});
add('get', '/me/skills', 'Skills', 'List owned skills');
add('post', '/me/skills', 'Skills', 'Add proficiency', { body: addSkillSchema, code: 201 });
add('patch', '/me/skills/{skillId}', 'Skills', 'Update proficiency', { body: updateSkillSchema });
add('delete', '/me/skills/{skillId}', 'Skills', 'Remove profile skill');
add('get', '/roles', 'Goals', 'List role templates', { public: true });
add('get', '/quiz/questions', 'Goals', 'Read quiz questions', { public: true });
add('get', '/quiz/latest', 'Goals', 'Read latest quiz result');
add('post', '/quiz/submit', 'Goals', 'Score quiz locally', {
  body: quizSubmitSchema,
  description:
    'Answer all seven distinct questions. Returns saved response and three recommendations, without changing the goal.',
});
add('get', '/goals/current', 'Goals', 'Read current goal');
add('post', '/goals', 'Goals', 'Confirm a role or custom goal', {
  body: createGoalSchema,
  description:
    'expectedGoalId prevents stale replacements. Custom roadmap generation supports one catalogue skill, e.g. Learn Python.',
});
add('get', '/roadmaps/current', 'Roadmaps', 'Read latest roadmap and skill gaps');
add('post', '/roadmaps/generate', 'Roadmaps', 'Generate roadmap', {
  body: generationSchema,
  code: 201,
  description:
    'Three persisted attempts/user/UTC day. Returns roadmap, analysis and notice. Offline templates are active; live AI is deferred.',
});
add('get', '/roadmaps/{id}', 'Roadmaps', 'Read owned roadmap version');
add('post', '/roadmaps/{id}/regenerate', 'Roadmaps', 'Create new roadmap version', {
  body: empty,
  code: 201,
});
add('get', '/plans/current', 'Plans', 'Read active plan', {
  query: z.strictObject({ roadmapId: uuid }),
});
add('post', '/plans/preview', 'Plans', 'Preview schedule without saving', {
  body: planSettingsSchema,
  description:
    'Returns previewToken. DEADLINE requires targetEndDate on/after startDate. Four flexibility modes, exact hour allocation and workload warnings.',
});
add('post', '/plans', 'Plans', 'Save confirmed preview', {
  body: savePlanSchema,
  code: 201,
  description:
    'Use exact preview settings/token. Changed progress or active plan returns 409; preview again.',
});
add('get', '/plans/{id}', 'Plans', 'Read owned plan');
add('patch', '/plans/{id}', 'Plans', 'Replan, preserving completed work', {
  body: savePlanSchema,
  code: 201,
});
add('post', '/plans/{id}/replan', 'Plans', 'Replan alias', { body: savePlanSchema, code: 201 });
add('get', '/progress/summary', 'Progress', 'Read dashboard progress and UTC streak', {
  query: z.strictObject({ roadmapId: uuid.optional() }),
});
add('patch', '/plan-items/{id}', 'Progress', 'Change task status', {
  body: taskSchema,
  description:
    'expectedStatus guards stale writes. Project DONE needs owned evidence. Reopening can make certificates inactive.',
});
add('get', '/logs', 'Progress', 'Page learning logs', { query: logQuerySchema });
add('post', '/logs', 'Progress', 'Record learning session', {
  body: logSchema,
  code: 201,
  description:
    'Reuse requestId after uncertain delivery. UTC dates cannot be future; 1–720 minutes/session, 1440/day.',
});
add('get', '/projects', 'Progress', 'List project evidence', {
  query: z.strictObject({ roadmapId: uuid }),
});
add('post', '/projects', 'Progress', 'Upsert project evidence', {
  body: projectSchema,
  description:
    'Requires a public HTTPS link without credentials or notes of at least ten characters. Evidence is learner-reported.',
});
add('get', '/chat/sessions', 'Mentor', 'List conversations');
add(
  'get',
  '/chat/config',
  'Mentor',
  'Read active mentor mode without exposing provider credentials',
);
add('get', '/chat/history', 'Mentor', 'Read ordered history', { query: historySchema });
add('delete', '/chat/history', 'Mentor', 'Permanently delete owned history', {
  body: deleteHistorySchema,
  description:
    'sessionId selects one conversation; {} deletes all owned history. The UI requires confirmation.',
});
add(
  'post',
  '/chat/message',
  'Mentor',
  'Stream a mentor reply in the configured offline or AI mode',
  {
    body: messageSchema,
    media: 'text/event-stream',
    description:
      'POST SSE via authenticated fetch (not EventSource). Events: meta, delta, done, error. New session: sessionId:null, expectedVersion:0. Reuse requestId to replay saved pairs. 30 turns/user/UTC day, 10/minute. Abort fetch to stop. Errors after headers are SSE error events.',
  },
);
add('get', '/certificates', 'Certificates', 'List certificates and eligibility');
add('post', '/certificates/issue', 'Certificates', 'Issue certificate idempotently', {
  body: z.strictObject({ roadmapId: uuid, publishAcknowledged: z.literal(true) }),
  description:
    'Requires all topics DONE and all projects submitted. The verification link publishes name, role, hours and date. Same-roadmap retries return the original certificate.',
});
add('get', '/certificates/{id}/pdf', 'Certificates', 'Download owned valid PDF', {
  media: 'application/pdf',
  description:
    'Local PDF/QR attachment. Reopened work returns 409; unsupported font scripts return 422. Not an accredited qualification.',
});
add('get', '/public/verify/{code}', 'Certificates', 'Verify current validity publicly', {
  public: true,
  description:
    'Random 256-bit hex code. Returns certificate metadata and VALID/INACTIVE status, excluding email, user ID and evidence.',
});
add('get', '/notifications', 'Reminders', 'Page inbox and unread count', {
  query: z.strictObject({ cursor: uuid.optional() }),
});
add('get', '/notifications/preferences', 'Reminders', 'Read reminder preference');
add('patch', '/notifications/preferences', 'Reminders', 'Enable/pause future reminders', {
  body: z.strictObject({ remindersEnabled: z.boolean() }),
});
add('patch', '/notifications/{id}/read', 'Reminders', 'Mark owned notification read', {
  body: empty,
});
add('post', '/internal/jobs/weekly', 'Jobs', 'Run bounded reminder batch', {
  job: true,
  body: z.strictObject({ cursor: uuid.optional() }),
  description:
    'Disabled without CRON_SECRET. Separate job bearer secret, never a user JWT. Up to 100 accounts; follow nextCursor until null, spacing requests at least 7 seconds apart. Weekly deduplication permits retries. Hosted jobs/email remain deferred.',
});
export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'linkup API',
    version: '0.1.0',
    description:
      'Local documentation: /api/docs. Standard JSON envelope: {success,data,error}; SSE/PDF are exceptions. Global limit: 120 requests/IP/minute. Cross-field runtime rules supplement input schemas. AI/email/hosted job integrations remain deferred.',
  },
  servers: [{ url: '/api/v1' }],
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cronBearer: {
        type: 'http',
        scheme: 'bearer',
        description: 'Separate CRON_SECRET; never expose to a browser.',
      },
    },
    schemas: {
      Success: {
        type: 'object',
        required: ['success', 'data', 'error'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: {
            description:
              'Operation-specific data; see operation description and feature contract documents.',
          },
          error: { type: 'object', nullable: true, enum: [null] },
        },
      },
      Error: {
        type: 'object',
        required: ['success', 'data', 'error'],
        properties: {
          success: { type: 'boolean', enum: [false] },
          data: { type: 'object', nullable: true, enum: [null] },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
  },
};
