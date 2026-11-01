import type { RequestHandler } from 'express';
import { HttpError } from '../utils/http-error.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Your session has expired. Please log in again.'));
  next();
};

export const requireStudent: RequestHandler = (req, _res, next) => {
  if (!req.session.user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.'));
  if (req.session.user.role !== 'student') return next(new HttpError(403, 'FORBIDDEN', 'Student access is required.'));
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.session.user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.'));
  if (req.session.user.role !== 'admin') return next(new HttpError(403, 'FORBIDDEN', 'Administrator access is required.'));
  next();
};
