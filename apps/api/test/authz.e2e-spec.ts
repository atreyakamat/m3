import { createTestApp, type TestContext } from './setup/test-app';
import { auth, createStaff, registerWorker } from './setup/fixtures';

describe('Authentication & RBAC (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.close(); });
  beforeEach(async () => { await ctx.reset(); });

  it('rejects unauthenticated access to protected routes', async () => {
    const res = await ctx.http().get('/api/v1/workers/me');
    expect(res.status).toBe(401);
  });

  it('forbids a worker from contractor-only endpoints', async () => {
    const worker = await registerWorker(ctx, { name: 'Asha', phone: '9000000040', pin: '1234' });
    const res = await ctx.http().get('/api/v1/transfers/approvals').set(...auth(worker.token));
    expect(res.status).toBe(403);
  });

  it('forbids a placeholder-role staff from worker endpoints', async () => {
    const admin = await createStaff(ctx, { role: 'ADMIN', username: 'admin1' });
    const res = await ctx.http().get('/api/v1/workers/me').set(...auth(admin.token));
    expect(res.status).toBe(403);
  });

  it('returns a placeholder dashboard for non-implemented roles (no fabricated data)', async () => {
    const path = await createStaff(ctx, { role: 'PATHOLOGIST', username: 'path1' });
    const res = await ctx.http().get('/api/v1/stakeholders/dashboard').set(...auth(path.token));
    expect(res.status).toBe(200);
    expect(res.body.implemented).toBe(false);
    expect(res.body.role).toBe('PATHOLOGIST');
  });

  it('health endpoint is public', async () => {
    const res = await ctx.http().get('/api/v1/meta/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
