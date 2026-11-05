import { createTestApp, type TestContext } from './setup/test-app';
import {
  auth,
  createArea,
  createStaff,
  registerWorker,
} from './setup/fixtures';
import * as bcrypt from 'bcryptjs';

describe('Contractor Mobile Module APIs (e2e)', () => {
  let ctx: TestContext;
  let clinician: { token: string };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.reset();
    clinician = await createStaff(ctx, { role: 'CLINICIAN', username: 'clin.contractor' });
  });

  it('Contractor complete workflow: auth, first-login PIN change, sites stats, workers, requests, travel alert & report, notifications', async () => {
    const areaId = await createArea(ctx, 'Panaji North');

    // 1. Admin provisions Contractor C000001
    const contractorRecord = await ctx.prisma.contractor.create({
      data: { name: 'Goa Coastal Builders' },
    });
    const tempPinHash = await bcrypt.hash('4321', 10);
    const contractorUser = await ctx.prisma.user.create({
      data: {
        role: 'CONTRACTOR',
        phone: '9822112233',
        stakeholderCode: 'C000001',
        displayName: 'Goa Coastal Builders',
        passwordHash: tempPinHash,
        mustChangeCredential: true,
        contractorId: contractorRecord.id,
      },
    });

    // 2. Provision two sites assigned to this contractor
    const site1 = await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-CTR1',
        name: 'Miramar Heights',
        areaId,
        contractorId: contractorRecord.id,
      },
    });
    const site2 = await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-CTR2',
        name: 'Dona Paula Bay',
        areaId,
        contractorId: contractorRecord.id,
      },
    });

    // 3. Unified login with phone and temporary PIN
    const loginRes = await ctx.http()
      .post('/api/v1/auth/login')
      .send({ phone: '9822112233', pin: '4321' });

    expect(loginRes.status).toBe(201);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.role).toBe('CONTRACTOR');
    expect(loginRes.body.credentialChangeRequired).toBe(true);
    const tempToken = loginRes.body.token;

    // 4. Pending token is blocked from accessing protected contractor APIs
    const blockedProfile = await ctx.http()
      .get('/api/v1/contractor/profile')
      .set(...auth(tempToken));
    expect(blockedProfile.status).toBe(403);

    // 5. Mandatory first-login PIN change
    const changePinRes = await ctx.http()
      .post('/api/v1/auth/change-credential')
      .set(...auth(tempToken))
      .send({ newCredential: '1234', confirmCredential: '1234' });

    expect(changePinRes.status).toBe(201);

    // 6. Old temporary PIN is now invalid; new PIN works
    const oldLogin = await ctx.http()
      .post('/api/v1/auth/login')
      .send({ phone: '9822112233', pin: '4321' });
    expect(oldLogin.status).toBe(401);

    const activeLogin = await ctx.http()
      .post('/api/v1/auth/login')
      .send({ phone: '9822112233', pin: '1234' });
    expect(activeLogin.status).toBe(201);
    expect(activeLogin.body.credentialChangeRequired).toBeUndefined();
    const token = activeLogin.body.token;

    // 7. GET /api/v1/contractor/profile
    const profileRes = await ctx.http()
      .get('/api/v1/contractor/profile')
      .set(...auth(token));
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.contractorId).toBe('C000001');
    expect(profileRes.body.phone).toBe('9822112233');
    expect(profileRes.body.assignedSites).toHaveLength(2);
    expect(profileRes.body.assignedSites.map((s: any) => s.siteCode)).toContain('SITE-CTR1');
    expect(profileRes.body.assignedSites.map((s: any) => s.siteCode)).toContain('SITE-CTR2');

    // 8. Register 4 Workers at SITE-CTR1 with various malaria statuses
    // Worker A: Negative
    const workerA = await registerWorker(ctx, { name: 'Ramesh Neg', phone: '9800000001', pin: '1111' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(workerA.token)).send({ siteId: 'SITE-CTR1' });
    const epA = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token)).send({ workerId: workerA.workerId });
    await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token)).send({
      episodeId: epA.body.id, testType: 'RDT', result: 'NEGATIVE', testDate: new Date().toISOString(),
    });

    // Worker B: Positive
    const workerB = await registerWorker(ctx, { name: 'Suresh Pos', phone: '9800000002', pin: '2222' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(workerB.token)).send({ siteId: 'SITE-CTR1' });
    const epB = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token)).send({ workerId: workerB.workerId });
    await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token)).send({
      episodeId: epB.body.id, testType: 'RDT', result: 'POSITIVE', testDate: new Date().toISOString(),
    });

    // Worker C: Awaiting
    const workerC = await registerWorker(ctx, { name: 'Mahesh Wait', phone: '9800000003', pin: '3333' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(workerC.token)).send({ siteId: 'SITE-CTR1' });
    await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token)).send({ workerId: workerC.workerId });

    // Worker D: No test record
    const workerD = await registerWorker(ctx, { name: 'Dinesh None', phone: '9800000004', pin: '4444' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(workerD.token)).send({ siteId: 'SITE-CTR1' });

    // 9. Site Stats: GET /api/v1/contractor/sites/SITE-CTR1/stats
    const statsRes = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-CTR1/stats')
      .set(...auth(token));
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.totalWorkers).toBe(4);
    expect(statsRes.body.positive).toBe(1);
    expect(statsRes.body.negative).toBe(1);
    expect(statsRes.body.awaitingResults).toBe(1);
    expect(statsRes.body.noResultRecorded).toBe(1);

    // 10. Workers list: GET /api/v1/contractor/sites/SITE-CTR1/workers
    const workersRes = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-CTR1/workers')
      .set(...auth(token));
    expect(workersRes.status).toBe(200);
    expect(workersRes.body.items).toHaveLength(4);

    // Filter by POSITIVE
    const posFilterRes = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-CTR1/workers?status=POSITIVE')
      .set(...auth(token));
    expect(posFilterRes.status).toBe(200);
    expect(posFilterRes.body.items).toHaveLength(1);
    expect(posFilterRes.body.items[0].name).toBe('Suresh Pos');

    // Search query
    const searchRes = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-CTR1/workers?q=Ramesh')
      .set(...auth(token));
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.items).toHaveLength(1);
    expect(searchRes.body.items[0].name).toBe('Ramesh Neg');

    // 11. Worker Detail: GET /api/v1/contractor/workers/:workerCode
    const workerDetailRes = await ctx.http()
      .get(`/api/v1/contractor/workers/${workerB.workerId}`)
      .set(...auth(token));
    expect(workerDetailRes.status).toBe(200);
    expect(workerDetailRes.body.name).toBe('Suresh Pos');
    expect(workerDetailRes.body.malariaStatus).toBe('POSITIVE');
    // Ensure Aadhaar number is NOT exposed
    expect(workerDetailRes.body.aadhaarNumber).toBeUndefined();

    // 12. Join Requests: Worker E requests to join SITE-CTR1
    const workerE = await registerWorker(ctx, { name: 'Eshwar Join', phone: '9800000005', pin: '5555' });
    const workerERecord = await ctx.prisma.worker.findFirstOrThrow({ where: { workerCode: workerE.workerId } });
    const joinReq = await ctx.prisma.siteJoinRequest.create({
      data: {
        workerId: workerERecord.id,
        siteId: site1.id,
        status: 'PENDING',
      },
    });

    const joinRequestsList = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-CTR1/join-requests')
      .set(...auth(token));
    expect(joinRequestsList.status).toBe(200);
    expect(joinRequestsList.body.items).toHaveLength(1);
    expect(joinRequestsList.body.items[0].id).toBe(joinReq.id);

    // Decide on Join Request: ACCEPT
    const decideRes = await ctx.http()
      .post(`/api/v1/join-requests/${joinReq.id}/decide`)
      .set(...auth(token))
      .send({ approve: true });
    expect(decideRes.status).toBe(201);
    expect(decideRes.body.status).toBe('ACCEPTED');

    // Worker E should now have SITE-CTR1 as active site
    const assignment = await ctx.prisma.workerSiteAssignment.findFirst({
      where: { workerId: workerERecord.id, active: true },
    });
    expect(assignment?.siteId).toBe(site1.id);

    // 13. Site Transfers: initiate transfer Worker A to SITE-CTR2
    const transferInit = await ctx.http()
      .post('/api/v1/transfers/contractor')
      .set(...auth(token))
      .send({
        workerId: workerA.workerId,
        toSiteId: 'SITE-CTR2',
      });
    expect(transferInit.status).toBe(201);

    const transfersList = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-CTR1/transfers')
      .set(...auth(token));
    expect(transfersList.status).toBe(200);
    expect(transfersList.body.items.length).toBeGreaterThanOrEqual(1);

    // 14. Travel and 7-day Positive alert
    // Suresh (Worker B, positive) creates a travel record departing in 4 days
    const departureDate = new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString();
    const travel = await ctx.http()
      .post('/api/v1/records/me/travel')
      .set(...auth(workerB.token))
      .send({
        planningTravel: true,
        departureDate,
        destination: 'Patna',
        state: 'Bihar',
      });
    expect(travel.status).toBe(201);
    const travelId = travel.body.id;

    // Contractor fetches travels for SITE-CTR1
    const travelsList = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-CTR1/travels')
      .set(...auth(token));
    expect(travelsList.status).toBe(200);
    expect(travelsList.body.items).toHaveLength(1);
    const item = travelsList.body.items[0];
    expect(item.workerName).toBe('Suresh Pos');
    expect(item.isPositiveWorkerAlert).toBe(true);
    expect(item.departureWithin7Days).toBe(true);

    // 15. Contractor submits travel report for high-risk positive worker
    const reportRes = await ctx.http()
      .post('/api/v1/travel/reports')
      .set(...auth(token))
      .send({
        workerId: workerB.workerId,
        travelRecordId: travelId,
        comment: 'Worker has severe fever and tested positive for malaria, leaving for home village.',
      });
    expect(reportRes.status).toBe(201);
    expect(reportRes.body.id).toBeDefined();
    expect(reportRes.body.status).toBe('OPEN');

    // Deduplication check: submitting duplicate report returns 409
    const dupReport = await ctx.http()
      .post('/api/v1/travel/reports')
      .set(...auth(token))
      .send({
        workerId: workerB.workerId,
        travelRecordId: travelId,
        comment: 'Duplicate submission attempt',
      });
    expect(dupReport.status).toBe(409);

    // 16. Contractor Notifications
    // Create an unread notification for the contractor
    await ctx.prisma.notification.create({
      data: {
        audienceUserId: contractorUser.id,
        audienceRole: 'CONTRACTOR',
        type: 'TRANSFER',
        title: 'New Site Transfer Request',
        body: 'Worker transfer initiated to Dona Paula Bay',
        entityType: 'TRANSFER',
        entityId: transferInit.body.id,
        dedupeKey: `TRANSFER:${transferInit.body.id}`,
      },
    });

    const notifsList = await ctx.http()
      .get('/api/v1/contractor/notifications')
      .set(...auth(token));
    expect(notifsList.status).toBe(200);
    expect(notifsList.body.items.length).toBeGreaterThanOrEqual(1);
    const unread = notifsList.body.items.find((n: any) => !n.read);
    expect(unread).toBeDefined();

    // Acknowledge (mark read)
    const ackRes = await ctx.http()
      .post(`/api/v1/contractor/notifications/${unread.id}/ack`)
      .set(...auth(token));
    expect(ackRes.status).toBe(201);
    expect(ackRes.body.read).toBe(true);

    // Verify marked read
    const afterAck = await ctx.http()
      .get('/api/v1/contractor/notifications')
      .set(...auth(token));
    const targetNotif = afterAck.body.items.find((n: any) => n.id === unread.id);
    expect(targetNotif.read).toBe(true);
  });

  async function provisionContractorHelper(
    name: string,
    phone: string,
    siteCodes: string[],
    areaId: string,
  ) {
    const contractorRecord = await ctx.prisma.contractor.create({
      data: { name },
    });
    const pinHash = await bcrypt.hash('1234', 10);
    const contractorUser = await ctx.prisma.user.create({
      data: {
        role: 'CONTRACTOR',
        phone,
        stakeholderCode: `C${Math.floor(100000 + Math.random() * 900000)}`,
        displayName: name,
        passwordHash: pinHash,
        mustChangeCredential: false,
        contractorId: contractorRecord.id,
      },
    });
    const sites = [];
    for (const code of siteCodes) {
      const s = await ctx.prisma.constructionSite.create({
        data: {
          siteCode: code,
          name: `${code} Project`,
          areaId,
          contractorId: contractorRecord.id,
        },
      });
      sites.push(s);
    }
    const login = await ctx.http()
      .post('/api/v1/auth/login')
      .send({ phone, pin: '1234' });
    return {
      contractor: contractorRecord,
      user: contractorUser,
      token: login.body.token as string,
      sites,
    };
  }

  it('strictly restricts individual worker malaria status visibility (only POSITIVE or NEGATIVE, AWAITING and NO_RESULT are null; site aggregate stats are preserved)', async () => {
    const areaId = await createArea(ctx, 'Panaji Privacy Test');
    const c = await provisionContractorHelper('Privacy Builders', '9822334455', ['SITE-PRIV1'], areaId);

    // 1. Worker 1: Authorised NEGATIVE
    const wNeg = await registerWorker(ctx, { name: 'Worker Neg', phone: '9811000001', pin: '1111' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(wNeg.token)).send({ siteId: 'SITE-PRIV1' });
    const epNeg = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token)).send({ workerId: wNeg.workerId });
    await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token)).send({
      episodeId: epNeg.body.id, testType: 'RDT', result: 'NEGATIVE', testDate: new Date().toISOString(),
    });

    // 2. Worker 2: Authorised POSITIVE
    const wPos = await registerWorker(ctx, { name: 'Worker Pos', phone: '9811000002', pin: '2222' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(wPos.token)).send({ siteId: 'SITE-PRIV1' });
    const epPos = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token)).send({ workerId: wPos.workerId });
    await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token)).send({
      episodeId: epPos.body.id, testType: 'RDT', result: 'POSITIVE', testDate: new Date().toISOString(),
    });

    // 3. Worker 3: Awaiting Results (episode opened, no diagnostic yet)
    const wWait = await registerWorker(ctx, { name: 'Worker Wait', phone: '9811000003', pin: '3333' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(wWait.token)).send({ siteId: 'SITE-PRIV1' });
    await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token)).send({ workerId: wWait.workerId });

    // 4. Worker 4: No test record
    const wNone = await registerWorker(ctx, { name: 'Worker None', phone: '9811000004', pin: '4444' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(wNone.token)).send({ siteId: 'SITE-PRIV1' });

    // Verify Worker List API:
    // Individual malaria status must be POSITIVE or NEGATIVE, and null for awaiting/no-result
    const listRes = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-PRIV1/workers')
      .set(...auth(c.token));
    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(4);

    const rNeg = listRes.body.items.find((i: any) => i.workerId === wNeg.workerId);
    const rPos = listRes.body.items.find((i: any) => i.workerId === wPos.workerId);
    const rWait = listRes.body.items.find((i: any) => i.workerId === wWait.workerId);
    const rNone = listRes.body.items.find((i: any) => i.workerId === wNone.workerId);

    expect(rNeg.malariaStatus).toBe('NEGATIVE');
    expect(rPos.malariaStatus).toBe('POSITIVE');
    expect(rWait.malariaStatus).toBeNull();
    expect(rNone.malariaStatus).toBeNull();

    // Verify Individual Worker Detail API:
    const detNeg = await ctx.http().get(`/api/v1/contractor/workers/${wNeg.workerId}`).set(...auth(c.token));
    expect(detNeg.status).toBe(200);
    expect(detNeg.body.malariaStatus).toBe('NEGATIVE');

    const detPos = await ctx.http().get(`/api/v1/contractor/workers/${wPos.workerId}`).set(...auth(c.token));
    expect(detPos.status).toBe(200);
    expect(detPos.body.malariaStatus).toBe('POSITIVE');
    expect(detPos.body.dependantsCount).toBe(0);

    const detWait = await ctx.http().get(`/api/v1/contractor/workers/${wWait.workerId}`).set(...auth(c.token));
    expect(detWait.status).toBe(200);
    expect(detWait.body.malariaStatus).toBeNull(); // Strictly undisclosed

    const detNone = await ctx.http().get(`/api/v1/contractor/workers/${wNone.workerId}`).set(...auth(c.token));
    expect(detNone.status).toBe(200);
    expect(detNone.body.malariaStatus).toBeNull(); // Strictly undisclosed

    // Verify no clinical details, species, prescriptions, or Aadhaar are leaked
    expect(detPos.body.species).toBeUndefined();
    expect(detPos.body.prescriptions).toBeUndefined();
    expect(detPos.body.medicalHistory).toBeUndefined();
    expect(detPos.body.screeningResponses).toBeUndefined();
    expect(detPos.body.aadhaarNumber).toBeUndefined();

    // Verify Worker Filtering:
    // Filtering by POSITIVE returns only positive workers
    const posFilter = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-PRIV1/workers?malaria=POSITIVE')
      .set(...auth(c.token));
    expect(posFilter.status).toBe(200);
    expect(posFilter.body.items).toHaveLength(1);
    expect(posFilter.body.items[0].workerId).toBe(wPos.workerId);

    // Filtering by NEGATIVE returns only negative workers
    const negFilter = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-PRIV1/workers?malaria=NEGATIVE')
      .set(...auth(c.token));
    expect(negFilter.status).toBe(200);
    expect(negFilter.body.items).toHaveLength(1);
    expect(negFilter.body.items[0].workerId).toBe(wNeg.workerId);

    // Filtering by AWAITING or NO_RESULT does not disclose individuals (returns empty)
    const awaitFilter = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-PRIV1/workers?malaria=AWAITING')
      .set(...auth(c.token));
    expect(awaitFilter.status).toBe(200);
    expect(awaitFilter.body.items).toHaveLength(0);

    // Verify Aggregate Site Statistics:
    // Aggregate counts MUST accurately reflect awaiting and no-result counts
    const statsRes = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-PRIV1/stats')
      .set(...auth(c.token));
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.totalWorkers).toBe(4);
    expect(statsRes.body.positive).toBe(1);
    expect(statsRes.body.negative).toBe(1);
    expect(statsRes.body.awaitingResults).toBe(1);
    expect(statsRes.body.noResultRecorded).toBe(1);
  });

  it('verifies 7-day travel alert window (7 days, 6 days, >7 days), status changes, and cancellations', async () => {
    const areaId = await createArea(ctx, 'Panaji Travel Test');
    const c = await provisionContractorHelper('Travel Builders', '9822445566', ['SITE-TRV1'], areaId);

    // 1. Worker Pos1 (POSITIVE) departing in exactly 7 days (within horizon)
    const wPos1 = await registerWorker(ctx, { name: 'Pos 7Days', phone: '9812000001', pin: '1111' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(wPos1.token)).send({ siteId: 'SITE-TRV1' });
    const ep1 = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token)).send({ workerId: wPos1.workerId });
    await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token)).send({
      episodeId: ep1.body.id, testType: 'RDT', result: 'POSITIVE', testDate: new Date().toISOString(),
    });
    // Exactly 7 days (less 1 minute to ensure within <= horizon)
    const date7Days = new Date(Date.now() + (7 * 24 * 3600 - 60) * 1000).toISOString();
    const t7Res = await ctx.http().post('/api/v1/records/me/travel').set(...auth(wPos1.token)).send({
      planningTravel: true, departureDate: date7Days, destination: 'Kolkata', state: 'West Bengal',
    });
    expect(t7Res.status).toBe(201);

    // 2. Worker Pos2 (POSITIVE) departing in 6 days (within horizon)
    const wPos2 = await registerWorker(ctx, { name: 'Pos 6Days', phone: '9812000002', pin: '2222' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(wPos2.token)).send({ siteId: 'SITE-TRV1' });
    const ep2 = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token)).send({ workerId: wPos2.workerId });
    await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token)).send({
      episodeId: ep2.body.id, testType: 'RDT', result: 'POSITIVE', testDate: new Date().toISOString(),
    });
    const date6Days = new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString();
    const t6Res = await ctx.http().post('/api/v1/records/me/travel').set(...auth(wPos2.token)).send({
      planningTravel: true, departureDate: date6Days, destination: 'Ranchi', state: 'Jharkhand',
    });
    expect(t6Res.status).toBe(201);

    // 3. Worker Pos3 (POSITIVE) departing in 9 days (> 7 days)
    const wPos3 = await registerWorker(ctx, { name: 'Pos 9Days', phone: '9812000003', pin: '3333' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(wPos3.token)).send({ siteId: 'SITE-TRV1' });
    const ep3 = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token)).send({ workerId: wPos3.workerId });
    await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token)).send({
      episodeId: ep3.body.id, testType: 'RDT', result: 'POSITIVE', testDate: new Date().toISOString(),
    });
    const date9Days = new Date(Date.now() + 9 * 24 * 3600 * 1000).toISOString();
    const t9Res = await ctx.http().post('/api/v1/records/me/travel').set(...auth(wPos3.token)).send({
      planningTravel: true, departureDate: date9Days, destination: 'Bhopal', state: 'Madhya Pradesh',
    });
    expect(t9Res.status).toBe(201);

    // Check travels list:
    const travels1 = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-TRV1/travels')
      .set(...auth(c.token));
    expect(travels1.status).toBe(200);

    const row7 = travels1.body.items.find((i: any) => i.travelRecordId === t7Res.body.id);
    const row6 = travels1.body.items.find((i: any) => i.travelRecordId === t6Res.body.id);
    const row9 = travels1.body.items.find((i: any) => i.travelRecordId === t9Res.body.id);

    expect(row7.isSevenDayAlert).toBe(true);
    expect(row7.departureWithin7Days).toBe(true);

    expect(row6.isSevenDayAlert).toBe(true);
    expect(row6.departureWithin7Days).toBe(true);

    expect(row9.isSevenDayAlert).toBe(false);
    expect(row9.departureWithin7Days).toBe(false);

    // 4. Dynamic status change: Worker Dyn starts NEGATIVE, departs in 5 days
    const wDyn = await registerWorker(ctx, { name: 'Worker Dynamic', phone: '9812000004', pin: '4444' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(wDyn.token)).send({ siteId: 'SITE-TRV1' });
    const epDyn = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token)).send({ workerId: wDyn.workerId });
    await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token)).send({
      episodeId: epDyn.body.id, testType: 'RDT', result: 'NEGATIVE', testDate: new Date(Date.now() - 7200000).toISOString(),
    });
    const date5Days = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
    const tDynRes = await ctx.http().post('/api/v1/records/me/travel').set(...auth(wDyn.token)).send({
      planningTravel: true, departureDate: date5Days, destination: 'Lucknow', state: 'Uttar Pradesh',
    });
    expect(tDynRes.status).toBe(201);

    // Initially negative -> isSevenDayAlert is false
    const travels2 = await ctx.http().get('/api/v1/contractor/sites/SITE-TRV1/travels').set(...auth(c.token));
    const rowDynBefore = travels2.body.items.find((i: any) => i.travelRecordId === tDynRes.body.id);
    expect(rowDynBefore.isSevenDayAlert).toBe(false);
    expect(rowDynBefore.malariaStatus).toBe('NEGATIVE');

    // Worker tests POSITIVE (later test date)
    await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token)).send({
      episodeId: epDyn.body.id, testType: 'MICROSCOPY', result: 'POSITIVE', testDate: new Date(Date.now() - 3600000).toISOString(),
    });

    // Fresh query -> isSevenDayAlert is now true
    const travels3 = await ctx.http().get('/api/v1/contractor/sites/SITE-TRV1/travels').set(...auth(c.token));
    const rowDynAfter = travels3.body.items.find((i: any) => i.travelRecordId === tDynRes.body.id);
    expect(rowDynAfter.isSevenDayAlert).toBe(true);
    expect(rowDynAfter.malariaStatus).toBe('POSITIVE');

    // Worker resolves/becomes NEGATIVE again (latest test date)
    const negRes = await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token)).send({
      episodeId: epDyn.body.id, testType: 'MICROSCOPY', result: 'NEGATIVE', testDate: new Date().toISOString(),
    });
    expect(negRes.status).toBe(201);

    const travels4 = await ctx.http().get('/api/v1/contractor/sites/SITE-TRV1/travels').set(...auth(c.token));
    const rowDynResolved = travels4.body.items.find((i: any) => i.travelRecordId === tDynRes.body.id);
    expect(rowDynResolved.isSevenDayAlert).toBe(false);
    expect(rowDynResolved.malariaStatus).toBe('NEGATIVE');

    // 5. Worker cancels travel: Pos2 cancels their travel record
    const cancelRes = await ctx.http()
      .post('/api/v1/travel/my-record/cancel')
      .set(...auth(wPos2.token))
      .send({ travelRecordId: t6Res.body.id, reason: 'Trip postponed' });
    expect(cancelRes.status).toBe(201);
    expect(cancelRes.body.status).toBe('CANCELLED');

    const travels5 = await ctx.http().get('/api/v1/contractor/sites/SITE-TRV1/travels').set(...auth(c.token));
    const row6Cancelled = travels5.body.items.find((i: any) => i.travelRecordId === t6Res.body.id);
    expect(row6Cancelled.status).toBe('CANCELLED');
    expect(row6Cancelled.isUpcoming).toBe(false);
    expect(row6Cancelled.isSevenDayAlert).toBe(false);

    // 6. Worker cancels travel after report submitted:
    // Contractor submits report for Pos1
    const repRes = await ctx.http()
      .post('/api/v1/travel/reports')
      .set(...auth(c.token))
      .send({
        workerId: wPos1.workerId,
        travelRecordId: t7Res.body.id,
        comment: 'High risk worker traveling home while positive',
      });
    expect(repRes.status).toBe(201);

    // Worker Pos1 cancels travel
    const cancelAfterReport = await ctx.http()
      .post('/api/v1/travel/my-record/cancel')
      .set(...auth(wPos1.token))
      .send({ travelRecordId: t7Res.body.id, reason: 'Decided not to travel' });
    expect(cancelAfterReport.status).toBe(201);
    expect(cancelAfterReport.body.reportPreserved).toBe(true);

    // Verify report record is preserved in database
    const dbReport = await ctx.prisma.travelReport.findUnique({
      where: { travelRecordId: t7Res.body.id },
    });
    expect(dbReport).toBeDefined();
    expect(dbReport?.status).toBe('OPEN');

    // Verify cancellation notification dispatched
    const cancelNotifs = await ctx.prisma.notification.findMany({
      where: {
        entityType: 'TravelRecord',
        entityId: t7Res.body.id,
        type: 'TRAVEL_RECORD_CANCELLED',
      },
    });
    expect(cancelNotifs.length).toBeGreaterThanOrEqual(1);
  });

  it('verifies travel report submission validation, deduplication, and notification creation', async () => {
    const areaId = await createArea(ctx, 'Panaji Report Test');
    const c = await provisionContractorHelper('Report Builders', '9822556677', ['SITE-REP1'], areaId);

    // Setup Positive Worker
    const wPos = await registerWorker(ctx, { name: 'Report Pos', phone: '9813000001', pin: '1111' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(wPos.token)).send({ siteId: 'SITE-REP1' });
    const epPos = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token)).send({ workerId: wPos.workerId });
    await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token)).send({
      episodeId: epPos.body.id, testType: 'RDT', result: 'POSITIVE', testDate: new Date().toISOString(),
    });
    const depDate = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const tPosRes = await ctx.http().post('/api/v1/records/me/travel').set(...auth(wPos.token)).send({
      planningTravel: true, departureDate: depDate, destination: 'Delhi', state: 'Delhi',
    });
    expect(tPosRes.status).toBe(201);

    // Setup Negative Worker
    const wNeg = await registerWorker(ctx, { name: 'Report Neg', phone: '9813000002', pin: '2222' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(wNeg.token)).send({ siteId: 'SITE-REP1' });
    const epNeg = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token)).send({ workerId: wNeg.workerId });
    await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token)).send({
      episodeId: epNeg.body.id, testType: 'RDT', result: 'NEGATIVE', testDate: new Date().toISOString(),
    });
    const tNegRes = await ctx.http().post('/api/v1/records/me/travel').set(...auth(wNeg.token)).send({
      planningTravel: true, departureDate: depDate, destination: 'Delhi', state: 'Delhi',
    });
    expect(tNegRes.status).toBe(201);

    // 1. Mandatory comment validation: empty comment rejected with 400
    const emptyCommentRes = await ctx.http()
      .post('/api/v1/travel/reports')
      .set(...auth(c.token))
      .send({
        workerId: wPos.workerId,
        travelRecordId: tPosRes.body.id,
        comment: '   ',
      });
    expect(emptyCommentRes.status).toBe(400);

    // 2. Report rejected for non-positive worker (400)
    const negReportRes = await ctx.http()
      .post('/api/v1/travel/reports')
      .set(...auth(c.token))
      .send({
        workerId: wNeg.workerId,
        travelRecordId: tNegRes.body.id,
        comment: 'Worker is negative but traveling',
      });
    expect(negReportRes.status).toBe(400);

    // 3. Valid submission succeeds
    const validReport = await ctx.http()
      .post('/api/v1/travel/reports')
      .set(...auth(c.token))
      .send({
        workerId: wPos.workerId,
        travelRecordId: tPosRes.body.id,
        comment: 'Positive worker returning to native place for festival.',
      });
    expect(validReport.status).toBe(201);
    expect(validReport.body.id).toBeDefined();
    expect(validReport.body.status).toBe('OPEN');

    // 4. Duplicate submission is rejected with 409 Conflict
    const dupRes = await ctx.http()
      .post('/api/v1/travel/reports')
      .set(...auth(c.token))
      .send({
        workerId: wPos.workerId,
        travelRecordId: tPosRes.body.id,
        comment: 'Attempting duplicate submission',
      });
    expect(dupRes.status).toBe(409);

    // 5. Notifications fan-out: exactly 1 notification each for ADMIN, CLINICIAN, RESEARCH_LAB
    const notifications = await ctx.prisma.notification.findMany({
      where: {
        entityType: 'TravelReport',
        entityId: validReport.body.id,
      },
    });
    expect(notifications).toHaveLength(3);
    const audienceRoles = notifications.map((n) => n.audienceRole);
    expect(audienceRoles).toContain('ADMIN');
    expect(audienceRoles).toContain('CLINICIAN');
    expect(audienceRoles).toContain('RESEARCH_LAB');
  });

  it('enforces contractor site security, isolation across contractors, and assigned sites profile', async () => {
    const areaId = await createArea(ctx, 'Panaji Security Test');

    // Contractor 1 manages SITE-SEC-1 and SITE-SEC-2
    const c1 = await provisionContractorHelper('Alpha Builders', '9822667788', ['SITE-SEC-1', 'SITE-SEC-2'], areaId);

    // Contractor 2 manages SITE-SEC-3
    const c2 = await provisionContractorHelper('Beta Builders', '9822778899', ['SITE-SEC-3'], areaId);

    // Register a worker at SITE-SEC-3 under Contractor 2
    const wBeta = await registerWorker(ctx, { name: 'Beta Worker', phone: '9814000001', pin: '1111' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(wBeta.token)).send({ siteId: 'SITE-SEC-3' });

    // 1. Contractor 1 profile lists only assigned sites
    const prof1 = await ctx.http().get('/api/v1/contractor/profile').set(...auth(c1.token));
    expect(prof1.status).toBe(200);
    const codes1 = prof1.body.assignedSites.map((s: any) => s.siteCode);
    expect(codes1).toContain('SITE-SEC-1');
    expect(codes1).toContain('SITE-SEC-2');
    expect(codes1).not.toContain('SITE-SEC-3');

    // 2. Contractor 1 attempts to access Contractor 2 site: all return 403 Forbidden
    const sStats = await ctx.http().get('/api/v1/contractor/sites/SITE-SEC-3/stats').set(...auth(c1.token));
    expect(sStats.status).toBe(403);

    const sWorkers = await ctx.http().get('/api/v1/contractor/sites/SITE-SEC-3/workers').set(...auth(c1.token));
    expect(sWorkers.status).toBe(403);

    const sJoin = await ctx.http().get('/api/v1/contractor/sites/SITE-SEC-3/join-requests').set(...auth(c1.token));
    expect(sJoin.status).toBe(403);

    const sTrans = await ctx.http().get('/api/v1/contractor/sites/SITE-SEC-3/transfers').set(...auth(c1.token));
    expect(sTrans.status).toBe(403);

    const sTravel = await ctx.http().get('/api/v1/contractor/sites/SITE-SEC-3/travels').set(...auth(c1.token));
    expect(sTravel.status).toBe(403);

    // 3. Contractor 1 attempts to view Beta Worker details -> 403 Forbidden
    const wDetail = await ctx.http().get(`/api/v1/contractor/workers/${wBeta.workerId}`).set(...auth(c1.token));
    expect(wDetail.status).toBe(403);

    // 4. Contractor 1 accessing their own sites works cleanly
    const s1Stats = await ctx.http().get('/api/v1/contractor/sites/SITE-SEC-1/stats').set(...auth(c1.token));
    expect(s1Stats.status).toBe(200);
    expect(s1Stats.body.siteCode).toBe('SITE-SEC-1');

    const s2Stats = await ctx.http().get('/api/v1/contractor/sites/SITE-SEC-2/stats').set(...auth(c1.token));
    expect(s2Stats.status).toBe(200);
    expect(s2Stats.body.siteCode).toBe('SITE-SEC-2');
  });
});
