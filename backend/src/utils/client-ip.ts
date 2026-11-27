import { isIP } from 'node:net';
import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';

// Behind Cloudflare, req.ip is a Cloudflare edge address, so every visitor would share one rate-limit bucket.
// Cloudflare sends the real visitor address in CF-Connecting-IP. We only trust it because the origin firewall
// accepts HTTPS from Cloudflare's IP ranges only and Express listens on 127.0.0.1 behind nginx.
export function clientIp(req: Request): string {
  const forwarded = req.get('cf-connecting-ip')?.trim();
  return forwarded && isIP(forwarded) ? forwarded : (req.ip ?? 'unknown');
}

// ipKeyGenerator groups an IPv6 address by its /56 network so one client cannot dodge the limit by rotating addresses.
export const rateLimitKey = (req: Request) => ipKeyGenerator(clientIp(req));
