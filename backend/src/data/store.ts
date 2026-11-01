import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';
import { env } from '../config/env.js';

export type Role = 'student' | 'admin';
export type Status = 'active' | 'inactive';
export type ScheduleType = 'weekday' | 'weekend' | 'seasonal';
export type AnnouncementType = 'delay' | 'cancellation' | 'info';

export type UserRecord = { id: number; name: string; email: string; passwordHash: string; role: Role; createdAt: string };
export type RouteRecord = { id: number; name: string; description: string | null; status: Status; createdAt: string; updatedAt: string };
export type StopRecord = { id: number; name: string; latitude: number; longitude: number; status: Status; createdAt: string; updatedAt: string };
export type RouteStopRecord = { id: number; routeId: number; stopId: number; stopOrder: number };
export type TimetableRecord = { id: number; routeId: number; effectiveFrom: string; effectiveTo: string; status: Status; scheduleType: ScheduleType; createdAt: string; updatedAt: string };
export type DepartureRecord = { id: number; timetableId: number; stopId: number; departureTime: string; dayOfWeek: number; createdAt: string };
export type AnnouncementRecord = { id: number; routeId: number | null; stopId: number | null; type: AnnouncementType; message: string; startsAt: string; endsAt: string; createdAt: string; updatedAt: string };
export type FavoriteRecord = { id: number; userId: number; stopId: number; createdAt: string };
export type AuditRecord = { id: number; userId: number | null; action: string; resource: string; resourceId: number | null; metadata: Record<string, unknown>; timestamp: string };

export type CampusData = {
  users: UserRecord[];
  routes: RouteRecord[];
  stops: StopRecord[];
  routeStops: RouteStopRecord[];
  timetables: TimetableRecord[];
  departures: DepartureRecord[];
  announcements: AnnouncementRecord[];
  favorites: FavoriteRecord[];
  auditLogs: AuditRecord[];
  counters: Record<string, number>;
};

const here = dirname(fileURLToPath(import.meta.url));
export const dataFile = env.DATA_FILE ? resolve(here, '../../../', env.DATA_FILE) : resolve(here, '../../data/campus-bus.json');
let cache: CampusData | null = null;
let mutationQueue: Promise<unknown> = Promise.resolve();

const now = () => new Date().toISOString();
const localDate = () => DateTime.now().setZone(env.CAMPUS_TIMEZONE).toISODate()!;

export function createSeedData(): CampusData {
  const timestamp = now();
  const start = DateTime.fromISO(localDate()).minus({ days: 30 }).toISODate()!;
  const end = DateTime.fromISO(localDate()).plus({ days: 365 }).toISODate()!;
  const stops: StopRecord[] = [
    { id: 1, name: 'Fictional North Gate', latitude: 30.0612, longitude: 31.2791, status: 'active', createdAt: timestamp, updatedAt: timestamp },
    { id: 2, name: 'Fictional Library Square', latitude: 30.0598, longitude: 31.2816, status: 'active', createdAt: timestamp, updatedAt: timestamp },
    { id: 3, name: 'Fictional Engineering Hall', latitude: 30.0574, longitude: 31.284, status: 'active', createdAt: timestamp, updatedAt: timestamp },
    { id: 4, name: 'Fictional Sports Centre', latitude: 30.0555, longitude: 31.2799, status: 'active', createdAt: timestamp, updatedAt: timestamp }
  ];
  const routes: RouteRecord[] = [
    { id: 1, name: 'Demo Indigo Loop', description: 'Fictional demonstration route linking the north campus facilities.', status: 'active', createdAt: timestamp, updatedAt: timestamp },
    { id: 2, name: 'Demo Amber Connector', description: 'Fictional demonstration route between academic and sports facilities.', status: 'active', createdAt: timestamp, updatedAt: timestamp }
  ];
  const routeStops: RouteStopRecord[] = [
    { id: 1, routeId: 1, stopId: 1, stopOrder: 1 }, { id: 2, routeId: 1, stopId: 2, stopOrder: 2 }, { id: 3, routeId: 1, stopId: 3, stopOrder: 3 },
    { id: 4, routeId: 2, stopId: 3, stopOrder: 1 }, { id: 5, routeId: 2, stopId: 4, stopOrder: 2 }
  ];
  const timetables: TimetableRecord[] = [
    { id: 1, routeId: 1, effectiveFrom: start, effectiveTo: end, status: 'active', scheduleType: 'weekday', createdAt: timestamp, updatedAt: timestamp },
    { id: 2, routeId: 2, effectiveFrom: start, effectiveTo: end, status: 'active', scheduleType: 'weekday', createdAt: timestamp, updatedAt: timestamp }
  ];
  const departures: DepartureRecord[] = [];
  let departureId = 1;
  for (const timetable of timetables) {
    const stopIds = routeStops.filter((item) => item.routeId === timetable.routeId).map((item) => item.stopId);
    for (const stopId of stopIds) for (const dayOfWeek of [1, 2, 3, 4, 5]) for (const departureTime of ['08:00', '10:00', '14:00', '17:00']) {
      departures.push({ id: departureId++, timetableId: timetable.id, stopId, departureTime, dayOfWeek, createdAt: timestamp });
    }
  }
  return {
    users: [], routes, stops, routeStops, timetables, departures,
    announcements: [{ id: 1, routeId: 1, stopId: null, type: 'info', message: 'Demo notice: orientation-week service uses the published timetable.', startsAt: DateTime.utc().minus({ days: 1 }).toISO()!, endsAt: DateTime.utc().plus({ days: 14 }).toISO()!, createdAt: timestamp, updatedAt: timestamp }],
    favorites: [], auditLogs: [],
    counters: { users: 1, routes: 3, stops: 5, routeStops: 6, timetables: 3, departures: departureId, announcements: 2, favorites: 1, auditLogs: 1 }
  };
}

async function persist(data: CampusData) {
  if (env.NODE_ENV === 'test') return;
  await mkdir(dirname(dataFile), { recursive: true });
  const temporary = `${dataFile}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, dataFile);
}

export async function readData(): Promise<CampusData> {
  if (cache) return cache;
  if (env.NODE_ENV === 'test') return (cache = createSeedData());
  try {
    cache = JSON.parse(await readFile(dataFile, 'utf8')) as CampusData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    cache = createSeedData();
    await persist(cache);
  }
  return cache;
}

export function nextId(data: CampusData, collection: keyof CampusData): number {
  const key = String(collection);
  const value = data.counters[key] ?? 1;
  data.counters[key] = value + 1;
  return value;
}

export async function mutateData<T>(work: (draft: CampusData) => T | Promise<T>): Promise<T> {
  const operation = mutationQueue.then(async () => {
    const draft = structuredClone(await readData());
    const result = await work(draft);
    await persist(draft);
    cache = draft;
    return result;
  });
  mutationQueue = operation.catch(() => undefined);
  return operation;
}

export async function resetData() {
  const fresh = createSeedData();
  await persist(fresh);
  cache = fresh;
  return fresh;
}

export function addAudit(data: CampusData, userId: number, action: string, resource: string, resourceId: number | null, metadata: Record<string, unknown> = {}) {
  data.auditLogs.push({ id: nextId(data, 'auditLogs'), userId, action, resource, resourceId, metadata, timestamp: now() });
}

export const isoNow = now;
