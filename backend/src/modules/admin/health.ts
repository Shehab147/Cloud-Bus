import { env } from '../../config/env.js';
import { readData } from '../../data/store.js';

export type HealthTarget = { name: string; url: string };
export type ServiceHealth = { name: string; status: 'up' | 'degraded' | 'down'; latencyMs: number | null; detail: string };

/**
 * Parse HEALTH_TARGETS, e.g. `routes=http://10.0.0.11:4001/api/health,timetables=http://10.0.0.12:4002/api/health`.
 *
 * Targets come from server configuration only, never from a request, so an
 * administrator cannot make the API probe arbitrary addresses (no SSRF).
 * Malformed entries and non-http(s) URLs are ignored.
 */
export function parseHealthTargets(raw: string | undefined): HealthTarget[] {
  if (!raw) return [];
  const targets: HealthTarget[] = [];
  for (const entry of raw.split(',')) {
    const separator = entry.indexOf('=');
    if (separator < 1) continue;
    const name = entry.slice(0, separator).trim();
    const url = entry.slice(separator + 1).trim();
    if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(name)) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      targets.push({ name, url: parsed.toString() });
    } catch { /* ignore malformed URL */ }
  }
  return targets.slice(0, 10);
}

const SLOW_MS = 1500;

async function probe(target: HealthTarget): Promise<ServiceHealth> {
  const started = performance.now();
  try {
    const response = await fetch(target.url, { signal: AbortSignal.timeout(3000), redirect: 'error', headers: { accept: 'application/json' } });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) return { name: target.name, status: 'down', latencyMs, detail: `HTTP ${response.status}` };
    return { name: target.name, status: latencyMs > SLOW_MS ? 'degraded' : 'up', latencyMs, detail: latencyMs > SLOW_MS ? 'Slow response' : 'Healthy' };
  } catch {
    return { name: target.name, status: 'down', latencyMs: null, detail: 'No response (timeout or connection refused)' };
  }
}

/** This process and its data store, checked directly rather than over HTTP. */
async function checkSelf(): Promise<ServiceHealth> {
  const started = performance.now();
  try {
    await readData();
    return { name: 'api (this server)', status: 'up', latencyMs: Math.round(performance.now() - started), detail: 'Data store readable' };
  } catch {
    return { name: 'api (this server)', status: 'down', latencyMs: null, detail: 'Data store unavailable' };
  }
}

export async function collectHealth() {
  const targets = parseHealthTargets(env.HEALTH_TARGETS);
  const services = await Promise.all([checkSelf(), ...targets.map(probe)]);
  const memory = process.memoryUsage();
  return {
    checkedAt: new Date().toISOString(),
    overall: services.some((item) => item.status === 'down') ? 'down' : services.some((item) => item.status === 'degraded') ? 'degraded' : 'up',
    services,
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      rssMb: Math.round(memory.rss / 1_048_576),
      heapUsedMb: Math.round(memory.heapUsed / 1_048_576),
      nodeVersion: process.version,
      environment: env.NODE_ENV
    }
  };
}
