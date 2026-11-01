import { Router } from 'express';
import { z } from 'zod';
import { addAudit, isoNow, mutateData, nextId, readData, type AnnouncementRecord, type CampusData } from '../../data/store.js';
import { requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { HttpError, notFound } from '../../utils/http-error.js';
import { pageMeta, positiveId } from '../../utils/schemas.js';

const router = Router(); const announcementType = z.enum(['delay', 'cancellation', 'info']); const timestamp = z.string().datetime({ offset: true, message: 'Use a timezone-aware date and time.' });
const fields = { routeId: positiveId.nullable(), stopId: positiveId.nullable(), type: announcementType, message: z.string().trim().min(5, 'Enter a message (5–1000 characters).').max(1000, 'Enter a message (5–1000 characters).'), startsAt: timestamp, endsAt: timestamp };
const createSchema = z.object({ ...fields, routeId: positiveId.nullable().optional().default(null), stopId: positiveId.nullable().optional().default(null) }).strict().refine((value) => new Date(value.startsAt) < new Date(value.endsAt), { message: 'End time must be after start time.', path: ['endsAt'] });
export const announcementUpdateSchema = z.object(fields).partial().strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field.');
const paramsSchema = z.object({ id: positiveId }).strict();
const listSchema = z.object({ routeId: positiveId.optional(), stopId: positiveId.optional(), type: announcementType.optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), history: z.enum(['true', 'false']).optional().default('false') }).strict();

function validateScope(data: CampusData, routeId: number | null, stopId: number | null) {
  if (routeId && !data.routes.some((item) => item.id === routeId)) throw new HttpError(400, 'VALIDATION_ERROR', 'Route not found.', { routeId: 'Route not found.' });
  if (stopId && !data.stops.some((item) => item.id === stopId)) throw new HttpError(400, 'VALIDATION_ERROR', 'Stop not found.', { stopId: 'Stop not found.' });
  if (routeId && stopId && !data.routeStops.some((item) => item.routeId === routeId && item.stopId === stopId)) throw new HttpError(400, 'VALIDATION_ERROR', 'The selected stop does not belong to the selected route.', { stopId: 'Choose a stop on this route.' });
}
const output = (item: AnnouncementRecord, data: CampusData) => ({ id: item.id, route_id: item.routeId, stop_id: item.stopId, type: item.type, message: item.message, starts_at: item.startsAt, ends_at: item.endsAt, created_at: item.createdAt, updated_at: item.updatedAt, route_name: data.routes.find((route) => route.id === item.routeId)?.name ?? null, stop_name: data.stops.find((stop) => stop.id === item.stopId)?.name ?? null });

router.get('/', validate(listSchema, 'query'), async (req, res) => {
  const { routeId, stopId, type, page, limit, history } = req.query as unknown as z.infer<typeof listSchema>; const data = await readData(); const now = Date.now(); const showHistory = req.session.user?.role === 'admin' && history === 'true';
  const routeStopIds = routeId ? new Set(data.routeStops.filter((item) => item.routeId === routeId).map((item) => item.stopId)) : null; const stopRouteIds = stopId ? new Set(data.routeStops.filter((item) => item.stopId === stopId).map((item) => item.routeId)) : null;
  const matches = data.announcements.filter((item) => (showHistory || new Date(item.startsAt).getTime() <= now && now < new Date(item.endsAt).getTime()) && (!type || item.type === type)
    && (!routeId || item.routeId === routeId || item.routeId === null && item.stopId === null || item.stopId !== null && routeStopIds!.has(item.stopId))
    && (!stopId || item.stopId === stopId || item.routeId === null && item.stopId === null || item.routeId !== null && stopRouteIds!.has(item.routeId)))
    .sort((a, b) => ({ cancellation: 1, delay: 2, info: 3 }[a.type] - { cancellation: 1, delay: 2, info: 3 }[b.type] || b.startsAt.localeCompare(a.startsAt)));
  res.json({ success: true, data: matches.slice((page - 1) * limit, page * limit).map((item) => output(item, data)), pagination: pageMeta(page, limit, matches.length) });
});

router.post('/', requireAdmin, validate(createSchema), async (req, res) => { const created = await mutateData((data) => { validateScope(data, req.body.routeId, req.body.stopId); const timestamp = isoNow(); const item: AnnouncementRecord = { id: nextId(data, 'announcements'), routeId: req.body.routeId, stopId: req.body.stopId, type: req.body.type, message: req.body.message, startsAt: req.body.startsAt, endsAt: req.body.endsAt, createdAt: timestamp, updatedAt: timestamp }; data.announcements.push(item); addAudit(data, req.session.user!.id, 'create', 'announcement', item.id, { type: item.type, routeId: item.routeId, stopId: item.stopId }); return output(item, data); }); res.status(201).json({ success: true, data: created, message: 'Announcement published successfully' }); });

router.patch('/:id', requireAdmin, validate(paramsSchema, 'params'), validate(announcementUpdateSchema), async (req, res) => { const updated = await mutateData((data) => { const item = data.announcements.find((candidate) => candidate.id === Number(req.params.id)); if (!item) throw notFound('Announcement'); const next = { routeId: req.body.routeId !== undefined ? req.body.routeId : item.routeId, stopId: req.body.stopId !== undefined ? req.body.stopId : item.stopId, type: req.body.type ?? item.type, message: req.body.message ?? item.message, startsAt: req.body.startsAt ?? item.startsAt, endsAt: req.body.endsAt ?? item.endsAt }; if (new Date(next.startsAt) >= new Date(next.endsAt)) throw new HttpError(400, 'VALIDATION_ERROR', 'End time must be after start time.', { endsAt: 'End time must be after start time.' }); validateScope(data, next.routeId, next.stopId); const before = { type: item.type }; Object.assign(item, next, { updatedAt: isoNow() }); addAudit(data, req.session.user!.id, 'update', 'announcement', item.id, { before, after: { type: item.type } }); return output(item, data); }); res.json({ success: true, data: updated, message: 'Announcement updated successfully' }); });

router.delete('/:id', requireAdmin, validate(paramsSchema, 'params'), async (req, res) => { await mutateData((data) => { const item = data.announcements.find((candidate) => candidate.id === Number(req.params.id)); if (!item) throw notFound('Announcement'); if (new Date(item.endsAt).getTime() > Date.now()) item.endsAt = isoNow(); item.updatedAt = isoNow(); addAudit(data, req.session.user!.id, 'expire', 'announcement', item.id); }); res.status(204).end(); });

export default router;
