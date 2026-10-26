import type { ErrorRequestHandler } from 'express';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/AppError.js';
import { failure } from '../utils/response.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof AppError) {
    res.status(error.statusCode).json(failure(error.code, error.message, error.details));
    return;
  }
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json(failure('INVALID_JSON', 'Request body must contain valid JSON.'));
    return;
  }
  if (typeof error === 'object' && error !== null && 'status' in error && error.status === 413) {
    res.status(413).json(failure('PAYLOAD_TOO_LARGE', 'Request body exceeds the size limit.'));
    return;
  }
  logger.error({ err: error }, 'Unhandled request error');
  res.status(500).json(failure('INTERNAL_ERROR', 'Something went wrong. Please try again.'));
};
