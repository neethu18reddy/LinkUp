import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../utils/AppError.js';

export function validate(
  schema: z.ZodType,
  target: 'body' | 'query' | 'params' = 'body',
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(
        new AppError(
          422,
          'VALIDATION_ERROR',
          'Please check the provided values.',
          result.error.flatten(),
        ),
      );
      return;
    }
    req[target] = result.data;
    next();
  };
}
