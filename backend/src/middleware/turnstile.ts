import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

type TurnstileResult = { success?: boolean; action?: string; hostname?: string };

const expectedHostnames = () => new Set(env.TURNSTILE_HOSTNAMES.split(',').map((hostname) => hostname.trim()).filter(Boolean));

export function requireTurnstile(expectedAction: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    // The local test suite has no browser-issued token. Production always verifies with Cloudflare.
    if (env.NODE_ENV === 'test' || process.env.VITEST) return next();
    const token = req.body?.turnstileToken;
    const hostnames = expectedHostnames();
    if (typeof token !== 'string' || token.length === 0 || token.length > 2048 || hostnames.size === 0) {
      return next(new HttpError(403, 'TURNSTILE_INVALID', 'Verification failed. Please try again.'));
    }

    if (!env.TURNSTILE_SECRET) return next(new HttpError(503, 'TURNSTILE_UNAVAILABLE', 'Verification is temporarily unavailable.'));

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(10_000),
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: req.ip ?? '' })
      });
      if (!response.ok) throw new Error(`siteverify ${response.status}`);
      const result = await response.json() as TurnstileResult;
      if (!result.success || result.action !== expectedAction || !result.hostname || !hostnames.has(result.hostname)) {
        return next(new HttpError(403, 'TURNSTILE_INVALID', 'Verification failed. Please try again.'));
      }
      next();
    } catch {
      next(new HttpError(403, 'TURNSTILE_INVALID', 'Verification failed. Please try again.'));
    }
  };
}
