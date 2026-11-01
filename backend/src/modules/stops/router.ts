import { Router } from 'express';
import { z } from 'zod';
import { addAudit, isoNow, mutateData, nextId, readData, type CampusData, type StopRecord } from '../../data/store.js';
import { requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { conflict, notFound } from '../../utils/http-error.js';
import { pageMeta, paginationSchema, positiveId, statusSchema } from '../../utils/schemas.js';

const router = Router();
const paramsSchema = z.object({ id: positiveId }).strict();
const stopFields = {
  name: z.string().trim().min(2, 'Enter a stop name (2–120 characters).').max(120, 'Enter a stop name (2–120 characters).'),
  latitude: z.coerce.number().finite('Enter valid map coordinates.').min(-90, 'Enter valid map coordinates.').max(90, 'Enter valid map coordinates.'),
  longitude: z.coerce.number().finite('Enter valid map coordinates.').min(-180, 'Enter valid map coordinates.').max(180, 'Enter valid map coordinates.'), status: statusSchema
};
const createSchema = z.object({ ...stopFields, status: statusSchema.optional().default('active') }).strict();
export const stopUpdateSchema = z.object(stopFields).partial().strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field.');
const isAdmin = (req: Express.Request) => req.session.user?.role === 'admin';
const output = (stop: StopRecord, data: CampusData) => ({ id: stop.id, name: stop.name, latitude: stop.latitude, longitude: stop.longitude, status: stop.status, created_at: stop.createdAt, updated_at: stop.updatedAt, route_count: new Set(data.routeStops.filter((item) => item.stopId === stop.id).map((item) => item.routeId)).size });

router.get('/', validate(paginationSchema, 'query'), async (req, res) => {
  const { q, page, limit } = req.query as unknown as z.infer<typeof paginationSchema>; const status = isAdmin(req) && req.query.status ? req.query.status : 'active'; const data = await readData();
  const matches = data.stops.filter((stop) => stop.status === status && stop.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  res.json({ success: true, data: matches.slice((page - 1) * limit, page * limit).map((stop) => output(stop, data)), pagination: pageMeta(page, limit, matches.length) });
});

router.get('/:id', validate(paramsSchema, 'params'), async (req, res) => {
  const data = await readData(); const stop = data.stops.find((item) => item.id === Number(req.params.id)); if (!stop || (stop.status !== 'active' && !isAdmin(req))) throw notFound('Stop');
  const routes = data.routeStops.filter((item) => item.stopId === stop.id).map((item) => ({ assignment: item, route: data.routes.find((route) => route.id === item.routeId) }))
    .filter(({ route }) => route && (isAdmin(req) || route.status === 'active')).sort((a, b) => a.route!.name.localeCompare(b.route!.name))
    .map(({ assignment, route }) => ({ id: route!.id, name: route!.name, status: route!.status, stop_order: assignment.stopOrder }));
  res.json({ success: true, data: { ...output(stop, data), routes } });
});

router.post('/', requireAdmin, validate(createSchema), async (req, res) => {
  const created = await mutateData((data) => {
    if (data.stops.some((stop) => stop.name.toLowerCase() === req.body.name.toLowerCase())) throw conflict('A stop with this name already exists.', { name: 'This stop name is already in use.' });
    const timestamp = isoNow(); const stop: StopRecord = { id: nextId(data, 'stops'), name: req.body.name, latitude: req.body.latitude, longitude: req.body.longitude, status: req.body.status, createdAt: timestamp, updatedAt: timestamp };
    data.stops.push(stop); addAudit(data, req.session.user!.id, 'create', 'stop', stop.id, { after: { name: stop.name, status: stop.status, latitude: stop.latitude, longitude: stop.longitude } }); return output(stop, data);
  });
  res.status(201).json({ success: true, data: created, message: 'Stop created successfully' });
});

router.patch('/:id', requireAdmin, validate(paramsSchema, 'params'), validate(stopUpdateSchema), async (req, res) => {
  const updated = await mutateData((data) => {
    const stop = data.stops.find((item) => item.id === Number(req.params.id)); if (!stop) throw notFound('Stop');
    if (req.body.name && data.stops.some((item) => item.id !== stop.id && item.name.toLowerCase() === req.body.name.toLowerCase())) throw conflict('A stop with this name already exists.', { name: 'This stop name is already in use.' });
    const before = { name: stop.name, status: stop.status }; if (req.body.name !== undefined) stop.name = req.body.name; if (req.body.latitude !== undefined) stop.latitude = req.body.latitude; if (req.body.longitude !== undefined) stop.longitude = req.body.longitude; if (req.body.status !== undefined) stop.status = req.body.status; stop.updatedAt = isoNow();
    if (stop.status === 'inactive') data.routes.filter((route) => data.routeStops.some((item) => item.routeId === route.id && item.stopId === stop.id)).forEach((route) => { route.status = 'inactive'; route.updatedAt = isoNow(); });
    addAudit(data, req.session.user!.id, 'update', 'stop', stop.id, { before, after: { name: stop.name, status: stop.status } }); return output(stop, data);
  });
  res.json({ success: true, data: updated, message: 'Stop updated successfully' });
});

router.delete('/:id', requireAdmin, validate(paramsSchema, 'params'), async (req, res) => {
  await mutateData((data) => {
    const stop = data.stops.find((item) => item.id === Number(req.params.id)); if (!stop) throw notFound('Stop'); stop.status = 'inactive'; stop.updatedAt = isoNow();
    data.routes.filter((route) => data.routeStops.some((item) => item.routeId === route.id && item.stopId === stop.id)).forEach((route) => { route.status = 'inactive'; route.updatedAt = isoNow(); }); addAudit(data, req.session.user!.id, 'deactivate', 'stop', stop.id);
  });
  res.status(204).end();
});

export default router;
