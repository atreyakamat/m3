import { createTestApp, type TestContext } from './setup/test-app';
import { auth, createArea, createContractor, createSite, registerWorker } from './setup/fixtures';

/**
 * Scenario: worker starts at SITE-A (North contractor). Destination SITE-B
 * (South contractor). Exercises both initiation directions, rejection,
 * cancellation, the one-pending rule, concurrency, and authorization.
 */
describe('Site transfer workflow (e2e)', () => {
  let ctx: TestContext;
  let north: { contractorId: string; token: string };
  let south: { contractorId: string; token: string };
  let worker: { token: string; workerId: string };

  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.close(); });

  beforeEach(async () => {
    await ctx.reset();
    const areaId = await createArea(ctx);
    north = await createContractor(ctx, { name: 'North Builders', username: 'c.north' });
    south = await createContractor(ctx, { name: 'South Infra', username: 'c.south' });
    await createSite(ctx, { siteCode: 'SITE-A', name: 'Site A', areaId, contractorId: north.contractorId });
    await createSite(ctx, { siteCode: 'SITE-B', name: 'Site B', areaId, contractorId: south.contractorId });
    worker = await registerWorker(ctx, { name: 'Asha', phone: '9000000020', pin: '1234' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(worker.token)).send({ siteId: 'SITE-A' });
  });

  async function currentSite(): Promise<string | null> {
    const me = await ctx.http().get('/api/v1/workers/me').set(...auth(worker.token));
    return me.body.currentSite?.siteId ?? null;
  }

  it('worker-initiated transfer needs BOTH contractors, then completes & moves site', async () => {
    const create = await ctx.http().post('/api/v1/transfers/worker').set(...auth(worker.token)).send({ toSiteId: 'SITE-B' });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe('PENDING_CURRENT_CONTRACTOR');
    const id = create.body.id;

    // one-pending rule
    const dup = await ctx.http().post('/api/v1/transfers/worker').set(...auth(worker.token)).send({ toSiteId: 'SITE-B' });
    expect(dup.status).toBe(409);

    // current (north) approves
    const a1 = await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(north.token)).send({});
    expect(a1.body.status).toBe('PENDING_DESTINATION_CONTRACTOR');
    expect(await currentSite()).toBe('SITE-A'); // not moved yet

    // destination (south) approves -> complete
    const a2 = await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(south.token)).send({});
    expect(a2.body.status).toBe('ACCEPTED');
    expect(await currentSite()).toBe('SITE-B');

    // history retained: old assignment closed, new active
    const assignments = await ctx.prisma.workerSiteAssignment.findMany({ orderBy: { startedAt: 'asc' } });
    expect(assignments.length).toBe(2);
    expect(assignments.filter((x) => x.active).length).toBe(1);
  });

  it('worker-initiated: destination rejection leaves site unchanged', async () => {
    const create = await ctx.http().post('/api/v1/transfers/worker').set(...auth(worker.token)).send({ toSiteId: 'SITE-B' });
    const id = create.body.id;
    await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(north.token)).send({});
    const rej = await ctx.http().post(`/api/v1/transfers/${id}/contractor/reject`).set(...auth(south.token)).send({});
    expect(rej.body.status).toBe('REJECTED');
    expect(await currentSite()).toBe('SITE-A');
  });

  it('contractor-initiated: worker accepts + current contractor approves (no destination approval)', async () => {
    // South is the destination contractor initiating the pull to SITE-B.
    const create = await ctx.http().post('/api/v1/transfers/contractor').set(...auth(south.token))
      .send({ workerId: worker.workerId, toSiteId: 'SITE-B' });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe('PENDING_WORKER_RESPONSE');
    const id = create.body.id;

    // current contractor cannot approve before the worker accepts
    const early = await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(north.token)).send({});
    expect(early.status).toBe(403);

    const accept = await ctx.http().post(`/api/v1/transfers/${id}/worker/accept`).set(...auth(worker.token)).send({});
    expect(accept.body.status).toBe('PENDING_CURRENT_CONTRACTOR');

    const approve = await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(north.token)).send({});
    expect(approve.body.status).toBe('ACCEPTED');
    expect(await currentSite()).toBe('SITE-B');
  });

  it('contractor-initiated: worker rejection leaves site unchanged', async () => {
    const create = await ctx.http().post('/api/v1/transfers/contractor').set(...auth(south.token))
      .send({ workerId: worker.workerId, toSiteId: 'SITE-B' });
    const id = create.body.id;
    const rej = await ctx.http().post(`/api/v1/transfers/${id}/worker/reject`).set(...auth(worker.token)).send({});
    expect(rej.body.status).toBe('REJECTED');
    expect(await currentSite()).toBe('SITE-A');
  });

  it('initiator can cancel a pending request; site unchanged', async () => {
    const create = await ctx.http().post('/api/v1/transfers/worker').set(...auth(worker.token)).send({ toSiteId: 'SITE-B' });
    const id = create.body.id;
    const cancel = await ctx.http().post(`/api/v1/transfers/${id}/cancel`).set(...auth(worker.token)).send({});
    expect(cancel.body.status).toBe('CANCELLED');
    expect(await currentSite()).toBe('SITE-A');
    // a new request can now be created
    const again = await ctx.http().post('/api/v1/transfers/worker').set(...auth(worker.token)).send({ toSiteId: 'SITE-B' });
    expect(again.status).toBe(201);
  });

  it('a contractor cannot approve a transfer that is not theirs', async () => {
    // Register an unrelated contractor with no site on this transfer.
    const other = await createContractor(ctx, { name: 'Other Co', username: 'c.other' });
    const create = await ctx.http().post('/api/v1/transfers/worker').set(...auth(worker.token)).send({ toSiteId: 'SITE-B' });
    const id = create.body.id;
    const res = await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(other.token)).send({});
    expect(res.status).toBe(403);
  });

  it('concurrent approvals complete exactly once with a single active assignment', async () => {
    const create = await ctx.http().post('/api/v1/transfers/worker').set(...auth(worker.token)).send({ toSiteId: 'SITE-B' });
    const id = create.body.id;

    // Fire both contractor approvals simultaneously.
    const [r1, r2] = await Promise.all([
      ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(north.token)).send({}),
      ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(south.token)).send({}),
    ]);
    expect([r1.status, r2.status].every((s) => s === 201)).toBe(true);

    const finalReq = await ctx.prisma.siteTransferRequest.findUnique({ where: { id } });
    expect(finalReq?.status).toBe('ACCEPTED');

    const active = await ctx.prisma.workerSiteAssignment.findMany({ where: { workerId: await workerInternalId(), active: true } });
    expect(active.length).toBe(1);
    expect(await currentSite()).toBe('SITE-B');
  });

  async function workerInternalId(): Promise<string> {
    const w = await ctx.prisma.worker.findUnique({ where: { workerCode: worker.workerId } });
    return w!.id;
  }
});
