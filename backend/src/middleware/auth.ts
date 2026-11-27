import type { Request, RequestHandler } from 'express';
import { readData } from '../data/store.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Resolve the signed-in user against the data store on every request, so that
 * disabling an account or changing its role takes effect immediately instead
 * of waiting for the 8-hour session to expire.
 */
async function currentUser(req: Request) {
  const sessionUser = req.session.user;
  if (!sessionUser) return null;
  const record = (await readData()).users.find((candidate) => candidate.id === sessionUser.id);
  if (!record || record.disabled) {
    delete req.session.user;
    return null;
  }
  if (record.role !== sessionUser.role) req.session.user = { ...sessionUser, role: record.role };
  return req.session.user!;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  if (!(await currentUser(req))) return next(new HttpError(401, 'UNAUTHENTICATED', 'Your session has expired. Please log in again.'));
  next();
};

export const requireStudent: RequestHandler = async (req, _res, next) => {
  const user = await currentUser(req);
  if (!user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.'));
  if (user.role !== 'student') return next(new HttpError(403, 'FORBIDDEN', 'Student access is required.'));
  next();
};

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  const user = await currentUser(req);
  if (!user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Please log in to continue.'));
  if (user.role !== 'admin') return next(new HttpError(403, 'FORBIDDEN', 'Administrator access is required.'));
  next();
};
