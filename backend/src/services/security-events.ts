import { isIP } from 'node:net';
import type { Request, RequestHandler } from 'express';

/**
 * In-memory record of security-relevant API events, read by the admin
 * "Security and monitoring" panel.
 *
 * - Only metadata is stored: event type, path, client IP, request ID and (when
 *   known) the numeric user ID. Never emails, passwords, tokens or bodies.
 * - The buffer is per process and is lost on restart. Each server behind a load
 *   balancer therefore reports its own events; for a durable, central record use
 *   the structured pino logs (every event is also logged with `securityEvent`).
 */
export type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'unauthenticated'
  | 'forbidden'
  | 'csrf_invalid'
  | 'turnstile_failed'
  | 'rate_limited';

export type SecurityEvent = {
  at: string;
  type: SecurityEventType;
  method: string;
  path: string;
  ip: string;
  requestId: string;
  userId: number | null;
};

const MAX_EVENTS = 2000;
let events: SecurityEvent[] = [];
export const startedAt = new Date().toISOString();

/** Error codes (see HttpError) that count as security events. */
const codeToType: Record<string, SecurityEventType> = {
  UNAUTHENTICATED: 'unauthenticated',
  FORBIDDEN: 'forbidden',
  CSRF_INVALID: 'csrf_invalid',
  TURNSTILE_INVALID: 'turnstile_failed',
  TURNSTILE_UNAVAILABLE: 'turnstile_failed',
  INVALID_CREDENTIALS: 'login_failed',
  ACCOUNT_DISABLED: 'login_failed'
};

/**
 * Prefer the address Cloudflare reports, otherwise Express's `req.ip`.
 * The header is only trustworthy when the origin accepts traffic from
 * Cloudflare only, so this value is for monitoring display, not for security
 * decisions.
 */
function clientIp(req: Request): string {
  const header = req.get('cf-connecting-ip');
  if (header && isIP(header)) return header;
  return req.ip ?? 'unknown';
}

export function recordSecurityEvent(req: Request, type: SecurityEventType) {
  const event: SecurityEvent = {
    at: new Date().toISOString(),
    type,
    method: req.method,
    path: req.originalUrl.split('?')[0]!.slice(0, 120),
    ip: clientIp(req),
    requestId: req.requestId,
    userId: req.session?.user?.id ?? null
  };
  events.push(event);
  if (events.length > MAX_EVENTS) events = events.slice(-MAX_EVENTS);
  req.log?.warn?.({ securityEvent: type, requestId: event.requestId, userId: event.userId }, 'security event');
}

/** Called from the central error handler for every HttpError. */
export function recordSecurityEventFromError(req: Request, code: string) {
  const type = codeToType[code];
  if (!type) return;
  // The SPA calls /auth/me on every page load; a 401 there just means "not logged in".
  if (type === 'unauthenticated' && req.originalUrl.split('?')[0] === '/api/auth/me') return;
  recordSecurityEvent(req, type);
}

/** express-rate-limit `handler`: record the hit and answer with the API's JSON error shape. */
export const rateLimitHandler: RequestHandler = (req, res) => {
  recordSecurityEvent(req, 'rate_limited');
  res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' }, requestId: req.requestId });
};

export function listSecurityEvents(): readonly SecurityEvent[] {
  return events;
}

export function resetSecurityEvents() {
  events = [];
}

const HOUR = 3_600_000;

export function summarizeSecurityEvents(now = Date.now()) {
  const since = now - 24 * HOUR;
  const recentEvents = events.filter((event) => Date.parse(event.at) >= since);

  const counts: Record<SecurityEventType, number> = {
    login_success: 0, login_failed: 0, unauthenticated: 0, forbidden: 0, csrf_invalid: 0, turnstile_failed: 0, rate_limited: 0
  };
  for (const event of recentEvents) counts[event.type] += 1;

  // 24 hourly buckets, oldest first. "Concerning" = everything except a successful login.
  const hourly = Array.from({ length: 24 }, (_, index) => ({ hour: new Date(now - (23 - index) * HOUR).toISOString(), concerning: 0, loginFailures: 0 }));
  for (const event of recentEvents) {
    if (event.type === 'login_success') continue;
    const bucket = hourly[Math.min(23, Math.max(0, 23 - Math.floor((now - Date.parse(event.at)) / HOUR)))]!;
    bucket.concerning += 1;
    if (event.type === 'login_failed') bucket.loginFailures += 1;
  }

  // Repeated-failure pattern: 5 or more failed logins from one address in 15 minutes.
  const window = now - 15 * 60_000;
  const failuresByIp = new Map<string, { count: number; lastSeen: string }>();
  for (const event of recentEvents) {
    if (event.type !== 'login_failed' || Date.parse(event.at) < window) continue;
    const entry = failuresByIp.get(event.ip) ?? { count: 0, lastSeen: event.at };
    entry.count += 1;
    entry.lastSeen = event.at;
    failuresByIp.set(event.ip, entry);
  }
  const suspicious = [...failuresByIp.entries()]
    .filter(([, value]) => value.count >= 5)
    .map(([ip, value]) => ({ ip, failedLogins: value.count, lastSeen: value.lastSeen }))
    .sort((a, b) => b.failedLogins - a.failedLogins)
    .slice(0, 10);

  return {
    windowHours: 24,
    since: startedAt,
    counts,
    hourly,
    suspicious,
    recent: events.slice(-25).reverse()
  };
}
