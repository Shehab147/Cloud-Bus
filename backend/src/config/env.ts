import { config as loadEnv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env'), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  SESSION_SECRET: z.string().min(32),
  APP_ORIGIN: z.string().url().default('http://localhost:5173'),
  CAMPUS_TIMEZONE: z.string().default('Africa/Cairo'),
  DATA_FILE: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).max(2).default(0),
  LOG_LEVEL: z.string().default('info')
});

const input = { ...process.env };
if (input.NODE_ENV === 'test') {
  input.SESSION_SECRET ??= 'test-only-session-secret-at-least-32-characters';
}
export const env = envSchema.parse(input);
export const isProduction = env.NODE_ENV === 'production';
