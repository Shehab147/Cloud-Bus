import { DateTime } from 'luxon';
import { MongoClient, type Db, type Document } from 'mongodb';
import { env } from '../config/env.js';

export type Role = 'student' | 'admin';
export type Status = 'active' | 'inactive';
export type ScheduleType = 'weekday' | 'weekend' | 'seasonal';
export type AnnouncementType = 'delay' | 'cancellation' | 'info';

export type UserRecord = { id: number; name: string; email: string; parentEmail?: string; passwordHash: string; role: Role; disabled?: boolean; createdAt: string };
export type RouteRecord = { id: number; name: string; description: string | null; status: Status; createdAt: string; updatedAt: string };
export type StopRecord = { id: number; name: string; latitude: number; longitude: number; status: Status; createdAt: string; updatedAt: string };
export type RouteStopRecord = { id: number; routeId: number; stopId: number; stopOrder: number };
export type TimetableRecord = { id: number; routeId: number; effectiveFrom: string; effectiveTo: string; status: Status; scheduleType: ScheduleType; createdAt: string; updatedAt: string };
export type DepartureRecord = { id: number; timetableId: number; stopId: number; departureTime: string; dayOfWeek: number; createdAt: string };
export type AnnouncementRecord = { id: number; routeId: number | null; stopId: number | null; type: AnnouncementType; message: string; startsAt: string; endsAt: string; createdAt: string; updatedAt: string };
export type FavoriteRecord = { id: number; userId: number; stopId: number; createdAt: string };
export type AuditRecord = { id: number; userId: number | null; action: string; resource: string; resourceId: number | null; metadata: Record<string, unknown>; timestamp: string };
export type NotificationRecord = { key: string; sentAt: string };

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
  notificationLogs: NotificationRecord[];
  counters: Record<string, number>;
};

let cache: CampusData | null = null;
let mutationQueue: Promise<unknown> = Promise.resolve();
let mongoClient: MongoClient | null = null;
let database: Db | null = null;

const collectionNames = ['users', 'routes', 'stops', 'routeStops', 'timetables', 'departures', 'announcements', 'favorites', 'auditLogs', 'notificationLogs'] as const;
type CollectionName = typeof collectionNames[number];
type MetadataRecord = { _id: string; counters?: Record<string, number> };

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
    favorites: [], auditLogs: [], notificationLogs: [],
    counters: { users: 1, routes: 3, stops: 5, routeStops: 6, timetables: 3, departures: departureId, announcements: 2, favorites: 1, auditLogs: 1 }
  };
}

function normalizeData(data: CampusData) { data.notificationLogs ??= []; return data; }

async function getDatabase(): Promise<Db> {
  if (database) return database;
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI must be configured outside test mode.');
  mongoClient = new MongoClient(env.MONGODB_URI);
  await mongoClient.connect();
  database = mongoClient.db();
  return database;
}

function emptyData(): CampusData {
  return { users: [], routes: [], stops: [], routeStops: [], timetables: [], departures: [], announcements: [], favorites: [], auditLogs: [], notificationLogs: [], counters: {} };
}

function restoreCounters(data: CampusData) {
  for (const name of collectionNames) {
    if (name === 'notificationLogs') continue;
    const records = data[name] as Array<{ id?: number }>;
    const next = records.reduce((maximum, record) => Math.max(maximum, record.id ?? 0), 0) + 1;
    data.counters[name] ??= next;
  }
}

export async function readData(): Promise<CampusData> {
  if (cache) return cache;
  if (env.NODE_ENV === 'test') return (cache = createSeedData());
  const db = await getDatabase();
  const entries = await Promise.all(collectionNames.map(async (name) => [name, await db.collection(name).find({}, { projection: { _id: 0 } }).toArray()] as const));
  const metadata = await db.collection<MetadataRecord>('_metadata').findOne({ _id: 'counters' });
  cache = normalizeData({ ...emptyData(), ...Object.fromEntries(entries), counters: metadata?.counters ?? {} } as CampusData);
  restoreCounters(cache);
  return cache;
}

async function persist(data: CampusData) {
  if (env.NODE_ENV === 'test') return;
  const db = await getDatabase();
  // The application keeps its existing draft-and-commit behavior while MongoDB
  // remains the single durable store for every collection.
  for (const name of collectionNames) {
    const collection = db.collection(name);
    await collection.deleteMany({});
    const records = data[name] as unknown[];
    if (records.length) await collection.insertMany(records as Document[]);
  }
  await db.collection<MetadataRecord>('_metadata').replaceOne({ _id: 'counters' }, { counters: data.counters }, { upsert: true });
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
