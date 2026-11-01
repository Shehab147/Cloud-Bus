import { Router } from 'express';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { addAudit, isoNow, mutateData, nextId, readData, type CampusData, type DepartureRecord, type TimetableRecord } from '../../data/store.js';
import { requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { HttpError, notFound } from '../../utils/http-error.js';
import { pageMeta, positiveId, statusSchema, strictDate, timeSchema } from '../../utils/schemas.js';
import { scheduleApplies, validateScheduleDays } from './rules.js';

const router = Router(); const scheduleType = z.enum(['weekday', 'weekend', 'seasonal']);
const departureSchema = z.object({ stopId: positiveId, departureTime: timeSchema, dayOfWeek: z.coerce.number().int().min(0).max(6) }).strict();
const timetableFields = { routeId: positiveId, effectiveFrom: strictDate, effectiveTo: strictDate, status: statusSchema, scheduleType };
const createSchema = z.object({ ...timetableFields, status: statusSchema.optional().default('active'), departures: z.array(departureSchema).max(500).optional().default([]) }).strict().refine((value) => value.effectiveFrom <= value.effectiveTo, { message: 'End date must not be before start date.', path: ['effectiveTo'] });
export const timetableUpdateSchema = z.object(timetableFields).partial().strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field.');
const listSchema = z.object({ routeId: positiveId.optional(), date: strictDate.optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), status: statusSchema.optional(), scheduleType: scheduleType.optional() }).strict();
const nextSchema = z.object({ stopId: positiveId, routeId: positiveId.optional(), date: strictDate.optional(), count: z.coerce.number().int().min(1).max(20).default(5) }).strict();
const idParams = z.object({ id: positiveId }).strict();

function validateRouteRows(data: CampusData, routeId: number, rows: z.infer<typeof departureSchema>[]) {
  const route = data.routes.find((item) => item.id === routeId && item.status === 'active'); if (!route) throw new HttpError(400, 'VALIDATION_ERROR', 'Choose an active route.', { routeId: 'Active route not found.' });
  const routeStops = new Set(data.routeStops.filter((item) => item.routeId === routeId && data.stops.some((stop) => stop.id === item.stopId && stop.status === 'active')).map((item) => item.stopId));
  if (rows.some((row) => !routeStops.has(row.stopId))) throw new HttpError(400, 'VALIDATION_ERROR', 'Every departure stop must belong to the route.', { departures: 'One or more stops are not on this route.' });
}
function preventSeasonalOverlap(data: CampusData, routeId: number, from: string, to: string, ignoreId?: number) {
  if (data.timetables.some((item) => item.id !== ignoreId && item.routeId === routeId && item.scheduleType === 'seasonal' && item.status === 'active' && item.effectiveFrom <= to && from <= item.effectiveTo)) throw new HttpError(409, 'SEASONAL_OVERLAP', 'An active seasonal timetable already covers part of this period.', { effectiveFrom: 'Choose a non-overlapping seasonal period.' });
}
function timetableJson(item: TimetableRecord, data: CampusData) {
  return { id: item.id, route_id: item.routeId, route_name: data.routes.find((route) => route.id === item.routeId)?.name ?? 'Unknown route', effective_from: item.effectiveFrom, effective_to: item.effectiveTo, status: item.status, schedule_type: item.scheduleType, created_at: item.createdAt, updated_at: item.updatedAt,
    departures: data.departures.filter((row) => row.timetableId === item.id).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.departureTime.localeCompare(b.departureTime)).map((row) => ({ id: row.id, stopId: row.stopId, stopName: data.stops.find((stop) => stop.id === row.stopId)?.name ?? 'Unknown stop', departureTime: row.departureTime, dayOfWeek: row.dayOfWeek })) };
}

router.get('/timetables', validate(listSchema, 'query'), async (req, res) => {
  const { routeId, date, page, limit, scheduleType: type } = req.query as unknown as z.infer<typeof listSchema>; const admin = req.session.user?.role === 'admin'; const status = admin && req.query.status ? req.query.status : 'active'; const data = await readData();
  const matches = data.timetables.filter((item) => item.status === status && (!routeId || item.routeId === routeId) && (!date || item.effectiveFrom <= date && date <= item.effectiveTo) && (!type || item.scheduleType === type) && (admin || data.routes.some((route) => route.id === item.routeId && route.status === 'active'))).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.id - a.id);
  res.json({ success: true, data: matches.slice((page - 1) * limit, page * limit).map((item) => timetableJson(item, data)), pagination: pageMeta(page, limit, matches.length) });
});

router.post('/timetables', requireAdmin, validate(createSchema), async (req, res) => {
  const body = req.body as z.infer<typeof createSchema>; validateScheduleDays(body.scheduleType, body.departures);
  const created = await mutateData((data) => {
    validateRouteRows(data, body.routeId, body.departures); if (body.scheduleType === 'seasonal' && body.status === 'active') preventSeasonalOverlap(data, body.routeId, body.effectiveFrom, body.effectiveTo);
    const timestamp = isoNow(); const item: TimetableRecord = { id: nextId(data, 'timetables'), routeId: body.routeId, effectiveFrom: body.effectiveFrom, effectiveTo: body.effectiveTo, status: body.status, scheduleType: body.scheduleType, createdAt: timestamp, updatedAt: timestamp }; data.timetables.push(item);
    for (const row of body.departures) data.departures.push({ id: nextId(data, 'departures'), timetableId: item.id, stopId: row.stopId, departureTime: row.departureTime, dayOfWeek: row.dayOfWeek, createdAt: timestamp });
    addAudit(data, req.session.user!.id, 'create', 'timetable', item.id, { routeId: item.routeId, scheduleType: item.scheduleType, departureCount: body.departures.length }); return timetableJson(item, data);
  });
  res.status(201).json({ success: true, data: created, message: 'Timetable created successfully' });
});

router.patch('/timetables/:id', requireAdmin, validate(idParams, 'params'), validate(timetableUpdateSchema), async (req, res) => {
  const updated = await mutateData((data) => {
    const item = data.timetables.find((candidate) => candidate.id === Number(req.params.id)); if (!item) throw notFound('Timetable'); const before = { status: item.status };
    const next = { routeId: req.body.routeId ?? item.routeId, effectiveFrom: req.body.effectiveFrom ?? item.effectiveFrom, effectiveTo: req.body.effectiveTo ?? item.effectiveTo, status: req.body.status ?? item.status, scheduleType: req.body.scheduleType ?? item.scheduleType };
    if (next.effectiveFrom > next.effectiveTo) throw new HttpError(400, 'VALIDATION_ERROR', 'End date must not be before start date.', { effectiveTo: 'End date must not be before start date.' }); validateRouteRows(data, next.routeId, []); if (next.scheduleType === 'seasonal' && next.status === 'active') preventSeasonalOverlap(data, next.routeId, next.effectiveFrom, next.effectiveTo, item.id);
    Object.assign(item, next, { updatedAt: isoNow() }); addAudit(data, req.session.user!.id, 'update', 'timetable', item.id, { before, after: { status: item.status } }); return timetableJson(item, data);
  });
  res.json({ success: true, data: updated, message: 'Timetable updated successfully' });
});

router.delete('/timetables/:id', requireAdmin, validate(idParams, 'params'), async (req, res) => { await mutateData((data) => { const item = data.timetables.find((candidate) => candidate.id === Number(req.params.id)); if (!item) throw notFound('Timetable'); item.status = 'inactive'; item.updatedAt = isoNow(); addAudit(data, req.session.user!.id, 'deactivate', 'timetable', item.id); }); res.status(204).end(); });

router.post('/timetables/:id/departures', requireAdmin, validate(idParams, 'params'), validate(departureSchema), async (req, res) => {
  const created = await mutateData((data) => { const table = data.timetables.find((item) => item.id === Number(req.params.id)); if (!table) throw notFound('Timetable'); validateScheduleDays(table.scheduleType, [req.body]); validateRouteRows(data, table.routeId, [req.body]);
    if (data.departures.some((row) => row.timetableId === table.id && row.stopId === req.body.stopId && row.departureTime === req.body.departureTime && row.dayOfWeek === req.body.dayOfWeek)) throw new HttpError(409, 'CONFLICT', 'This departure already exists.');
    const row: DepartureRecord = { id: nextId(data, 'departures'), timetableId: table.id, stopId: req.body.stopId, departureTime: req.body.departureTime, dayOfWeek: req.body.dayOfWeek, createdAt: isoNow() }; data.departures.push(row); addAudit(data, req.session.user!.id, 'create', 'departure', row.id, { timetableId: table.id }); return row; });
  res.status(201).json({ success: true, data: created, message: 'Departure added successfully' });
});

router.patch('/departures/:id', requireAdmin, validate(idParams, 'params'), validate(departureSchema.partial().strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field.')), async (req, res) => {
  const updated = await mutateData((data) => { const row = data.departures.find((item) => item.id === Number(req.params.id)); if (!row) throw notFound('Departure'); const table = data.timetables.find((item) => item.id === row.timetableId)!; const next = { stopId: req.body.stopId ?? row.stopId, departureTime: req.body.departureTime ?? row.departureTime, dayOfWeek: req.body.dayOfWeek ?? row.dayOfWeek }; validateScheduleDays(table.scheduleType, [next]); validateRouteRows(data, table.routeId, [next]); Object.assign(row, next); addAudit(data, req.session.user!.id, 'update', 'departure', row.id, { timetableId: table.id }); return row; });
  res.json({ success: true, data: updated, message: 'Departure updated successfully' });
});
router.delete('/departures/:id', requireAdmin, validate(idParams, 'params'), async (req, res) => { await mutateData((data) => { const index = data.departures.findIndex((item) => item.id === Number(req.params.id)); if (index < 0) throw notFound('Departure'); const [row] = data.departures.splice(index, 1); addAudit(data, req.session.user!.id, 'delete', 'departure', row!.id, { timetableId: row!.timetableId }); }); res.status(204).end(); });

router.get('/departures/next', validate(nextSchema, 'query'), async (req, res) => {
  const { stopId, routeId, date, count } = req.query as unknown as z.infer<typeof nextSchema>; const data = await readData(); const localNow = DateTime.now().setZone(env.CAMPUS_TIMEZONE); const firstDate = DateTime.fromISO(date ?? localNow.toISODate()!, { zone: env.CAMPUS_TIMEZONE }); const start = date && date !== localNow.toISODate() ? firstDate.startOf('day') : localNow; const candidates: Array<Record<string, unknown> & { departure_at: string }> = [];
  for (let offset = 0; offset <= 7; offset++) { const serviceDay = firstDate.plus({ days: offset }); const serviceDate = serviceDay.toISODate()!; const dayOfWeek = serviceDay.weekday % 7;
    const eligible = data.timetables.filter((item) => item.status === 'active' && item.effectiveFrom <= serviceDate && serviceDate <= item.effectiveTo && (!routeId || item.routeId === routeId) && data.routes.some((route) => route.id === item.routeId && route.status === 'active'));
    for (const table of eligible) { const seasonal = eligible.some((item) => item.routeId === table.routeId && item.scheduleType === 'seasonal'); if (!scheduleApplies(table.scheduleType, dayOfWeek, seasonal)) continue;
      for (const row of data.departures.filter((item) => item.timetableId === table.id && item.stopId === stopId && item.dayOfWeek === dayOfWeek)) { const departure = DateTime.fromISO(`${serviceDate}T${row.departureTime}`, { zone: env.CAMPUS_TIMEZONE }); if (departure < start) continue; const route = data.routes.find((item) => item.id === table.routeId)!; const stop = data.stops.find((item) => item.id === stopId); if (!stop || stop.status !== 'active') continue;
        const notices = data.announcements.filter((item) => DateTime.fromISO(item.startsAt) <= DateTime.utc() && DateTime.utc() < DateTime.fromISO(item.endsAt) && (item.routeId === null || item.routeId === route.id) && (item.stopId === null || item.stopId === stopId)).sort((a, b) => ({ cancellation: 1, delay: 2, info: 3 }[a.type] - { cancellation: 1, delay: 2, info: 3 }[b.type]));
        candidates.push({ id: row.id, stop_id: stopId, timetable_id: table.id, route_id: route.id, route_name: route.name, stop_name: stop.name, schedule_type: table.scheduleType, service_date: serviceDate, departure_time: row.departureTime, departure_at: departure.toUTC().toISO()!, cancelled: notices.some((item) => item.type === 'cancellation'), notice: notices[0]?.message ?? null });
      }
    }
  }
  candidates.sort((a, b) => a.departure_at.localeCompare(b.departure_at)); res.json({ success: true, data: candidates.slice(0, count), meta: { horizonDays: 7, timezone: env.CAMPUS_TIMEZONE, scheduledEstimates: true } });
});

export default router;
