import { z } from 'zod';

export const positiveId = z.coerce.number().int().safe().positive();
export const statusSchema = z.enum(['active', 'inactive']);
export const strictDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Enter a valid date.');
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid departure time.');

export const paginationSchema = z.object({
  q: z.string().trim().max(100, 'Search must be 100 characters or less.').optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: statusSchema.optional()
}).strict();

export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function fieldErrors(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    fields[key] ??= issue.message;
  }
  return fields;
}
