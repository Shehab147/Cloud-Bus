import { Router } from 'express';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { addAudit, mutateData, readData } from '../../data/store.js';
import { requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { summarizeSecurityEvents } from '../../services/security-events.js';
import { HttpError, notFound } from '../../utils/http-error.js';
import { pageMeta, positiveId } from '../../utils/schemas.js';
import { collectHealth } from './health.js';

/**
 * Administrator-only dashboard API: usage statistics, security monitoring,
 * service health and user management. Every route requires an admin session
 * (checked against the data store on each request); mutations also pass the
 * global CSRF check and are written to the audit log.
 */
const router = Router();
router.use(requireAdmin);

const userQuerySchema = z.object({
  q: z.string().trim().max(100, 'Search must be 100 characters or less.').optional().default(''),
  role: z.enum(['student', 'admin']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}).strict();
const userParamsSchema = z.object({ id: positiveId }).strict();
const userUpdateSchema = z.object({ role: z.enum(['student', 'admin']).optional(), disabled: z.boolean().optional() })
  .strict()
  .refine((value) => value.role !== undefined || value.disabled !== undefined, { message: 'Provide a role or a disabled value.', path: ['role'] });

router.get('/stats', async (_req, res) => {
  const data = await readData();
  const zone = env.CAMPUS_TIMEZONE;
  const today = DateTime.now().setZone(zone).startOf('day');

  // Registrations per campus-local day for the last 14 days (oldest first).
  const days = Array.from({ length: 14 }, (_, index) => today.minus({ days: 13 - index }).toISODate()!);
  const registrations = new Map(days.map((day) => [day, 0]));
  for (const user of data.users) {
    const day = DateTime.fromISO(user.createdAt).setZone(zone).toISODate();
    if (day && registrations.has(day)) registrations.set(day, registrations.get(day)! + 1);
  }

  const favoritesByStop = new Map<number, number>();
  for (const favorite of data.favorites) favoritesByStop.set(favorite.stopId, (favoritesByStop.get(favorite.stopId) ?? 0) + 1);
  const topStops = [...favoritesByStop.entries()]
    .map(([stopId, favorites]) => ({ stop_id: stopId, name: data.stops.find((stop) => stop.id === stopId)?.name ?? `Stop ${stopId}`, favorites }))
    .sort((a, b) => b.favorites - a.favorites || a.name.localeCompare(b.name))
    .slice(0, 5);

  const now = Date.now();
  const activeAnnouncements = data.announcements.filter((item) => Date.parse(item.startsAt) <= now && now < Date.parse(item.endsAt));
  const announcementsByType = { delay: 0, cancellation: 0, info: 0 };
  for (const item of activeAnnouncements) announcementsByType[item.type] += 1;
  const weekAgo = now - 7 * 86_400_000;

  res.json({
    success: true,
    data: {
      totals: {
        users: data.users.length,
        students: data.users.filter((user) => user.role === 'student').length,
        admins: data.users.filter((user) => user.role === 'admin').length,
        disabledUsers: data.users.filter((user) => user.disabled).length,
        favorites: data.favorites.length,
        activeRoutes: data.routes.filter((item) => item.status === 'active').length,
        activeStops: data.stops.filter((item) => item.status === 'active').length,
        activeTimetables: data.timetables.filter((item) => item.status === 'active').length,
        activeAnnouncements: activeAnnouncements.length,
        notificationsSent: data.notificationLogs.length,
        notificationsLast7Days: data.notificationLogs.filter((item) => Date.parse(item.sentAt) >= weekAgo).length
      },
      registrationsByDay: days.map((date) => ({ date, count: registrations.get(date)! })),
      topStops,
      announcementsByType
    }
  });
});

router.get('/security', (_req, res) => {
  res.json({ success: true, data: summarizeSecurityEvents() });
});

router.get('/health', async (_req, res) => {
  res.json({ success: true, data: await collectHealth() });
});

router.get('/users', validate(userQuerySchema, 'query'), async (req, res) => {
  const { q, role, page, limit } = req.query as unknown as z.infer<typeof userQuerySchema>;
  const data = await readData();
  const needle = q.toLowerCase();
  const matches = data.users
    .filter((user) => (!role || user.role === role) && (!needle || user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)))
    .sort((a, b) => a.id - b.id);
  // Explicit field list: never return passwordHash or the optional parent email.
  const rows = matches.slice((page - 1) * limit, page * limit).map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    disabled: Boolean(user.disabled),
    created_at: user.createdAt,
    favorites_count: data.favorites.filter((favorite) => favorite.userId === user.id).length
  }));
  res.json({ success: true, data: rows, pagination: pageMeta(page, limit, matches.length) });
});

router.patch('/users/:id', validate(userParamsSchema, 'params'), validate(userUpdateSchema), async (req, res) => {
  const targetId = Number(req.params.id);
  const actorId = req.session.user!.id;
  // An administrator cannot demote or disable their own account. Because the
  // acting admin is always an enabled admin, this also guarantees at least one
  // enabled admin always remains.
  if (targetId === actorId) throw new HttpError(403, 'SELF_MODIFICATION', 'You cannot change your own role or disable your own account.');

  const { role, disabled } = req.body as z.infer<typeof userUpdateSchema>;
  const updated = await mutateData((data) => {
    const user = data.users.find((candidate) => candidate.id === targetId);
    if (!user) throw notFound('User');
    const changes: Record<string, [unknown, unknown]> = {};
    if (role !== undefined && role !== user.role) { changes.role = [user.role, role]; user.role = role; }
    if (disabled !== undefined && disabled !== Boolean(user.disabled)) { changes.disabled = [Boolean(user.disabled), disabled]; user.disabled = disabled; }
    if (Object.keys(changes).length > 0) addAudit(data, actorId, 'update', 'user', user.id, { changes });
    return { id: user.id, name: user.name, email: user.email, role: user.role, disabled: Boolean(user.disabled), created_at: user.createdAt };
  });
  res.json({ success: true, data: updated, message: 'User updated' });
});

export default router;
