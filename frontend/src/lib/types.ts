export type Role = 'student' | 'admin';
export type User = { id: number; name: string; email: string; role: Role };
export type Pagination = { page: number; limit: number; total: number; totalPages: number };
export type RouteRecord = { id: number; name: string; description?: string | null; status: 'active' | 'inactive'; stop_count?: number; stops?: StopRecord[] };
export type StopRecord = { id: number; name: string; latitude: number; longitude: number; status: 'active' | 'inactive'; stop_order?: number; route_count?: number; routes?: Pick<RouteRecord,'id'|'name'|'status'>[] };
export type Departure = { id: number; stop_id: number; stop_name: string; route_id: number; route_name: string; departure_at: string; cancelled: boolean; notice?: string | null; departureTime?: string; dayOfWeek?: number; stopId?: number; stopName?: string };
export type Timetable = { id: number; route_id: number; route_name: string; effective_from: string; effective_to: string; status: 'active'|'inactive'; schedule_type: 'weekday'|'weekend'|'seasonal'; departures: Departure[] };
export type Announcement = { id: number; route_id?: number|null; stop_id?: number|null; route_name?: string|null; stop_name?: string|null; type: 'delay'|'cancellation'|'info'; message: string; starts_at: string; ends_at: string };
export type Favorite = { id: number; stop_id: number; stop_name: string; latitude: number; longitude: number; status: 'active'|'inactive'; departures: {route_id:number;route_name:string;departure_at:string}[]; announcements: {id:number;type:Announcement['type'];message:string;endsAt:string}[] };

// ---- Admin dashboard ----
export type AdminStats = {
  totals: {
    users: number; students: number; admins: number; disabledUsers: number; favorites: number;
    activeRoutes: number; activeStops: number; activeTimetables: number; activeAnnouncements: number;
    notificationsSent: number; notificationsLast7Days: number;
  };
  registrationsByDay: { date: string; count: number }[];
  topStops: { stop_id: number; name: string; favorites: number }[];
  announcementsByType: { delay: number; cancellation: number; info: number };
};
export type SecurityEventType = 'login_success' | 'login_failed' | 'unauthenticated' | 'forbidden' | 'csrf_invalid' | 'turnstile_failed' | 'rate_limited';
export type SecuritySummary = {
  windowHours: number;
  since: string;
  counts: Record<SecurityEventType, number>;
  hourly: { hour: string; concerning: number; loginFailures: number }[];
  suspicious: { ip: string; failedLogins: number; lastSeen: string }[];
  recent: { at: string; type: SecurityEventType; method: string; path: string; ip: string; requestId: string; userId: number | null }[];
};
export type ServiceHealth = { name: string; status: 'up' | 'degraded' | 'down'; latencyMs: number | null; detail: string };
export type HealthSummary = {
  checkedAt: string;
  overall: ServiceHealth['status'];
  services: ServiceHealth[];
  process: { uptimeSeconds: number; rssMb: number; heapUsedMb: number; nodeVersion: string; environment: string };
};
export type AdminUser = { id: number; name: string; email: string; role: Role; disabled: boolean; created_at: string; favorites_count?: number };
