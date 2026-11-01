import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { HttpError } from '../utils/http-error.js';

export function ensureCsrfToken(req: Express.Request) {
  req.session.csrfToken ??= randomBytes(32).toString('base64url');
  return req.session.csrfToken;
}

export const requireCsrf: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const expected = req.session.csrfToken;
  const supplied = req.get('x-csrf-token');
  if (!expected || !supplied) return next(new HttpError(403, 'CSRF_INVALID', 'Refresh the page and try again.'));
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return next(new HttpError(403, 'CSRF_INVALID', 'Refresh the page and try again.'));
  next();
};
