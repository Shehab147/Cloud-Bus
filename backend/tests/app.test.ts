import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { isoNow, mutateData, nextId, resetData } from '../src/data/store.js';

const { app } = await import('../src/app.js');

describe('API security and response conventions', () => {
  beforeEach(async () => resetData());

  it('returns minimal liveness JSON when local storage is available', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toContain('campus-bus.json');
  });

  it('requires a session-bound CSRF token for mutations', async () => {
    const response = await request(app).post('/api/auth/register').send({ name: 'Test Student', email: 'test@example.edu', password: 'long-enough-password' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('CSRF_INVALID');
  });

  it('accepts the CSRF token then applies authentication authorization', async () => {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf');
    const response = await agent.post('/api/routes').set('x-csrf-token', csrf.body.data.csrfToken).send({ name: 'North Loop' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects unsupported content types and malformed JSON safely', async () => {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf');
    const contentType = await agent.post('/api/auth/register').set('x-csrf-token', csrf.body.data.csrfToken).set('content-type', 'text/plain').send('hello');
    expect(contentType.status).toBe(400);
    expect(contentType.body.error.code).toBe('INVALID_CONTENT_TYPE');
    const malformed = await agent.post('/api/auth/register').set('x-csrf-token', csrf.body.data.csrfToken).set('content-type', 'application/json').send('{bad json');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('MALFORMED_JSON');
  });

  it('returns generic invalid-login feedback without account enumeration', async () => {
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf');
    const response = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.data.csrfToken).send({ email: 'missing@example.edu', password: 'incorrect-password' });
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Email or password is incorrect.');
  });

  it('filters inactive public routes and returns pagination metadata', async () => {
    const response = await request(app).get('/api/routes?q=demo&page=1&limit=20&status=inactive');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data.every((route: { status: string }) => route.status === 'active')).toBe(true);
    expect(response.body.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it('registers, logs in, and persists a student favorite', async () => {
    const agent = request.agent(app);
    const firstCsrf = (await agent.get('/api/auth/csrf')).body.data.csrfToken;
    const register = await agent.post('/api/auth/register').set('x-csrf-token', firstCsrf).send({ name: 'Test Student', email: 'student@example.edu', password: 'long-enough-password' });
    expect(register.status).toBe(201);

    const login = await agent.post('/api/auth/login').set('x-csrf-token', firstCsrf).send({ email: 'student@example.edu', password: 'long-enough-password' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('student');

    const favorite = await agent.post('/api/favorites').set('x-csrf-token', login.body.data.csrfToken).send({ stopId: 1 });
    expect(favorite.status).toBe(201);
    const list = await agent.get('/api/favorites');
    expect(list.body.data.map((item: { stop_id: number }) => item.stop_id)).toEqual([1]);
  });

  it('authorizes an administrator and records a local-store audit event', async () => {
    const passwordHash = await bcrypt.hash('admin-test-password', 4);
    await mutateData((data) => {
      data.users.push({ id: nextId(data, 'users'), name: 'Test Admin', email: 'admin@example.edu', passwordHash, role: 'admin', createdAt: isoNow() });
    });
    const agent = request.agent(app);
    const csrf = (await agent.get('/api/auth/csrf')).body.data.csrfToken;
    const login = await agent.post('/api/auth/login').set('x-csrf-token', csrf).send({ email: 'admin@example.edu', password: 'admin-test-password' });
    const created = await agent.post('/api/stops').set('x-csrf-token', login.body.data.csrfToken).send({ name: 'Test Inactive Stop', latitude: 30.05, longitude: 31.28, status: 'inactive' });
    expect(created.status).toBe(201);

    const audit = await agent.get('/api/audit-logs?resource=stop&action=create');
    expect(audit.status).toBe(200);
    expect(audit.body.data).toHaveLength(1);
    expect(audit.body.data[0].user_email).toBe('admin@example.edu');
  });
});
