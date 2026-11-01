import type { ErrorRequestHandler, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { HttpError } from '../utils/http-error.js';

export const requestContext: RequestHandler = (req, res, next) => {
  req.requestId = req.get('x-request-id')?.slice(0, 100) || randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', `Endpoint ${req.method} ${req.path} was not found.`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let normalized = error instanceof HttpError ? error : new HttpError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  if (error?.type === 'entity.too.large') normalized = new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
  if (error instanceof SyntaxError && 'body' in error) normalized = new HttpError(400, 'MALFORMED_JSON', 'Request body contains invalid JSON.');
  if (normalized.status >= 500) req.log?.error?.({ err: error, requestId: req.requestId }, 'request failed');
  res.status(normalized.status).json({
    success: false,
    error: { code: normalized.code, message: normalized.message, ...(normalized.fields ? { fields: normalized.fields } : {}) },
    requestId: req.requestId
  });
};
