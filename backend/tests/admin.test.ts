import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { isoNow, mutateData, nextId, resetData } from '../src/data/store.js';

process.env.NODE_ENV = 'test';
const { app } = await import('../src/app.js');
const { resetSecurityEvents } = await import('../src/services/security-events.js');
const { parseHealthTargets } = await import('../src/modules/admin/health.js');

// The auth limiter allows 20 login/register calls per 15 minutes per address,
// so these tests keep their total number of logins well below that.
const PASSWORD = 'long-enough-password';
const hash = await bcrypt.hash(PASSWORD, 4);

async function addUser(name: string, email: string, role: 'student' | 'admin') {
  return mutateData((data) => {
    const id = nextId(data, 'users');
    data.users.push({ id, name, email, passwordHash: hash, role, parentEmail: 'parent-secret@example.edu', createdAt: isoNow() });
    return id;
  });
}

async function signIn(email: string, password = PASSWORD) {
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/auth/csrf')).body.data.csrfToken;
  const login = await agent.post('/api/auth/login').set('x-csrf-token', csrf).send({ email, password, turnstileToken: 'test-token' });
  return { agent, login, csrf: (login.body.data?.csrfToken ?? csrf) as string };
}

describe('admin dashboard API', () => {
  beforeEach(async () => {
    await resetData();
    resetSecurityEvents();
  });

  it('rejects anonymous callers (401) and students (403) on every admin endpoint', async () => {
    for (const path of ['/api/admin/stats', '/api/admin/security', '/api/admin/health', '/api/admin/users']) {
      const anonymous = await request(app).get(path);
      expect(anonymous.status, path).toBe(401);
      expect(anonymous.body.error.code).toBe('UNAUTHENTICATED');
    }

    const targetId = await addUser('Other Student', 'other@example.edu', 'student');
    await addUser('Plain Student', 'student@example.edu', 'student');
    const { agent, csrf } = await signIn('student@example.edu');
    for (const path of ['/api/admin/stats', '/api/admin/security', '/api/admin/health', '/api/admin/users']) {
      const response = await agent.get(path);
      expect(response.status, path).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }
    const escalation = await agent.patch(`/api/admin/users/${targetId}`).set('x-csrf-token', csrf).send({ role: 'admin' });
    expect(escalation.status).toBe(403);
  });

  it('returns usage statistics and service health to administrators', async () => {
    await addUser('Test Admin', 'admin@example.edu', 'admin');
    const student = await addUser('Test Student', 'student@example.edu', 'student');
    await mutateData((data) => { data.favorites.push({ id: nextId(data, 'favorites'), userId: student, stopId: 1, createdAt: isoNow() }); });
    const { agent } = await signIn('admin@example.edu');

    const stats = await agent.get('/api/admin/stats');
    expect(stats.status).toBe(200);
    expect(stats.body.data.totals).toMatchObject({ users: 2, students: 1, admins: 1, disabledUsers: 0, favorites: 1, activeRoutes: 2, activeStops: 4 });
    expect(stats.body.data.registrationsByDay).toHaveLength(14);
    expect(stats.body.data.registrationsByDay.reduce((sum: number, day: { count: number }) => sum + day.count, 0)).toBe(2);
    expect(stats.body.data.topStops[0]).toMatchObject({ stop_id: 1, favorites: 1 });
    expect(JSON.stringify(stats.body)).not.toContain('passwordHash');

    const health = await agent.get('/api/admin/health');
    expect(health.status).toBe(200);
    expect(health.body.data.overall).toBe('up');
    expect(health.body.data.services[0]).toMatchObject({ name: 'api (this server)', status: 'up' });
    expect(health.body.data.process.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('lists users with search, role filter and pagination, without sensitive fields', async () => {
    await addUser('Test Admin', 'admin@example.edu', 'admin');
    await addUser('Alice Student', 'alice@example.edu', 'student');
    await addUser('Bob Student', 'bob@example.edu', 'student');
    const { agent } = await signIn('admin@example.edu');

    const all = await agent.get('/api/admin/users?limit=2');
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    const body = JSON.stringify(all.body);
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain('parent-secret@example.edu');

    const search = await agent.get('/api/admin/users?q=ali&role=student');
    expect(search.body.data.map((user: { email: string }) => user.email)).toEqual(['alice@example.edu']);

    const invalid = await agent.get('/api/admin/users?limit=1000&role=root');
    expect(invalid.status).toBe(400);
  });

  it('disables an account immediately, blocks its login, and audits the change', async () => {
    await addUser('Test Admin', 'admin@example.edu', 'admin');
    const studentId = await addUser('Test Student', 'student@example.edu', 'student');
    const admin = await signIn('admin@example.edu');
    const student = await signIn('student@example.edu');
    expect((await student.agent.get('/api/favorites')).status).toBe(200);

    const disabled = await admin.agent.patch(`/api/admin/users/${studentId}`).set('x-csrf-token', admin.csrf).send({ disabled: true });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data).toMatchObject({ id: studentId, disabled: true, role: 'student' });

    // The existing session stops working right away, not after it expires.
    const afterDisable = await student.agent.get('/api/favorites');
    expect(afterDisable.status).toBe(401);
    // And a fresh login is refused.
    const retry = await signIn('student@example.edu');
    expect(retry.login.status).toBe(403);
    expect(retry.login.body.error.code).toBe('ACCOUNT_DISABLED');

    const audit = await admin.agent.get('/api/audit-logs?resource=user&action=update');
    expect(audit.body.data).toHaveLength(1);
    expect(audit.body.data[0].metadata.changes.disabled).toEqual([false, true]);
    expect(JSON.stringify(audit.body.data[0].metadata)).not.toContain('student@example.edu');
  });

  it('applies a demotion on the next request', async () => {
    const first = await addUser('First Admin', 'first@example.edu', 'admin');
    const second = await addUser('Second Admin', 'second@example.edu', 'admin');
    expect(first).not.toBe(second);
    const a = await signIn('first@example.edu');
    const b = await signIn('second@example.edu');
    expect((await b.agent.get('/api/admin/stats')).status).toBe(200);

    const demote = await a.agent.patch(`/api/admin/users/${second}`).set('x-csrf-token', a.csrf).send({ role: 'student' });
    expect(demote.status).toBe(200);
    expect((await b.agent.get('/api/admin/stats')).status).toBe(403);
  });

  it('refuses self-modification and invalid updates', async () => {
    const adminId = await addUser('Test Admin', 'admin@example.edu', 'admin');
    const studentId = await addUser('Test Student', 'student@example.edu', 'student');
    const { agent, csrf } = await signIn('admin@example.edu');
    const patch = (id: number | string, body: unknown, token: string | null = csrf) => {
      const req = agent.patch(`/api/admin/users/${id}`);
      return (token ? req.set('x-csrf-token', token) : req).send(body as object);
    };

    const self = await patch(adminId, { disabled: true });
    expect(self.status).toBe(403);
    expect(self.body.error.code).toBe('SELF_MODIFICATION');
    expect((await patch(adminId, { role: 'student' })).status).toBe(403);

    expect((await patch(studentId, {})).status).toBe(400);
    expect((await patch(studentId, { passwordHash: 'x' })).status).toBe(400);
    expect((await patch(studentId, { role: 'superuser' })).status).toBe(400);
    expect((await patch(studentId, { disabled: 'yes' })).status).toBe(400);
    expect((await patch('abc', { disabled: true })).status).toBe(400);
    expect((await patch(9999, { disabled: true })).status).toBe(404);

    const noCsrf = await patch(studentId, { disabled: true }, null);
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe('CSRF_INVALID');
  });

  it('records failed logins and denied requests without storing personal data', async () => {
    await addUser('Test Admin', 'admin@example.edu', 'admin');
    await request(app).get('/api/admin/stats'); // anonymous: one "unauthenticated" event
    await request(app).get('/api/auth/me'); // logged-out page load: must not count as an event
    for (let attempt = 0; attempt < 5; attempt += 1) await signIn('victim@example.edu', 'wrong-password-value');

    const { agent } = await signIn('admin@example.edu');
    const security = await agent.get('/api/admin/security');
    expect(security.status).toBe(200);
    expect(security.body.data.counts).toMatchObject({ login_failed: 5, unauthenticated: 1, login_success: 1 });
    expect(security.body.data.hourly).toHaveLength(24);
    expect(security.body.data.hourly[23]).toMatchObject({ concerning: 6, loginFailures: 5 });
    expect(security.body.data.suspicious).toHaveLength(1);
    expect(security.body.data.suspicious[0].failedLogins).toBe(5);
    expect(security.body.data.recent.length).toBeGreaterThan(0);

    const serialized = JSON.stringify(security.body);
    expect(serialized).not.toContain('victim@example.edu');
    expect(serialized).not.toContain('wrong-password-value');
    expect(serialized).not.toContain('admin@example.edu');
  });
});

describe('health target configuration', () => {
  it('accepts name=url pairs and ignores anything unsafe or malformed', () => {
    expect(parseHealthTargets(undefined)).toEqual([]);
    expect(parseHealthTargets('')).toEqual([]);
    const parsed = parseHealthTargets('routes=http://10.0.0.11:4001/api/health, timetables=https://svc.example.edu/health');
    expect(parsed.map((item) => item.name)).toEqual(['routes', 'timetables']);
    expect(parseHealthTargets('files=file:///etc/passwd,ftp=ftp://example.edu,=http://x.test,bad name=http://x.test,nourl,broken=not a url')).toEqual([]);
  });
});
