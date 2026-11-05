import { createTestApp, type TestContext } from './setup/test-app';
import {
  auth,
  createAdmin,
  createArea,
  createContractor,
  createSite,
  createStaff,
  registerWorker,
} from './setup/fixtures';

describe('Admin travel reports (e2e)', () => {
  let ctx: TestContext;
  let admin: { token: string };
  let clinician: { token: string };

  interface Bench {
    contractorToken: string;
    workerToken: string;
    workerCode: string;
  }

  async function buildPositiveWorker(
    opts: { phone: string; result: 'POSITIVE' | 'NEGATIVE' | 'AWAITING'; withTravel: boolean; siteCode?: string },
  ): Promise<Bench> {
    const areaId = await createArea(ctx, 'Travel Area');
    const contractor = await createContractor(ctx, { name: 'Travel Builders', username: `c.travel.${opts.phone}`.slice(0, 40) });
    const siteCode = opts.siteCode ?? `SITE-TRV-${opts.phone}`;
    let site = await ctx.prisma.constructionSite.findUnique({ where: { siteCode } });
    if (!site) {
      site = await ctx.prisma.constructionSite.create({ data: { siteCode, name: 'Travel Site', areaId, contractorId: contractor.contractorId } });
    }
    const w = await registerWorker(ctx, { name: 'Traveller', phone: opts.phone, pin: '1234' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(w.token)).send({ siteId: siteCode });

    const episode = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token))
      .send({ workerId: w.workerId });
    if (opts.result !== 'AWAITING') {
      await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token))
        .send({ episodeId: episode.body.id, testType: 'RDT', result: opts.result, testDate: new Date().toISOString() });
    }
    let travelRecordId: string | undefined = undefined;
    if (opts.withTravel) {
      const travel = await ctx.http().post('/api/v1/records/me/travel').set(...auth(w.token))
        .send({
          planningTravel: true,
          departureDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
          destination: 'Delhi',
          state: 'Delhi',
        });
      travelRecordId = travel.body.id;
    }
    return { contractorToken: contractor.token, workerToken: w.token, workerCode: w.workerId, _travelRecordId: travelRecordId } as unknown as Bench & { _travelRecordId?: string };
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    admin = await createAdmin(ctx, { username: 'a.travel' });
    clinician = await createStaff(ctx, { role: 'CLINICIAN', username: 'c.vote' });
  });
  afterAll(async () => { await ctx.close(); });
  beforeEach(async () => {
    await ctx.reset();
    admin = await createAdmin(ctx, { username: 'a.travel' });
    clinician = await createStaff(ctx, { role: 'CLINICIAN', username: 'c.vote' });
  });

  it('positive worker departing within 7 days is flagged and requires one contractor report with a comment', async () => {
    const b = await buildPositiveWorker({ phone: '9000000601', result: 'POSITIVE', withTravel: true }) as Bench & { _travelRecordId?: string };
    const alerts = await ctx.http().get('/api/v1/travel/alerts/my-sites').set(...auth(b.contractorToken));
    expect(alerts.status).toBe(200);
    expect(alerts.body.length).toBe(1);
    expect(alerts.body[0].requiresReport).toBe(true);

    const report = await ctx.http().post('/api/v1/travel/reports').set(...auth(b.contractorToken))
      .send({ workerId: b.workerCode, travelRecordId: b._travelRecordId, comment: 'Approved travel for family emergency' });
    expect(report.status).toBe(201);

    // duplicate report for the same travel case is prevented
    const dup = await ctx.http().post('/api/v1/travel/reports').set(...auth(b.contractorToken))
      .send({ workerId: b.workerCode, travelRecordId: b._travelRecordId, comment: 'Again' });
    expect(dup.status).toBe(409);

    const list = await ctx.http().get('/api/v1/admin/travel-reports').set(...auth(admin.token));
    expect(list.body.total).toBe(1);
    const id = list.body.items[0].id;

    const reviewed = await ctx.http().post(`/api/v1/admin/travel-reports/${id}/review`).set(...auth(admin.token))
      .send({ status: 'REVIEWED', note: 'Coordinated with health team' });
    expect(reviewed.body.status).toBe('REVIEWED');

    // Notifications reached Admin and other recipients.
    expect(await ctx.prisma.notification.count({ where: { type: 'TRAVEL_REPORT_SUBMITTED', audienceRole: 'ADMIN' } })).toBe(1);
    expect(await ctx.prisma.notification.count({ where: { type: 'TRAVEL_REPORT_SUBMITTED', audienceRole: 'CLINICIAN' } })).toBe(1);
    expect(await ctx.prisma.notification.count({ where: { type: 'TRAVEL_REPORT_SUBMITTED', audienceRole: 'RESEARCH_LAB' } })).toBe(1);
  });

  it('negative and awaiting-result workers are handled separately and never trigger reports', async () => {
    const neg = await buildPositiveWorker({ phone: '9000000611', result: 'NEGATIVE', withTravel: true }) as Bench & { _travelRecordId?: string };
    const awaiter = await buildPositiveWorker({ phone: '9000000612', result: 'AWAITING', withTravel: true }) as Bench & { _travelRecordId?: string };

    const negAlerts = await ctx.http().get('/api/v1/travel/alerts/my-sites').set(...auth(neg.contractorToken));
    expect(negAlerts.body.length).toBe(0);
    const awaitAlerts = await ctx.http().get('/api/v1/travel/alerts/my-sites').set(...auth(awaiter.contractorToken));
    expect(awaitAlerts.body.length).toBe(0);

    const negTry = await ctx.http().post('/api/v1/travel/reports').set(...auth(neg.contractorToken))
      .send({ workerId: neg.workerCode, travelRecordId: neg._travelRecordId, comment: 'Should not be allowed' });
    expect(negTry.status).toBe(400);

    const overview = await ctx.http().get('/api/v1/admin/overview').set(...auth(admin.token));
    expect(overview.body.malaria).toMatchObject({ POSITIVE: 0, NEGATIVE: 1, AWAITING: 1, NO_RESULT: 0 });
  });

  it('cancellation keeps the report, notifies recipients and records the audit trail', async () => {
    const b = await buildPositiveWorker({ phone: '9000000621', result: 'POSITIVE', withTravel: true }) as Bench & { _travelRecordId?: string };
    await ctx.http().post('/api/v1/travel/reports').set(...auth(b.contractorToken))
      .send({ workerId: b.workerCode, travelRecordId: b._travelRecordId, comment: 'Family travel' });

    const cancel = await ctx.http().post('/api/v1/travel/my-record/cancel').set(...auth(b.workerToken))
      .send({ travelRecordId: b._travelRecordId, reason: 'Trip postponed' });
    expect(cancel.status).toBe(201);
    expect(cancel.body.reportPreserved).toBe(true);

    // the report is not deleted
    const list = await ctx.http().get('/api/v1/admin/travel-reports').set(...auth(admin.token));
    expect(list.body.total).toBe(1);
    const detail = await ctx.http().get(`/api/v1/admin/travel-reports/${list.body.items[0].id}`).set(...auth(admin.token));
    expect(detail.body.travelRecord.status).toBe('CANCELLED');
    expect(detail.body.cancellationNotifications.length).toBeGreaterThanOrEqual(1);

    expect(await ctx.prisma.auditLog.count({ where: { action: 'TRAVEL_RECORD_CANCELLED' } })).toBe(1);
  });
});
