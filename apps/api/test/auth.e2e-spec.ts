import { createTestApp, type TestContext } from './setup/test-app';
import { registerWorker } from './setup/fixtures';

describe('Auth & worker identity (e2e)', () => {
  let ctx: TestContext;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.close(); });
  beforeEach(async () => { await ctx.reset(); });

  it('registers a new worker and issues a Worker ID + token', async () => {
    const res = await ctx.http()
      .post('/api/v1/auth/worker/register')
      .send({ name: 'Asha', phone: '9000000001', pin: '1234', preferredLanguage: 'hi' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('WORKER');
    expect(res.body.user.workerId).toMatch(/^M3-/);
  });

  it('rejects duplicate registration (same phone) — no duplicate worker record', async () => {
    await registerWorker(ctx, { name: 'Asha', phone: '9000000002', pin: '1234' });
    const dup = await ctx.http()
      .post('/api/v1/auth/worker/register')
      .send({ name: 'Asha2', phone: '9000000002', pin: '5678', preferredLanguage: 'en' });
    expect(dup.status).toBe(409);
    expect(await ctx.prisma.worker.count({ where: { phone: '9000000002' } })).toBe(1);
  });

  it('recognises a returning worker via login (same identity)', async () => {
    const first = await registerWorker(ctx, { name: 'Asha', phone: '9000000003', pin: '1234' });
    const login = await ctx.http().post('/api/v1/auth/worker/login').send({ phone: '9000000003', pin: '1234' });
    expect(login.status).toBe(201);
    expect(login.body.user.workerId).toBe(first.workerId);
  });

  it('rejects wrong PIN', async () => {
    await registerWorker(ctx, { name: 'Asha', phone: '9000000004', pin: '1234' });
    const login = await ctx.http().post('/api/v1/auth/worker/login').send({ phone: '9000000004', pin: '9999' });
    expect(login.status).toBe(401);
  });

  it('validates registration input (bad phone/pin)', async () => {
    const res = await ctx.http()
      .post('/api/v1/auth/worker/register')
      .send({ name: 'X', phone: 'abc', pin: '12' });
    expect(res.status).toBe(400);
  });

  it('exists endpoint routes returning vs new workers', async () => {
    await registerWorker(ctx, { name: 'Asha', phone: '9000000005', pin: '1234' });
    const yes = await ctx.http().get('/api/v1/auth/exists?phone=9000000005');
    const no = await ctx.http().get('/api/v1/auth/exists?phone=9111111111');
    expect(yes.body.exists).toBe(true);
    expect(no.body.exists).toBe(false);
  });
});
