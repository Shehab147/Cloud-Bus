import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { HttpError } from '../utils/http-error.js';
import { fieldErrors } from '../utils/schemas.js';

export function validate(schema: ZodType, target: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) return next(new HttpError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields', fieldErrors(result.error)));
    // Express 5 exposes `query` through a getter, so define a request-local
    // validated value instead of assigning to the read-only accessor.
    Object.defineProperty(req, target, { value: result.data, configurable: true, enumerable: true, writable: true });
    next();
  };
}
