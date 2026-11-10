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

  it('worker-initiated transfer needs destination approval then current contractor release', async () => {
    const create = await ctx.http().post('/api/v1/transfers/worker').set(...auth(worker.token)).send({ toSiteId: 'SITE-B' });
    expect(create.status).toBe(201);
    expect(create.body.status).toBe('PENDING_DESTINATION_CONTRACTOR');
    const id = create.body.id;

    // one-pending rule
    const dup = await ctx.http().post('/api/v1/transfers/worker').set(...auth(worker.token)).send({ toSiteId: 'SITE-B' });
    expect(dup.status).toBe(409);

    // current (north) cannot release before destination approval
    const early = await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(north.token)).send({});
    expect(early.status).toBe(403);

    // destination (south) approves -> moves to current contractor release
    const a1 = await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(south.token)).send({});
    expect(a1.body.status).toBe('PENDING_CURRENT_CONTRACTOR');
    expect(await currentSite()).toBe('SITE-A'); // not moved yet

    // current contractor (north) releases worker -> complete
    const a2 = await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(north.token)).send({});
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

  it('duplicate approval attempts are rejected and approval sequence is strictly enforced', async () => {
    const create = await ctx.http().post('/api/v1/transfers/worker').set(...auth(worker.token)).send({ toSiteId: 'SITE-B' });
    const id = create.body.id;

    // Fire duplicate destination approvals simultaneously
    const [r1, r2] = await Promise.all([
      ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(south.token)).send({}),
      ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(south.token)).send({}),
    ]);
    const statuses = [r1.status, r2.status].sort();
    // One succeeds (201), the duplicate is rejected (403 or 409)
    expect(statuses[0]).toBe(201);
    expect([403, 409]).toContain(statuses[1]);

    // Current contractor releases
    const rRelease = await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(north.token)).send({});
    expect(rRelease.status).toBe(201);
    expect(rRelease.body.status).toBe('ACCEPTED');

    // Duplicate release attempt is rejected (request is closed)
    const rDupRelease = await ctx.http().post(`/api/v1/transfers/${id}/contractor/approve`).set(...auth(north.token)).send({});
    expect(rDupRelease.status).toBe(409);

    const active = await ctx.prisma.workerSiteAssignment.findMany({ where: { workerId: await workerInternalId(), active: true } });
    expect(active.length).toBe(1);
    expect(await currentSite()).toBe('SITE-B');
  });

  async function workerInternalId(): Promise<string> {
    const w = await ctx.prisma.worker.findUnique({ where: { workerCode: worker.workerId } });
    return w!.id;
  }
});
