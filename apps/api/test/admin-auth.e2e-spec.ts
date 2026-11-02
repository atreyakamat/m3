import { createTestApp, type TestContext } from './setup/test-app';
import { auth, createAdmin, createStaff, createPendingStakeholder, registerWorker } from './setup/fixtures';

describe('Admin authentication & first-login policy (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.close(); });
  beforeEach(async () => { await ctx.reset(); });

  it('an Admin seeded with temporary credentials must change the password at first login', async () => {
    await createAdmin(ctx, { username: 'b.admin', password: 'temp-temp', pending: true });
    const login = await ctx.http().post('/api/v1/auth/staff/login').send({ username: 'b.admin', password: 'temp-temp' });
    expect(login.status).toBe(201);
    expect(login.body.user.credentialChangeRequired).toBe(true);

    // Pending tokens cannot read admin data before the change.
    const blocked = await ctx.http().get('/api/v1/admin/overview').set(...auth(login.body.token));
    expect(blocked.status).toBe(403);

    const res = await ctx.http().post('/api/v1/auth/change-credential').set(...auth(login.body.token))
      .send({ newCredential: 'NewStrong1', confirmCredential: 'NewStrong1' });
    expect(res.status).toBe(201);
    expect(res.body.user.credentialChangeRequired).toBeUndefined();

    // Temporary credentials invalidated; new password accepted.
    const oldLogin = await ctx.http().post('/api/v1/auth/staff/login').send({ username: 'b.admin', password: 'temp-temp' });
    expect(oldLogin.status).toBe(401);
    const newLogin = await ctx.http().post('/api/v1/auth/staff/login').send({ username: 'b.admin', password: 'NewStrong1' });
    expect(newLogin.status).toBe(201);
    expect(newLogin.body.user.credentialChangeRequired).toBeUndefined();
    const overview = await ctx.http().get('/api/v1/admin/overview').set(...auth(newLogin.body.token));
    expect(overview.status).toBe(200);
  });

  it('admin password change requires confirmation and strength', async () => {
    await createAdmin(ctx, { username: 'b.admin2', password: 'temp-temp', pending: true });
    const login = await ctx.http().post('/api/v1/auth/staff/login').send({ username: 'b.admin2', password: 'temp-temp' });
    const token = login.body.token;

    const mismatch = await ctx.http().post('/api/v1/auth/change-credential').set(...auth(token))
      .send({ newCredential: 'NewStrong1', confirmCredential: 'Different2' });
    expect(mismatch.status).toBe(400);

    const weak = await ctx.http().post('/api/v1/auth/change-credential').set(...auth(token))
      .send({ newCredential: 'weak', confirmCredential: 'weak' });
    expect(weak.status).toBe(400);

    const ok = await ctx.http().post('/api/v1/auth/change-credential').set(...auth(token))
      .send({ newCredential: 'NewStrong1', confirmCredential: 'NewStrong1' });
    expect(ok.status).toBe(201);
  });

  it('non-admin users cannot access admin endpoints', async () => {
    const staff = await createStaff(ctx, { role: 'CLINICIAN', username: 'clin' });
    const worker = await registerWorker(ctx, { name: 'Asha', phone: '9000000010', pin: '1234' });
    for (const token of [staff.token, worker.token]) {
      const res = await ctx.http().get('/api/v1/admin/overview').set(...auth(token));
      expect(res.status).toBe(403);
    }
  });

  it('admin-created stakeholders log in with phone + temporary PIN and are forced to reset it', async () => {
    await createPendingStakeholder(ctx, { role: 'HEALTH_WORKER', stakeholderCode: 'HW000001', phone: '9300000001', tempPin: '8642' });

    const login = await ctx.http().post('/api/v1/auth/staff/login').send({ username: '9300000001', password: '8642' });
    expect(login.status).toBe(201);
    expect(login.body.user.credentialChangeRequired).toBe(true);
    expect(login.body.user.role).toBe('HEALTH_WORKER');

    // PIN reset required before any protected dashboard data is accessible.
    const portal = await ctx.http().get('/api/v1/stakeholders/dashboard').set(...auth(login.body.token));
    expect(portal.status).toBe(403);

    const change = await ctx.http().post('/api/v1/auth/change-credential').set(...auth(login.body.token))
      .send({ newCredential: '9753', confirmCredential: '9753' });
    expect(change.status).toBe(201);
  });

  it('worker login remains unchanged (phone + PIN, no forced credential change)', async () => {
    await registerWorker(ctx, { name: 'Asha', phone: '9000000099', pin: '1234' });
    const login = await ctx.http().post('/api/v1/auth/worker/login').send({ phone: '9000000099', pin: '1234' });
    expect(login.status).toBe(201);
    expect(login.body.user.workerId).toMatch(/^M3-/);
    const me = await ctx.http().get('/api/v1/workers/me').set(...auth(login.body.token));
    expect(me.status).toBe(200);
  });

  it('stakeholder phone numbers cannot collide with worker phone numbers', async () => {
    await registerWorker(ctx, { name: 'Asha', phone: '9000000077', pin: '1234' });
    const admin = await createAdmin(ctx, { username: 'a.dupe.phone' });
    const res = await ctx.http().post('/api/v1/admin/users').set(...auth(admin.token))
      .send({ fullName: 'Dup Phone', phone: '9000000077', role: 'CLINICIAN', tempPin: '1234' });
    expect(res.status).toBe(409);
  });
});
