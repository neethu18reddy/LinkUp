import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { asyncHandler } from '../src/utils/asyncHandler.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { AppError } from '../src/utils/AppError.js';
function failingApp(error: unknown) {
  const app = express();
  app.get(
    '/failure',
    asyncHandler(async () => {
      throw error;
    }),
  );
  app.use(errorHandler);
  return app;
}
describe('safe API error responses', () => {
  it('keeps typed recoverable failures useful', async () => {
    const response = await request(
      failingApp(new AppError(409, 'PLAN_CHANGED', 'Your plan changed. Refresh and retry.')),
    ).get('/failure');
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      data: null,
      error: { code: 'PLAN_CHANGED', message: 'Your plan changed. Refresh and retry.' },
    });
  });
  it('does not expose internal exceptions or stack traces', async () => {
    const response = await request(failingApp(new Error('private-database-password'))).get(
      '/failure',
    );
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('private-database-password');
    expect(response.body.error.stack).toBeUndefined();
  });
  it('maps database connection failures to a safe retryable response', async () => {
    const error = new Prisma.PrismaClientInitializationError(
      'private-connection-string',
      'test',
      'P1001',
    );
    const response = await request(failingApp(error)).get('/failure');
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('DATABASE_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toContain('private-connection-string');
  });
});
