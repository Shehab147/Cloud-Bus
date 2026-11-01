import { Router } from 'express';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { mutateData, nextId, readData, isoNow, type CampusData } from '../../data/store.js';
import { requireStudent } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { HttpError, notFound } from '../../utils/http-error.js';
import { positiveId } from '../../utils/schemas.js';
import { scheduleApplies } from '../timetables/rules.js';

const router = Router(); const createSchema = z.object({ stopId: positiveId }).strict(); const paramsSchema = z.object({ stopId: positiveId }).strict(); router.use(requireStudent);

function upcomingForStop(data: CampusData, stopId: number) {
  const localNow = DateTime.now().setZone(env.CAMPUS_TIMEZONE); const rows: { route_id: number; route_name: string; departure_at: string }[] = [];
  for (let offset = 0; offset <= 7; offset++) { const day = localNow.plus({ days: offset }); const date = day.toISODate()!; const dayOfWeek = day.weekday % 7;
    const eligible = data.timetables.filter((table) => table.status === 'active' && table.effectiveFrom <= date && date <= table.effectiveTo && data.routes.some((route) => route.id === table.routeId && route.status === 'active'));
    for (const table of eligible) { const seasonal = eligible.some((item) => item.routeId === table.routeId && item.scheduleType === 'seasonal'); if (!scheduleApplies(table.scheduleType, dayOfWeek, seasonal)) continue; const route = data.routes.find((item) => item.id === table.routeId)!;
      for (const departure of data.departures.filter((item) => item.timetableId === table.id && item.stopId === stopId && item.dayOfWeek === dayOfWeek)) { const at = DateTime.fromISO(`${date}T${departure.departureTime}`, { zone: env.CAMPUS_TIMEZONE }); if (at >= localNow) rows.push({ route_id: route.id, route_name: route.name, departure_at: at.toUTC().toISO()! }); }
    }
  }
  return rows.sort((a, b) => a.departure_at.localeCompare(b.departure_at)).slice(0, 3);
}

router.get('/', async (req, res) => { const data = await readData(); const now = Date.now(); const favorites = data.favorites.filter((item) => item.userId === req.session.user!.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((favorite) => { const stop = data.stops.find((item) => item.id === favorite.stopId)!; const routeIds = new Set(data.routeStops.filter((item) => item.stopId === stop.id).map((item) => item.routeId)); const notices = data.announcements.filter((item) => new Date(item.startsAt).getTime() <= now && now < new Date(item.endsAt).getTime() && (item.stopId === null || item.stopId === stop.id) && (item.routeId === null || routeIds.has(item.routeId))); const unique = [...new Map(notices.map((item) => [item.id, { id: item.id, type: item.type, message: item.message, endsAt: item.endsAt }])).values()]; return { id: favorite.id, created_at: favorite.createdAt, stop_id: stop.id, stop_name: stop.name, latitude: stop.latitude, longitude: stop.longitude, status: stop.status, departures: stop.status === 'active' ? upcomingForStop(data, stop.id) : [], announcements: unique }; }); res.json({ success: true, data: favorites, meta: { timezone: env.CAMPUS_TIMEZONE, scheduledEstimates: true } }); });

router.post('/', validate(createSchema), async (req, res) => { const created = await mutateData((data) => { const stop = data.stops.find((item) => item.id === req.body.stopId && item.status === 'active'); if (!stop) throw notFound('Stop'); if (data.favorites.some((item) => item.userId === req.session.user!.id && item.stopId === stop.id)) throw new HttpError(409, 'FAVORITE_EXISTS', 'This stop is already in favorites.', { stopId: 'This stop is already in favorites.' }); const favorite = { id: nextId(data, 'favorites'), userId: req.session.user!.id, stopId: stop.id, createdAt: isoNow() }; data.favorites.push(favorite); return { id: favorite.id, user_id: favorite.userId, stop_id: favorite.stopId, created_at: favorite.createdAt, stopName: stop.name }; }); res.status(201).json({ success: true, data: created, message: 'Stop added to favorites' }); });

router.delete('/:stopId', validate(paramsSchema, 'params'), async (req, res) => { await mutateData((data) => { const index = data.favorites.findIndex((item) => item.userId === req.session.user!.id && item.stopId === Number(req.params.stopId)); if (index < 0) throw notFound('Favorite'); data.favorites.splice(index, 1); }); res.status(204).end(); });

export default router;
