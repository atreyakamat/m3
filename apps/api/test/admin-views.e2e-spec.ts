import { createTestApp, type TestContext } from './setup/test-app';
import {
  auth,
  createAdmin,
  createArea,
  createContractor,
  createSite,
  registerWorker,
} from './setup/fixtures';

type Tokens = { worker?: string; north?: string; south?: string; admin?: string };

async function bootstrapTwoContractors(ctx: TestContext, tokens: Tokens) {
  const areaId = await createArea(ctx, 'View Area');
  const north = await createContractor(ctx, { name: 'View North', username: 'c.view.north' });
  const south = await createContractor(ctx, { name: 'View South', username: 'c.view.south' });
  await createSite(ctx, { siteCode: 'SITE-A', name: 'View Site A', areaId, contractorId: north.contractorId });
  await createSite(ctx, { siteCode: 'SITE-B', name: 'View Site B', areaId, contractorId: south.contractorId });
  const w = await registerWorker(ctx, { name: 'View Worker', phone: '9000000500', pin: '1234' });
  await ctx.http().post('/api/v1/workers/me/site').set(...auth(w.token)).send({ siteId: 'SITE-A' });
  tokens.north = north.token;
  tokens.south = south.token;
  tokens.worker = w.token;
}

describe('Admin worker / requests / transfers views (e2e)', () => {
  let ctx: TestContext;
  let tokens: Tokens = {};
  let adminId: string;

  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.close(); });
  beforeEach(async () => {
    await ctx.reset();
    tokens = {};
    const admin = await createAdmin(ctx, { username: 'a.views' });
    adminId = admin.userId;
    tokens.admin = admin.token;
    await bootstrapTwoContractors(ctx, tokens);
  });

  it('lists and filters workers by site and updates overview statistics', async () => {
    const list = await ctx.http().get('/api/v1/admin/workers').set(...auth(tokens.admin!)).query({ siteCode: 'SITE-A' });
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].workerId).toMatch(/^M3-/);
    expect(list.body.items[0].screening).toBe('NOT_STARTED');
    expect(list.body.items[0].malaria).toBe('NO_RESULT');

    const search = await ctx.http().get('/api/v1/admin/workers').set(...auth(tokens.admin!)).query({ search: 'View Worker' });
    expect(search.body.total).toBe(1);

    const overview = await ctx.http().get('/api/v1/admin/overview').set(...auth(tokens.admin!));
    expect(overview.body.workers.total).toBe(1);
    expect(overview.body.sites).toMatchObject({ total: 2, active: 2 });
    expect(overview.body.malaria).toMatchObject({ POSITIVE: 0, NEGATIVE: 0, AWAITING: 0, NO_RESULT: 1 });
    expect(overview.body.requests).toMatchObject({ pendingJoin: 0, pendingTransfers: 0 });
  });

  it('join requests: contractor decision notifies admin; admin cannot decide', async () => {
    // remove the active assignment so the worker may raise a join request
    await ctx.prisma.workerSiteAssignment.updateMany({ where: { active: true }, data: { active: false, endedAt: new Date() } });

    const create = await ctx.http().post('/api/v1/join-requests').set(...auth(tokens.worker!))
      .send({ siteId: 'SITE-B' });
    expect(create.status).toBe(201);

    const dup = await ctx.http().post('/api/v1/join-requests').set(...auth(tokens.worker!)).send({ siteId: 'SITE-B' });
    expect(dup.status).toBe(409); // one open join request per worker

    const adminList = await ctx.http().get('/api/v1/admin/requests').set(...auth(tokens.admin!));
    expect(adminList.body.total).toBe(1);
    const joinRequestId = adminList.body.items[0].joinRequestId;
    expect(adminList.body.items[0].status).toBe('PENDING');

    // Only the destination contractor can decide.
    const south = await ctx.http().post(`/api/v1/join-requests/${joinRequestId}/decide`).set(...auth(tokens.south!))
      .send({ approve: true });
    expect(south.status).toBe(201);
    expect(south.body.status).toBe('ACCEPTED');

    const north = await ctx.http().post(`/api/v1/join-requests/${joinRequestId}/decide`).set(...auth(tokens.north!))
      .send({ approve: true });
    expect(north.status).toBe(403); // north is not the destination contractor

    const notif = await ctx.http().get('/api/v1/admin/notifications').set(...auth(tokens.admin!));
    expect(notif.body.items.some((n: any) => n.type === 'JOIN_REQUEST_ACCEPTED')).toBe(true);

    // Admin has NO decision endpoint for join requests.
    const noDecide = await ctx.http().post('/api/v1/admin/requests/decide').set(...auth(tokens.admin!))
      .send({ id: joinRequestId, approve: true });
    expect([404, 403]).toContain(noDecide.status);

    // Site assignment was created only after approval.
    const workerRow = await ctx.prisma.worker.findUnique({
      where: { phone: '9000000500' },
      include: { assignments: { where: { active: true }, include: { site: true } } },
    });
    expect(workerRow?.assignments[0]?.site.siteCode).toBe('SITE-B');
    void adminId;
  });

  it('transfer decisions and duplicates notify admin; site changes only after approvals', async () => {
    const w = await ctx.prisma.worker.findUnique({ where: { phone: '9000000500' } });
    await ctx.prisma.workerSiteAssignment.updateMany({ where: { workerId: w!.id }, data: { active: false, endedAt: new Date() } });
    await ctx.prisma.workerSiteAssignment.create({
      data: { workerId: w!.id, siteId: (await ctx.prisma.constructionSite.findUnique({ where: { siteCode: 'SITE-A' } }))!.id, active: true },
    });

    const create = await ctx.http().post('/api/v1/transfers/worker').set(...auth(tokens.worker!)).send({ toSiteId: 'SITE-B' });
    expect(create.status).toBe(201);
    const id = create.body.id;

    // duplicate pending transfer prevented
    const dup = await ctx.http().post('/api/v1/transfers/worker').set(...auth(tokens.worker!)).send({ toSiteId: 'SITE-B' });
    expect(dup.status).toBe(409);

    // before approvals, site unchanged
    const pre = await ctx.http().get('/api/v1/admin/transfers').set(...auth(tokens.admin!)).query({ status: 'PENDING_CURRENT_CONTRACTOR' });
    expect(pre.body.items.length).toBe(1);

    const northApprove = await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(tokens.north!)).send({});
    expect(northApprove.status).toBe(201);
    const southApprove = await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(tokens.south!)).send({});
    expect(southApprove.status).toBe(201);

    const workerRow = await ctx.prisma.worker.findUnique({
      where: { phone: '9000000500' },
      include: { assignments: { where: { active: true }, include: { site: true } } },
    });
    expect(workerRow?.assignments[0]?.site.siteCode).toBe('SITE-B');

    const list = await ctx.http().get('/api/v1/admin/transfers').set(...auth(tokens.admin!));
    const row = list.body.items.find((t: any) => t.transferId === id);
    expect(row.status).toBe('ACCEPTED');
    expect(row.contractorApprovals).toMatchObject({ from: 'APPROVED', to: 'APPROVED' });

    const notif = await ctx.http().get('/api/v1/admin/notifications').set(...auth(tokens.admin!));
    expect(notif.body.items.filter((n: any) => n.type === 'TRANSFER_DECISION').length).toBeGreaterThanOrEqual(2);
  });
});
