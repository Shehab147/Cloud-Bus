import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import { env, isProduction } from './config/env.js';
import { readData } from './data/store.js';
import { requestContext, errorHandler, notFoundHandler } from './middleware/error.js';
import { requireCsrf } from './middleware/csrf.js';
import authRouter from './modules/auth/router.js';
import routesRouter from './modules/routes/router.js';
import stopsRouter from './modules/stops/router.js';
import timetablesRouter from './modules/timetables/router.js';
import announcementsRouter from './modules/announcements/router.js';
import favoritesRouter from './modules/favorites/router.js';
import auditRouter from './modules/audit/router.js';

export const app = express();
app.set('trust proxy', env.TRUST_PROXY);
app.disable('x-powered-by');
app.use(requestContext);
app.use(pinoHttp({ level: env.LOG_LEVEL, redact: ['req.headers.cookie', 'req.headers.authorization', 'req.body.password'] }));
app.use(helmet({ contentSecurityPolicy: isProduction ? undefined : false }));
app.use(cors({ origin: env.APP_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Requested-With'] }));
app.use((req, res, next) => {
  const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || Boolean(req.headers['transfer-encoding']);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && hasBody && !req.is('application/json')) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_CONTENT_TYPE', message: 'Use application/json for request bodies.' }, requestId: req.requestId });
  }
  next();
});
app.use(express.json({ limit: '100kb', type: 'application/json' }));
const sessionOptions: session.SessionOptions = {
  name: 'campus.sid', secret: env.SESSION_SECRET, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: isProduction, sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60_000 }
};
app.use(session(sessionOptions));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api', requireCsrf);
app.get('/api/health', async (_req, res) => {
  try { await readData(); res.json({ success: true, data: { status: 'ok' } }); }
  catch { res.status(503).json({ success: false, error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'Service temporarily unavailable.' } }); }
});
app.use('/api/auth', authRouter);
app.use('/api/routes', routesRouter);
app.use('/api/stops', stopsRouter);
app.use('/api', timetablesRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/audit-logs', auditRouter);
app.use(notFoundHandler);
app.use(errorHandler);
