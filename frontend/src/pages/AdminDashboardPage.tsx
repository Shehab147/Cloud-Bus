import type { ReactNode } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, Bell, CalendarDays, CircleCheck, CircleX, MapPin, Route as RouteIcon, ShieldAlert, ShieldCheck, TriangleAlert, Users } from 'lucide-react';
import { api, ApiError, type ApiResponse } from '../lib/api';
import { type AdminStats, type HealthSummary, type SecurityEventType, type SecuritySummary, type ServiceHealth } from '../lib/types';
import { campusTimezone, formatDateTime } from '../lib/format';
import { BarChart } from '../components/BarChart';
import { Button, Card, CardContent, CardHeader, Empty, ErrorState, Loading, PageHeader } from '../components/ui';

const errorMessage = (error: unknown) => (error instanceof ApiError ? error.message : 'Please try again.');
const hourFormat = new Intl.DateTimeFormat('en-EG', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: campusTimezone });
const dayFormat = new Intl.DateTimeFormat('en-EG', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function StatTile({ label, value, icon, to }: { label: string; value: number | string; icon: ReactNode; to?: string }) {
  const body = (
    <div className="p-5">
      <div className="flex items-center justify-between text-primary">
        <span aria-hidden="true">{icon}</span>
        <span className="text-2xl font-semibold text-foreground">{value}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
    </div>
  );
  return to ? <Link to={to}><Card className="h-full transition-colors hover:bg-muted/30">{body}</Card></Link> : <Card className="h-full">{body}</Card>;
}

/** State is always icon + word, never colour alone. */
function StatusPill({ status }: { status: ServiceHealth['status'] }) {
  const config = {
    up: { label: 'Operational', icon: <CircleCheck className="h-3.5 w-3.5" />, tone: 'bg-success/10 text-success' },
    degraded: { label: 'Degraded', icon: <TriangleAlert className="h-3.5 w-3.5" />, tone: 'bg-warning/10 text-warning' },
    down: { label: 'Down', icon: <CircleX className="h-3.5 w-3.5" />, tone: 'bg-destructive/10 text-destructive' }
  }[status];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${config.tone}`}>{config.icon}{config.label}</span>;
}

const eventLabels: Record<SecurityEventType, string> = {
  login_success: 'Login',
  login_failed: 'Failed login',
  unauthenticated: 'No session (401)',
  forbidden: 'Forbidden (403)',
  csrf_invalid: 'CSRF rejected',
  turnstile_failed: 'Turnstile failed',
  rate_limited: 'Rate limited'
};

function HealthCard({ query }: { query: UseQueryResult<ApiResponse<HealthSummary>> }) {
  const health = query.data?.data;
  return (
    <Card>
      <CardHeader
        icon={<Activity className="h-5 w-5" />}
        title="Service health"
        description="Checked every 15 seconds. Add other services with HEALTH_TARGETS on the server."
        action={health && <StatusPill status={health.overall} />}
      />
      <CardContent>
        {query.isLoading ? <Loading /> : query.isError || !health ? <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} /> : (
          <>
            <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border">
              {health.services.map((service) => (
                <li key={service.name} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{service.name}</p>
                    <p className="text-xs text-muted-foreground">{service.detail}{service.latencyMs !== null ? ` · ${service.latencyMs} ms` : ''}</p>
                  </div>
                  <StatusPill status={service.status} />
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ['Uptime', formatUptime(health.process.uptimeSeconds)],
                ['Memory (RSS)', `${health.process.rssMb} MB`],
                ['Heap used', `${health.process.heapUsedMb} MB`],
                ['Node', health.process.nodeVersion]
              ].map(([term, value]) => (
                <div key={term} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <dt className="text-xs text-muted-foreground">{term}</dt>
                  <dd className="mt-1 font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">Last checked {formatDateTime(health.checkedAt)}.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SecurityCard({ security }: { security: UseQueryResult<ApiResponse<SecuritySummary>> }) {
  const summary = security.data?.data;
  const counts = summary?.counts;
  const tiles: [string, number | undefined, string][] = [
    ['Failed logins', counts?.login_failed, 'Wrong password, unknown email or disabled account'],
    ['Access denied', counts ? counts.unauthenticated + counts.forbidden : undefined, '401 and 403 responses'],
    ['Rate limited', counts?.rate_limited, 'Requests blocked by the limiter'],
    ['Bot / CSRF rejections', counts ? counts.turnstile_failed + counts.csrf_invalid : undefined, 'Turnstile and CSRF failures']
  ];
  return (
    <Card>
      <CardHeader
        icon={<ShieldAlert className="h-5 w-5" />}
        title="Security and monitoring"
        description="Security-relevant API activity in the last 24 hours. Passwords, tokens and emails are never recorded."
        action={<Link to="/admin/audit-logs"><Button variant="outline" size="sm">Audit logs</Button></Link>}
      />
      <CardContent>
        {security.isLoading ? <Loading /> : security.isError || !summary ? <ErrorState message={errorMessage(security.error)} onRetry={() => void security.refetch()} /> : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {tiles.map(([label, value, hint]) => (
                <div key={label} className="rounded-lg border border-border/60 bg-muted/20 p-3" title={hint}>
                  <p className="text-2xl font-semibold tabular-nums">{value ?? 0}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Suspicious events per hour</h3>
              <BarChart
                ariaLabel="Failed or denied requests per hour over the last 24 hours"
                unit="events"
                labelEvery={6}
                data={summary.hourly.map((bucket) => ({ label: `${hourFormat.format(new Date(bucket.hour))} (Cairo)`, shortLabel: hourFormat.format(new Date(bucket.hour)), value: bucket.concerning }))}
              />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Repeated failed logins</h3>
              {summary.suspicious.length === 0 ? (
                <p className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />No address has failed 5 or more logins in the last 15 minutes.</p>
              ) : (
                <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border border-destructive/30" role="alert">
                  {summary.suspicious.map((item) => (
                    <li key={item.ip} className="flex items-center justify-between gap-3 p-3 text-sm">
                      <span className="flex items-center gap-2 font-mono"><TriangleAlert className="h-4 w-4 text-destructive" aria-hidden="true" />{item.ip}</span>
                      <span className="text-muted-foreground">{item.failedLogins} failed logins · last {formatDateTime(item.lastSeen)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Recent events</h3>
              {summary.recent.length === 0 ? <Empty title="No events yet" description="Events appear here as people sign in or are denied access." /> : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full min-w-[34rem] text-left text-sm">
                    <thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className="p-2 font-medium">Time</th><th className="p-2 font-medium">Event</th><th className="p-2 font-medium">Request</th><th className="p-2 font-medium">Address</th></tr></thead>
                    <tbody>
                      {summary.recent.map((event) => (
                        <tr key={event.requestId + event.at + event.type} className="border-t border-border/50">
                          <td className="whitespace-nowrap p-2 text-muted-foreground">{formatDateTime(event.at)}</td>
                          <td className="p-2 font-medium">{eventLabels[event.type]}</td>
                          <td className="p-2 font-mono text-xs" title={`Request ID ${event.requestId}`}>{event.method} {event.path}</td>
                          <td className="p-2 font-mono text-xs">{event.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Held in server memory since {formatDateTime(summary.since)}; a restart clears it. The request ID matches the structured logs.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AnalyticsCard({ stats }: { stats: UseQueryResult<ApiResponse<AdminStats>> }) {
  const data = stats.data?.data;
  const topMax = Math.max(1, ...(data?.topStops.map((stop) => stop.favorites) ?? [1]));
  return (
    <Card>
      <CardHeader icon={<Users className="h-5 w-5" />} title="Usage analytics" description="Who is using the service and which stops matter most." />
      <CardContent>
        {stats.isLoading ? <Loading /> : stats.isError || !data ? <ErrorState message={errorMessage(stats.error)} onRetry={() => void stats.refetch()} /> : (
          <>
            <div>
              <h3 className="mb-2 text-sm font-semibold">New registrations, last 14 days</h3>
              <BarChart
                ariaLabel="New student registrations per day over the last 14 days"
                unit="registrations"
                labelEvery={3}
                data={data.registrationsByDay.map((day) => ({ label: dayFormat.format(new Date(`${day.date}T00:00:00Z`)), shortLabel: dayFormat.format(new Date(`${day.date}T00:00:00Z`)), value: day.count }))}
              />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Most favourited stops</h3>
              {data.topStops.length === 0 ? <Empty title="No favourites yet" description="Stops appear here once students start saving them." /> : (
                <ol className="space-y-2">
                  {data.topStops.map((stop) => (
                    <li key={stop.stop_id} className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-3 text-sm">
                      <span className="truncate" title={stop.name}>{stop.name}</span>
                      <span className="h-2 rounded-r-[4px] bg-primary" style={{ width: `${(stop.favorites / topMax) * 100}%` }} aria-hidden="true" />
                      <span className="text-right font-medium tabular-nums">{stop.favorites}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ['Students', data.totals.students],
                ['Admins', data.totals.admins],
                ['Disabled accounts', data.totals.disabledUsers],
                ['Reminder emails (7 days)', data.totals.notificationsLast7Days],
                ['Active delays', data.announcementsByType.delay],
                ['Active cancellations', data.announcementsByType.cancellation],
                ['Active info notices', data.announcementsByType.info],
                ['Saved favourites', data.totals.favorites]
              ].map(([term, value]) => (
                <div key={term} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <dt className="text-xs text-muted-foreground">{term}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api<AdminStats>('/admin/stats'), refetchInterval: 60_000 });
  const security = useQuery({ queryKey: ['admin', 'security'], queryFn: () => api<SecuritySummary>('/admin/security'), refetchInterval: 15_000 });
  const health = useQuery({ queryKey: ['admin', 'health'], queryFn: () => api<HealthSummary>('/admin/health'), refetchInterval: 15_000 });
  const totals = stats.data?.data.totals;
  const refreshAll = () => { void stats.refetch(); void security.refetch(); void health.refetch(); };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Administration"
        subtitle="Manage published campus transport information and monitor the service."
        actions={<Button variant="outline" size="sm" onClick={refreshAll}>Refresh now</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Active routes" value={totals?.activeRoutes ?? 0} icon={<RouteIcon className="h-5 w-5" />} to="/admin/routes" />
        <StatTile label="Active stops" value={totals?.activeStops ?? 0} icon={<MapPin className="h-5 w-5" />} to="/admin/stops" />
        <StatTile label="Active timetables" value={totals?.activeTimetables ?? 0} icon={<CalendarDays className="h-5 w-5" />} to="/admin/timetables" />
        <StatTile label="Active notices" value={totals?.activeAnnouncements ?? 0} icon={<Bell className="h-5 w-5" />} to="/admin/announcements" />
        <StatTile label="Registered users" value={totals?.users ?? 0} icon={<Users className="h-5 w-5" />} to="/admin/users" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <HealthCard query={health} />
          <AnalyticsCard stats={stats} />
        </div>
        <SecurityCard security={security} />
      </div>

      <Card>
        <CardHeader icon={<ShieldCheck className="h-5 w-5" />} title="Publishing safeguards" description="Public views only include active records and all administrative changes are audited." />
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['Routes', 'Assign at least two active stops before activation.'],
              ['Schedules', 'Departure stops must belong to the selected route.'],
              ['Notices', 'Use explicit start/end times and the narrowest useful scope.']
            ].map(([title, text]) => (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4" key={title}>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
