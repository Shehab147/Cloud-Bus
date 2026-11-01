import { Router } from 'express';
import { z } from 'zod';
import { readData } from '../../data/store.js';
import { requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { pageMeta } from '../../utils/schemas.js';

const router = Router(); const querySchema = z.object({ resource: z.string().trim().max(80).optional(), action: z.string().trim().max(80).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }).strict(); router.use(requireAdmin);
router.get('/', validate(querySchema, 'query'), async (req, res) => { const { resource, action, page, limit } = req.query as unknown as z.infer<typeof querySchema>; const data = await readData(); const matches = data.auditLogs.filter((item) => (!resource || item.resource === resource) && (!action || item.action === action)).sort((a, b) => b.timestamp.localeCompare(a.timestamp)); const rows = matches.slice((page - 1) * limit, page * limit).map((item) => { const user = data.users.find((candidate) => candidate.id === item.userId); return { id: item.id, action: item.action, resource: item.resource, resource_id: item.resourceId, metadata: item.metadata, timestamp: item.timestamp, user_id: user?.id ?? null, user_name: user?.name ?? null, user_email: user?.email ?? null }; }); res.json({ success: true, data: rows, pagination: pageMeta(page, limit, matches.length) }); });
export default router;
