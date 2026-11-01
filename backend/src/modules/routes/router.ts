import { Router } from 'express';
import { z } from 'zod';
import { addAudit, isoNow, mutateData, nextId, readData, type CampusData, type RouteRecord } from '../../data/store.js';
import { requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { conflict, HttpError, notFound } from '../../utils/http-error.js';
import { pageMeta, paginationSchema, positiveId, statusSchema } from '../../utils/schemas.js';

const router = Router();
const paramsSchema = z.object({ id: positiveId }).strict();
const routeFields = {
  name: z.string().trim().min(2, 'Enter a route name (2–120 characters).').max(120, 'Enter a route name (2–120 characters).'),
  description: z.string().trim().max(1000, 'Description must be 1000 characters or less.'), status: statusSchema
};
const createSchema = z.object({ ...routeFields, description: routeFields.description.optional().default(''), status: statusSchema.optional().default('inactive') }).strict();
export const routeUpdateSchema = z.object(routeFields).partial().strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one field.');
const reorderSchema = z.object({ stopIds: z.array(positiveId).min(1, 'Select at least one valid stop without duplicates.').max(100) }).strict()
  .refine((value) => new Set(value.stopIds).size === value.stopIds.length, { message: 'Select at least one valid stop without duplicates.', path: ['stopIds'] });
const isAdmin = (req: Express.Request) => req.session.user?.role === 'admin';

const publicRoute = (route: RouteRecord, data: CampusData) => ({
  id: route.id, name: route.name, description: route.description, status: route.status,
  created_at: route.createdAt, updated_at: route.updatedAt,
  stop_count: data.routeStops.filter((item) => item.routeId === route.id).length
});

router.get('/', validate(paginationSchema, 'query'), async (req, res) => {
  const { q, page, limit } = req.query as unknown as z.infer<typeof paginationSchema>;
  const status = isAdmin(req) && req.query.status ? req.query.status : 'active';
  const data = await readData();
  const search = q.toLowerCase();
  const matches = data.routes.filter((route) => route.status === status && `${route.name} ${route.description ?? ''}`.toLowerCase().includes(search)).sort((a, b) => a.name.localeCompare(b.name));
  const rows = matches.slice((page - 1) * limit, page * limit).map((route) => publicRoute(route, data));
  res.json({ success: true, data: rows, pagination: pageMeta(page, limit, matches.length) });
});

router.get('/:id', validate(paramsSchema, 'params'), async (req, res) => {
  const data = await readData();
  const route = data.routes.find((item) => item.id === Number(req.params.id));
  if (!route || (route.status !== 'active' && !isAdmin(req))) throw notFound('Route');
  const stops = data.routeStops.filter((item) => item.routeId === route.id).sort((a, b) => a.stopOrder - b.stopOrder)
    .map((item) => ({ item, stop: data.stops.find((stop) => stop.id === item.stopId) })).filter(({ stop }) => stop && (isAdmin(req) || stop.status === 'active'))
    .map(({ item, stop }) => ({ id: stop!.id, name: stop!.name, latitude: stop!.latitude, longitude: stop!.longitude, status: stop!.status, stop_order: item.stopOrder }));
  res.json({ success: true, data: { ...publicRoute(route, data), stops } });
});

router.post('/', requireAdmin, validate(createSchema), async (req, res) => {
  if (req.body.status === 'active') throw new HttpError(409, 'ROUTE_INCOMPLETE', 'Create the route as inactive, assign at least two stops, then activate it.', { status: 'An active route needs at least two stops.' });
  const created = await mutateData((data) => {
    if (data.routes.some((route) => route.name.toLowerCase() === req.body.name.toLowerCase())) throw conflict('A route with this name already exists.', { name: 'This route name is already in use.' });
    const timestamp = isoNow();
    const route: RouteRecord = { id: nextId(data, 'routes'), name: req.body.name, description: req.body.description || null, status: req.body.status, createdAt: timestamp, updatedAt: timestamp };
    data.routes.push(route); addAudit(data, req.session.user!.id, 'create', 'route', route.id, { after: { name: route.name, status: route.status } });
    return publicRoute(route, data);
  });
  res.status(201).json({ success: true, data: created, message: 'Route created successfully' });
});

router.patch('/:id', requireAdmin, validate(paramsSchema, 'params'), validate(routeUpdateSchema), async (req, res) => {
  const updated = await mutateData((data) => {
    const route = data.routes.find((item) => item.id === Number(req.params.id)); if (!route) throw notFound('Route');
    if (req.body.name && data.routes.some((item) => item.id !== route.id && item.name.toLowerCase() === req.body.name.toLowerCase())) throw conflict('A route with this name already exists.', { name: 'This route name is already in use.' });
    if (req.body.status === 'active') {
      const activeStops = data.routeStops.filter((item) => item.routeId === route.id && data.stops.some((stop) => stop.id === item.stopId && stop.status === 'active'));
      if (activeStops.length < 2) throw new HttpError(409, 'ROUTE_INCOMPLETE', 'Assign at least two active stops before activating this route.', { status: 'An active route needs at least two active stops.' });
    }
    const before = { name: route.name, status: route.status };
    if (req.body.name !== undefined) route.name = req.body.name; if (req.body.description !== undefined) route.description = req.body.description || null; if (req.body.status !== undefined) route.status = req.body.status;
    route.updatedAt = isoNow(); addAudit(data, req.session.user!.id, 'update', 'route', route.id, { before, after: { name: route.name, status: route.status } });
    return publicRoute(route, data);
  });
  res.json({ success: true, data: updated, message: 'Route updated successfully' });
});

router.delete('/:id', requireAdmin, validate(paramsSchema, 'params'), async (req, res) => {
  await mutateData((data) => {
    const route = data.routes.find((item) => item.id === Number(req.params.id)); if (!route) throw notFound('Route');
    route.status = 'inactive'; route.updatedAt = isoNow();
    data.timetables.filter((item) => item.routeId === route.id).forEach((item) => { item.status = 'inactive'; item.updatedAt = isoNow(); });
    addAudit(data, req.session.user!.id, 'deactivate', 'route', route.id);
  });
  res.status(204).end();
});

router.put('/:id/stops', requireAdmin, validate(paramsSchema, 'params'), validate(reorderSchema), async (req, res) => {
  const stops = await mutateData((data) => {
    const route = data.routes.find((item) => item.id === Number(req.params.id)); if (!route) throw notFound('Route');
    const stopIds: number[] = req.body.stopIds;
    if (stopIds.some((id) => !data.stops.some((stop) => stop.id === id && stop.status === 'active'))) throw new HttpError(400, 'VALIDATION_ERROR', 'Select at least one valid stop without duplicates.', { stopIds: 'One or more stops are missing or inactive.' });
    if (route.status === 'active' && stopIds.length < 2) throw new HttpError(409, 'ROUTE_INCOMPLETE', 'An active route needs at least two stops.', { stopIds: 'Select at least two stops.' });
    data.routeStops = data.routeStops.filter((item) => item.routeId !== route.id);
    stopIds.forEach((stopId, index) => data.routeStops.push({ id: nextId(data, 'routeStops'), routeId: route.id, stopId, stopOrder: index + 1 }));
    addAudit(data, req.session.user!.id, 'reorder_stops', 'route', route.id, { stopIds });
    return stopIds.map((id, index) => { const stop = data.stops.find((item) => item.id === id)!; return { id, name: stop.name, latitude: stop.latitude, longitude: stop.longitude, status: stop.status, stop_order: index + 1 }; });
  });
  res.json({ success: true, data: stops, message: 'Route stops updated successfully' });
});

export default router;
