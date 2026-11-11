import { createTestApp, type TestContext } from './setup/test-app';
import {
  auth,
  createArea,
  createContractor,
  createSite,
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
    // Individual malaria status is strictly masked per Iteration 2 privacy policy
    expect(workerDetailRes.body.malariaStatus).toBeNull();
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

    // Individual malaria status must be strictly masked (null) per Iteration 2 privacy policy
    expect(rNeg.malariaStatus).toBeNull();
    expect(rPos.malariaStatus).toBeNull();
    expect(rWait.malariaStatus).toBeNull();
    expect(rNone.malariaStatus).toBeNull();

    // Verify Individual Worker Detail API:
    const detNeg = await ctx.http().get(`/api/v1/contractor/workers/${wNeg.workerId}`).set(...auth(c.token));
    expect(detNeg.status).toBe(200);
    expect(detNeg.body.malariaStatus).toBeNull(); // Masked

    const detPos = await ctx.http().get(`/api/v1/contractor/workers/${wPos.workerId}`).set(...auth(c.token));
    expect(detPos.status).toBe(200);
    expect(detPos.body.malariaStatus).toBeNull(); // Masked

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

  it('Contractor Iteration 1: Web sign-in, Dashboard metrics, isolation, and RBAC protection', async () => {
    const areaId = await createArea(ctx, 'Goa Panaji Area');

    const c1 = await provisionContractorHelper('Metro Infra Projects', '9822998877', ['SITE-METRO-1'], areaId);
    const c2 = await provisionContractorHelper('Coastal Builders', '9822998866', ['SITE-COAST-1'], areaId);

    // 1. Web sign-in via /auth/staff/login succeeds for contractor
    const loginRes = await ctx.http()
      .post('/api/v1/auth/staff/login')
      .send({ username: '9822998877', password: '1234' });
    expect(loginRes.status).toBe(201);
    expect(loginRes.body.role).toBe('CONTRACTOR');
    expect(loginRes.body.user.role).toBe('CONTRACTOR');
    expect(loginRes.body.token).toBeDefined();

    // 2. Worker accounts are blocked from /auth/staff/login
    const w1 = await registerWorker(ctx, { name: 'Metro Worker One', phone: '9815000001', pin: '1111' });
    const blockedStaffLogin = await ctx.http()
      .post('/api/v1/auth/staff/login')
      .send({ username: '9815000001', password: '1111' });
    expect(blockedStaffLogin.status).toBe(403);
    expect(blockedStaffLogin.body.message).toContain('Worker accounts can only access the M3 mobile app');

    // 3. Worker accounts cannot access contractor dashboard
    const blockedDash = await ctx.http()
      .get('/api/v1/contractor/dashboard')
      .set(...auth(w1.token));
    expect(blockedDash.status).toBe(403);

    // 4. Assign worker 1 to Contractor 1 site
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(w1.token)).send({ siteId: 'SITE-METRO-1' });

    // Assign worker 2 to Contractor 2 site
    const w2 = await registerWorker(ctx, { name: 'Coastal Worker One', phone: '9815000002', pin: '2222' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(w2.token)).send({ siteId: 'SITE-COAST-1' });

    // 5. Contractor 1 dashboard returns real metrics strictly for Contractor 1
    const dash1 = await ctx.http()
      .get('/api/v1/contractor/dashboard')
      .set(...auth(c1.token));
    expect(dash1.status).toBe(200);
    expect(dash1.body.contractor.name).toBe('Metro Infra Projects');
    expect(dash1.body.metrics.totalAssignedWorkers).toBe(1);
    expect(dash1.body.metrics.activeWorkers).toBe(1);
    expect(dash1.body.metrics.workersCurrentlyAtSite).toBe(1);
    expect(dash1.body.metrics.pendingTransferRequests).toBe(0);
    expect(dash1.body.sites).toHaveLength(1);
    expect(dash1.body.sites[0].siteCode).toBe('SITE-METRO-1');
    expect(dash1.body.workers).toHaveLength(1);
    expect(dash1.body.workers[0].workerCode).toBe(w1.workerId);

    // 6. Data isolation: Contractor 1 does NOT see Coastal Worker One (from Contractor 2)
    const workerCodes = dash1.body.workers.map((w: any) => w.workerCode);
    expect(workerCodes).not.toContain(w2.workerId);

    // 7. Recent worker activity includes real timestamped record
    expect(dash1.body.recentActivity.length).toBeGreaterThanOrEqual(1);
    const topAct = dash1.body.recentActivity[0];
    expect(topAct.type).toBe('ASSIGNMENT');
    expect(topAct.timestamp).toBeDefined();
    expect(topAct.workerCode).toBe(w1.workerId);

    // 8. Contractor workers search endpoint
    const workersList = await ctx.http()
      .get('/api/v1/contractor/workers?search=Metro')
      .set(...auth(c1.token));
    expect(workersList.status).toBe(200);
    expect(workersList.body.items).toHaveLength(1);
    expect(workersList.body.items[0].workerCode).toBe(w1.workerId);

    // 9. Site detail endpoint
    const siteDetail = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-METRO-1/detail')
      .set(...auth(c1.token));
    expect(siteDetail.status).toBe(200);
    expect(siteDetail.body.site.siteCode).toBe('SITE-METRO-1');
    expect(siteDetail.body.workers).toHaveLength(1);

    // Contractor 1 cannot access Contractor 2 site detail
    const blockedSite = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-COAST-1/detail')
      .set(...auth(c1.token));
    expect(blockedSite.status).toBe(403);
  });

  it('Contractor Iteration 2: Worker Management, Site Operations, Travel Histories, and Strict Privacy Masking', async () => {
    const areaId = await createArea(ctx, 'Iteration Two Surveillance Zone');
    const cA = await provisionContractorHelper('Alpha Buildcorp', '9819000001', ['SITE-IT2-A'], areaId);
    const cB = await provisionContractorHelper('Beta Infrastructures', '9819000002', ['SITE-IT2-B'], areaId);

    // 1. Register 3 workers for Contractor A:
    // Worker 1: Active, has Entry and Exit travels, and a transfer request
    const w1 = await registerWorker(ctx, { name: 'Arjun Das', phone: '9819001001', pin: '1111' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(w1.token)).send({ siteId: 'SITE-IT2-A' });

    // Record an Entry in Goa travel
    const entryTravel = await ctx.prisma.travelRecord.create({
      data: {
        workerId: (await ctx.prisma.worker.findFirstOrThrow({ where: { workerCode: w1.workerId } })).id,
        direction: 'ENTERING_GOA',
        originTown: 'Patna',
        originDistrict: 'Patna',
        originState: 'Bihar',
        purpose: 'Construction employment',
        status: 'SUBMITTED',
        arrivalConfirmedAt: new Date('2026-10-15T09:00:00Z'),
      },
    });

    // Record an Exit from Goa travel
    const exitTravel = await ctx.prisma.travelRecord.create({
      data: {
        workerId: (await ctx.prisma.worker.findFirstOrThrow({ where: { workerCode: w1.workerId } })).id,
        direction: 'LEAVING_GOA',
        destination: 'Patna',
        town: 'Patna',
        state: 'Bihar',
        purpose: 'Festival vacation',
        departureDate: new Date('2026-11-20T08:00:00Z'),
        returnDate: new Date('2026-12-05T20:00:00Z'),
        status: 'SUBMITTED',
      },
    });

    // Record a site transfer request involving w1
    const w1Record = await ctx.prisma.worker.findFirstOrThrow({ where: { workerCode: w1.workerId } });
    const siteA = await ctx.prisma.constructionSite.findUniqueOrThrow({ where: { siteCode: 'SITE-IT2-A' } });
    const siteB = await ctx.prisma.constructionSite.findUniqueOrThrow({ where: { siteCode: 'SITE-IT2-B' } });
    await ctx.prisma.siteTransferRequest.create({
      data: {
        workerId: w1Record.id,
        fromSiteId: siteA.id,
        toSiteId: siteB.id,
        fromContractorId: cA.contractorId,
        toContractorId: cB.contractorId,
        initiatorType: 'WORKER',
        initiatorId: w1Record.id,
        status: 'PENDING_DESTINATION_CONTRACTOR',
      },
    });

    // Worker 2: Active, assigned to SITE-IT2-A
    const w2 = await registerWorker(ctx, { name: 'Bikram Sen', phone: '9819001002', pin: '2222' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(w2.token)).send({ siteId: 'SITE-IT2-A' });

    // Worker 3: Inactive assignment for Contractor A
    const w3 = await registerWorker(ctx, { name: 'Chandan Roy', phone: '9819001003', pin: '3333' });
    const w3Record = await ctx.prisma.worker.findFirstOrThrow({ where: { workerCode: w3.workerId } });
    await ctx.prisma.workerSiteAssignment.create({
      data: {
        workerId: w3Record.id,
        siteId: siteA.id,
        contractorId: cA.contractorId,
        active: false,
        status: 'ENDED',
        startedAt: new Date('2026-08-01T00:00:00Z'),
        endedAt: new Date('2026-09-30T00:00:00Z'),
      },
    });

    // Worker 4: Assigned to Contractor B (isolated)
    const w4 = await registerWorker(ctx, { name: 'Deepak Rao', phone: '9819001004', pin: '4444' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(w4.token)).send({ siteId: 'SITE-IT2-B' });

    // --- Verification 1: Worker list loads with pagination ---
    const listRes = await ctx.http()
      .get('/api/v1/contractor/workers?page=1&pageSize=2')
      .set(...auth(cA.token));
    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(2);
    expect(listRes.body.page).toBe(1);
    expect(listRes.body.pageSize).toBe(2);
    expect(listRes.body.total).toBe(3); // Total workers across all statuses (w1, w2 active + w3 inactive)
    expect(listRes.body.totalPages).toBe(2);

    // --- Verification 2: Search works by worker name and ID ---
    const searchByName = await ctx.http()
      .get('/api/v1/contractor/workers?search=Arjun')
      .set(...auth(cA.token));
    expect(searchByName.status).toBe(200);
    expect(searchByName.body.items).toHaveLength(1);
    expect(searchByName.body.items[0].name).toBe('Arjun Das');

    const searchById = await ctx.http()
      .get(`/api/v1/contractor/workers?search=${w2.workerId}`)
      .set(...auth(cA.token));
    expect(searchById.status).toBe(200);
    expect(searchById.body.items).toHaveLength(1);
    expect(searchById.body.items[0].workerCode).toBe(w2.workerId);

    // --- Verification 3: Site filters work ---
    const siteFilter = await ctx.http()
      .get('/api/v1/contractor/workers?siteCode=SITE-IT2-A')
      .set(...auth(cA.token));
    expect(siteFilter.status).toBe(200);
    expect(siteFilter.body.items.length).toBeGreaterThanOrEqual(1);

    // Contractor A cannot filter by Contractor B's site
    const invalidSiteFilter = await ctx.http()
      .get('/api/v1/contractor/workers?siteCode=SITE-IT2-B')
      .set(...auth(cA.token));
    expect(invalidSiteFilter.status).toBe(403);

    // --- Verification 4: Assignment status filters work ---
    const activeFilter = await ctx.http()
      .get('/api/v1/contractor/workers?assignmentStatus=ACTIVE')
      .set(...auth(cA.token));
    expect(activeFilter.status).toBe(200);
    expect(activeFilter.body.items.every((i: any) => i.active === true)).toBe(true);

    const inactiveFilter = await ctx.http()
      .get('/api/v1/contractor/workers?assignmentStatus=INACTIVE')
      .set(...auth(cA.token));
    expect(inactiveFilter.status).toBe(200);
    expect(inactiveFilter.body.items.some((i: any) => i.workerCode === w3.workerId)).toBe(true);

    const allFilter = await ctx.http()
      .get('/api/v1/contractor/workers?assignmentStatus=ALL')
      .set(...auth(cA.token));
    expect(allFilter.status).toBe(200);
    expect(allFilter.body.items.length).toBeGreaterThanOrEqual(3);

    // --- Verification 5 & 6 & 12: Worker detail shows authorised info, travel histories, transfer status, masked malaria ---
    const w1Detail = await ctx.http()
      .get(`/api/v1/contractor/workers/${w1.workerId}`)
      .set(...auth(cA.token));
    expect(w1Detail.status).toBe(200);
    expect(w1Detail.body.name).toBe('Arjun Das');
    expect(w1Detail.body.workerCode).toBe(w1.workerId);
    expect(w1Detail.body.currentSite.siteCode).toBe('SITE-IT2-A');
    expect(w1Detail.body.assignmentStatus).toBe('ACTIVE');
    expect(w1Detail.body.active).toBe(true);
    // Privacy: malaria status is strictly masked
    expect(w1Detail.body.malariaStatus).toBeNull();
    // Entry in Goa history
    expect(w1Detail.body.entryHistory).toHaveLength(1);
    expect(w1Detail.body.entryHistory[0].originTown).toBe('Patna');
    expect(w1Detail.body.entryHistory[0].originState).toBe('Bihar');
    // Exit from Goa history
    expect(w1Detail.body.exitHistory).toHaveLength(1);
    expect(w1Detail.body.exitHistory[0].destination).toBe('Patna');
    expect(w1Detail.body.exitHistory[0].state).toBe('Bihar');
    // Transfer status
    expect(w1Detail.body.transfers).toHaveLength(1);
    expect(w1Detail.body.transfers[0].fromSite.siteCode).toBe('SITE-IT2-A');
    expect(w1Detail.body.transfers[0].toSite.siteCode).toBe('SITE-IT2-B');
    expect(w1Detail.body.transfers[0].status).toBe('PENDING_DESTINATION_CONTRACTOR');

    // Clinical and household data remain inaccessible
    expect(w1Detail.body.screeningResponses).toBeUndefined();
    expect(w1Detail.body.symptoms).toBeUndefined();
    expect(w1Detail.body.voiceRecordingUrl).toBeUndefined();
    expect(w1Detail.body.householdMembers).toBeUndefined();
    expect(w1Detail.body.aadhaarNumber).toBeUndefined();

    // --- Verification 7: Site list displays only assigned sites & supports search ---
    const sitesList = await ctx.http()
      .get('/api/v1/contractor/sites')
      .set(...auth(cA.token));
    expect(sitesList.status).toBe(200);
    expect(sitesList.body).toHaveLength(1);
    expect(sitesList.body[0].siteCode).toBe('SITE-IT2-A');

    const searchSite = await ctx.http()
      .get('/api/v1/contractor/sites?search=IT2-A')
      .set(...auth(cA.token));
    expect(searchSite.status).toBe(200);
    expect(searchSite.body).toHaveLength(1);

    // --- Verification 8: Site detail displays only authorised workers ---
    const siteADetail = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-IT2-A/detail')
      .set(...auth(cA.token));
    expect(siteADetail.status).toBe(200);
    expect(siteADetail.body.site.siteCode).toBe('SITE-IT2-A');
    expect(siteADetail.body.workers.some((w: any) => w.workerCode === w1.workerId)).toBe(true);
    expect(siteADetail.body.workers.every((w: any) => w.malariaStatus === null)).toBe(true);

    // --- Verification 9 & 10: Cross-contractor worker and site access return 403 ---
    // Contractor A accessing Contractor B's worker (w4)
    const crossWorker = await ctx.http()
      .get(`/api/v1/contractor/workers/${w4.workerId}`)
      .set(...auth(cA.token));
    expect(crossWorker.status).toBe(403);

    // Contractor A accessing Contractor B's site
    const crossSite = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-IT2-B/detail')
      .set(...auth(cA.token));
    expect(crossSite.status).toBe(403);
  });

  it('Contractor Iteration 3: Complete Transfer Management (Worker & Contractor workflows, timeline, RBAC, strict privacy)', async () => {
    const areaId = await createArea(ctx, 'South Goa');
    const cNorth = await createContractor(ctx, { name: 'North Builders Pvt Ltd', username: 'c.north.it3' });
    const cSouth = await createContractor(ctx, { name: 'South Infra Projects', username: 'c.south.it3' });
    const cOther = await createContractor(ctx, { name: 'Unrelated Contractor', username: 'c.other.it3' });

    const siteNorth = await createSite(ctx, { siteCode: 'SITE-T3-N', name: 'North Vista', areaId, contractorId: cNorth.contractorId });
    const siteSouth = await createSite(ctx, { siteCode: 'SITE-T3-S', name: 'South Marina', areaId, contractorId: cSouth.contractorId });

    // Worker 1: Assigned to North
    const w1 = await registerWorker(ctx, { name: 'Manoj Tiwari', phone: '9819003001', pin: '1111' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(w1.token)).send({ siteId: 'SITE-T3-N' });

    // Worker 2: Assigned to North
    const w2 = await registerWorker(ctx, { name: 'Sanjay Kumar', phone: '9819003002', pin: '2222' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(w2.token)).send({ siteId: 'SITE-T3-N' });

    // =========================================================================
    // 1. WORKER-INITIATED TRANSFER WORKFLOW
    // Sequence: Worker requests -> Dest approves -> Current releases -> Complete
    // =========================================================================
    const w1Req = await ctx.http()
      .post('/api/v1/transfers/worker')
      .set(...auth(w1.token))
      .send({ toSiteId: 'SITE-T3-S', note: 'Relocating to South Goa' });
    expect(w1Req.status).toBe(201);
    expect(w1Req.body.status).toBe('PENDING_DESTINATION_CONTRACTOR');
    const t1Id = w1Req.body.id;

    // Check Destination Contractor (South Infra) transfer list
    const southTransfers1 = await ctx.http()
      .get('/api/v1/contractor/transfers?status=PENDING_APPROVAL')
      .set(...auth(cSouth.token));
    expect(southTransfers1.status).toBe(200);
    const t1South = southTransfers1.body.items.find((x: any) => x.id === t1Id);
    expect(t1South).toBeDefined();
    expect(t1South.workerName).toBe('Manoj Tiwari');
    expect(t1South.status).toBe('PENDING_DESTINATION_CONTRACTOR');
    expect(t1South.canApproveDestination).toBe(true);
    expect(t1South.canReleaseWorker).toBe(false);
    expect(t1South.requiredNextAction).toBe('Awaiting your destination approval');
    expect(t1South.worker.malariaStatus).toBeNull(); // Strict privacy

    // Check Current Contractor (North Builders) transfer list
    const northTransfers1 = await ctx.http()
      .get('/api/v1/contractor/transfers')
      .set(...auth(cNorth.token));
    expect(northTransfers1.status).toBe(200);
    const t1North = northTransfers1.body.items.find((x: any) => x.id === t1Id);
    expect(t1North).toBeDefined();
    expect(t1North.status).toBe('PENDING_DESTINATION_CONTRACTOR');
    expect(t1North.canApproveDestination).toBe(false);
    expect(t1North.canReleaseWorker).toBe(false);
    expect(t1North.requiredNextAction).toBe('Awaiting destination contractor approval');

    // Rule: Current contractor CANNOT release before destination approval
    const prematureRelease = await ctx.http()
      .post(`/api/v1/contractor/transfers/${t1Id}/release`)
      .set(...auth(cNorth.token))
      .send({ reason: 'Releasing early' });
    expect(prematureRelease.status).toBe(403);

    // Step 2: Destination contractor (South) approves
    const destApprove = await ctx.http()
      .post(`/api/v1/contractor/transfers/${t1Id}/approve`)
      .set(...auth(cSouth.token))
      .send({ reason: 'Welcome to South Marina' });
    expect(destApprove.status).toBe(201);
    expect(destApprove.body.status).toBe('PENDING_CURRENT_CONTRACTOR');

    // Step 3: Current contractor (North) now receives release request
    const northTransfers2 = await ctx.http()
      .get('/api/v1/contractor/transfers?status=PENDING_CURRENT_RELEASE')
      .set(...auth(cNorth.token));
    expect(northTransfers2.status).toBe(200);
    const t1NorthRelease = northTransfers2.body.items.find((x: any) => x.id === t1Id);
    expect(t1NorthRelease).toBeDefined();
    expect(t1NorthRelease.canReleaseWorker).toBe(true);
    expect(t1NorthRelease.requiredNextAction).toBe('Awaiting your release approval');

    // Duplicate destination approval is rejected
    const dupDestApprove = await ctx.http()
      .post(`/api/v1/contractor/transfers/${t1Id}/approve`)
      .set(...auth(cSouth.token))
      .send({});
    expect(dupDestApprove.status).toBe(403);

    // Step 4: Current contractor (North) releases the worker
    const currentRelease = await ctx.http()
      .post(`/api/v1/contractor/transfers/${t1Id}/release`)
      .set(...auth(cNorth.token))
      .send({ reason: 'Worker released smoothly' });
    expect(currentRelease.status).toBe(201);
    expect(currentRelease.body.status).toBe('ACCEPTED');

    // Verify transfer completion & worker site move
    const w1Me = await ctx.http().get('/api/v1/workers/me').set(...auth(w1.token));
    expect(w1Me.body.currentSite.siteId).toBe('SITE-T3-S');

    // Duplicate release attempt on completed request is rejected (409 Conflict)
    const dupRelease = await ctx.http()
      .post(`/api/v1/contractor/transfers/${t1Id}/release`)
      .set(...auth(cNorth.token))
      .send({});
    expect(dupRelease.status).toBe(409);

    // Check detail & timeline for completed transfer
    const t1Detail = await ctx.http()
      .get(`/api/v1/contractor/transfers/${t1Id}`)
      .set(...auth(cSouth.token));
    expect(t1Detail.status).toBe(200);
    expect(t1Detail.body.status).toBe('ACCEPTED');
    expect(t1Detail.body.timeline.length).toBeGreaterThanOrEqual(4);
    expect(t1Detail.body.timeline.map((x: any) => x.step)).toEqual(
      expect.arrayContaining(['INITIATED', 'DESTINATION_APPROVAL', 'CURRENT_RELEASE', 'COMPLETED']),
    );
    expect(t1Detail.body.worker.malariaStatus).toBeNull();

    // =========================================================================
    // 2. CONTRACTOR-INITIATED TRANSFER WORKFLOW
    // Sequence: Contractor initiates -> Worker accepts -> Current releases -> Complete
    // Destination approval is NOT required.
    // =========================================================================
    const cInitiate = await ctx.http()
      .post('/api/v1/contractor/transfers/initiate')
      .set(...auth(cSouth.token))
      .send({
        workerId: w2.workerId,
        toSiteId: 'SITE-T3-S',
        note: 'Pulling worker for masonry work',
      });
    expect(cInitiate.status).toBe(201);
    expect(cInitiate.body.status).toBe('PENDING_WORKER_RESPONSE');
    const t2Id = cInitiate.body.id;

    // Check status in contractor transfer list
    const southTransfersInit = await ctx.http()
      .get('/api/v1/contractor/transfers?status=PENDING_WORKER_RESPONSE')
      .set(...auth(cSouth.token));
    expect(southTransfersInit.status).toBe(200);
    const t2South = southTransfersInit.body.items.find((x: any) => x.id === t2Id);
    expect(t2South).toBeDefined();
    expect(t2South.requiredNextAction).toBe('Awaiting worker response');

    // Current contractor cannot release before worker acceptance
    const prematureReleaseContractor = await ctx.http()
      .post(`/api/v1/contractor/transfers/${t2Id}/release`)
      .set(...auth(cNorth.token))
      .send({});
    expect(prematureReleaseContractor.status).toBe(403);

    // Worker accepts transfer in worker application
    const workerAccept = await ctx.http()
      .post(`/api/v1/transfers/${t2Id}/worker/accept`)
      .set(...auth(w2.token))
      .send({});
    expect(workerAccept.status).toBe(201);
    expect(workerAccept.body.status).toBe('PENDING_CURRENT_CONTRACTOR');

    // Current contractor releases worker
    const currentRelease2 = await ctx.http()
      .post(`/api/v1/contractor/transfers/${t2Id}/release`)
      .set(...auth(cNorth.token))
      .send({ reason: 'All dues cleared, worker released' });
    expect(currentRelease2.status).toBe(201);
    expect(currentRelease2.body.status).toBe('ACCEPTED');

    // Verify worker 2 site updated
    const w2Me = await ctx.http().get('/api/v1/workers/me').set(...auth(w2.token));
    expect(w2Me.body.currentSite.siteId).toBe('SITE-T3-S');

    // =========================================================================
    // 3. REJECTION, CANCELLATION, RBAC, AND ISOLATION CHECKS
    // =========================================================================
    // Worker 3: Rejection test
    const w3 = await registerWorker(ctx, { name: 'Kavita Devi', phone: '9819003003', pin: '3333' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(w3.token)).send({ siteId: 'SITE-T3-N' });

    const w3Req = await ctx.http()
      .post('/api/v1/transfers/worker')
      .set(...auth(w3.token))
      .send({ toSiteId: 'SITE-T3-S' });
    const t3Id = w3Req.body.id;

    // Destination contractor rejects
    const rejectRes = await ctx.http()
      .post(`/api/v1/contractor/transfers/${t3Id}/reject`)
      .set(...auth(cSouth.token))
      .send({ reason: 'Site at full capacity' });
    expect(rejectRes.status).toBe(201);
    expect(rejectRes.body.status).toBe('REJECTED');

    // Worker 3 site remains at North
    const w3Me = await ctx.http().get('/api/v1/workers/me').set(...auth(w3.token));
    expect(w3Me.body.currentSite.siteId).toBe('SITE-T3-N');

    // Cancellation test: Contractor initiates then cancels
    const w4 = await registerWorker(ctx, { name: 'Rahul Bose', phone: '9819003004', pin: '4444' });
    await ctx.http().post('/api/v1/workers/me/site').set(...auth(w4.token)).send({ siteId: 'SITE-T3-N' });

    const cInit4 = await ctx.http()
      .post('/api/v1/contractor/transfers/initiate')
      .set(...auth(cSouth.token))
      .send({ workerId: w4.workerId, toSiteId: 'SITE-T3-S' });
    const t4Id = cInit4.body.id;

    // Unrelated contractor C cannot view or cancel
    const crossView = await ctx.http()
      .get(`/api/v1/contractor/transfers/${t4Id}`)
      .set(...auth(cOther.token));
    expect(crossView.status).toBe(403);

    const crossCancel = await ctx.http()
      .post(`/api/v1/contractor/transfers/${t4Id}/cancel`)
      .set(...auth(cOther.token))
      .send({ reason: 'Malicious cancel' });
    expect(crossCancel.status).toBe(403);

    // Initiator cancels
    const cancelRes = await ctx.http()
      .post(`/api/v1/contractor/transfers/${t4Id}/cancel`)
      .set(...auth(cSouth.token))
      .send({ reason: 'Requirement changed' });
    expect(cancelRes.status).toBe(201);
    expect(cancelRes.body.status).toBe('CANCELLED');
  });

  it('Contractor Iteration 4: Site Management, Workforce Operations, Direct Assignment, and Transfer Guardrails', async () => {
    // 1. Setup contractors and sites
    const areaId = await createArea(ctx, 'Candolim Coastal');
    const cEast = await createContractor(ctx, { name: 'East Coast Developers', username: 'c.east.it4' });
    const cWest = await createContractor(ctx, { name: 'West Valley Builders', username: 'c.west.it4' });
    const cRogue = await createContractor(ctx, { name: 'Rogue Contractor Corp', username: 'c.rogue.it4' });

    const sEast = await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-IT4-E',
        name: 'East Coast Horizon',
        areaId,
        contractorId: cEast.contractorId,
        address: 'Plot 45 Marine Drive, Candolim',
        landmark: 'Near Lighthouse',
        contactPhone: '9820000011',
      },
    });

    const sWest = await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-IT4-W',
        name: 'West Valley Heights',
        areaId,
        contractorId: cWest.contractorId,
        address: 'Survey 102 Hill Road, Panaji',
        landmark: 'Opposite State Library',
        contactPhone: '9820000022',
      },
    });

    // 2. Site Overview List and Search:
    // cEast should see SITE-IT4-E with address and operational info
    const sitesRes = await ctx.http()
      .get('/api/v1/contractor/sites')
      .set(...auth(cEast.token));
    expect(sitesRes.status).toBe(200);
    expect(Array.isArray(sitesRes.body)).toBe(true);

    const eastSite = sitesRes.body.find((s: any) => s.siteCode === 'SITE-IT4-E');
    expect(eastSite).toBeDefined();
    expect(eastSite.name).toBe('East Coast Horizon');
    expect(eastSite.address).toBe('Plot 45 Marine Drive, Candolim');
    expect(eastSite.landmark).toBe('Near Lighthouse');
    expect(eastSite.contactPhone).toBe('9820000011');
    expect(eastSite.assignmentStatus).toBe('PRIMARY_CONTRACTOR');
    expect(eastSite.activeWorkers).toBe(0);

    // cEast should NOT see sWest
    const westInEast = sitesRes.body.find((s: any) => s.siteCode === 'SITE-IT4-W');
    expect(westInEast).toBeUndefined();

    // Search by address keyword
    const searchAddressRes = await ctx.http()
      .get('/api/v1/contractor/sites?search=Marine')
      .set(...auth(cEast.token));
    expect(searchAddressRes.status).toBe(200);
    expect(searchAddressRes.body.some((s: any) => s.siteCode === 'SITE-IT4-E')).toBe(true);

    // Search by site code
    const searchCodeRes = await ctx.http()
      .get('/api/v1/contractor/sites?search=IT4-E')
      .set(...auth(cEast.token));
    expect(searchCodeRes.status).toBe(200);
    expect(searchCodeRes.body.some((s: any) => s.siteCode === 'SITE-IT4-E')).toBe(true);

    // Search by non-matching query -> empty list
    const searchEmptyRes = await ctx.http()
      .get('/api/v1/contractor/sites?search=NonExistentKeyword')
      .set(...auth(cEast.token));
    expect(searchEmptyRes.status).toBe(200);
    expect(searchEmptyRes.body.length).toBe(0);

    // 3. Register Unassigned Worker and Directly Assign to Site:
    const wUnassigned = await registerWorker(ctx, {
      name: 'Prakash Jena',
      phone: '9820110001',
      pin: '1234',
    });

    // Worker Prakash has no active site assignment yet
    const lookupPrakash = await ctx.http()
      .get(`/api/v1/workers/lookup/${wUnassigned.workerId}`)
      .set(...auth(cEast.token));
    expect(lookupPrakash.status).toBe(200);
    expect(lookupPrakash.body.currentSite).toBeNull();

    // cEast directly assigns Prakash to SITE-IT4-E
    const assignRes = await ctx.http()
      .post('/api/v1/contractor/sites/SITE-IT4-E/assign-worker')
      .set(...auth(cEast.token))
      .send({ workerCode: wUnassigned.workerId, note: 'Initial project deployment' });
    expect(assignRes.status).toBe(201);
    expect(assignRes.body.success).toBe(true);
    expect(assignRes.body.worker.workerCode).toBe(wUnassigned.workerId);
    expect(assignRes.body.site.siteCode).toBe('SITE-IT4-E');

    // Verify database record
    const dbAssignment = await ctx.prisma.workerSiteAssignment.findFirst({
      where: { worker: { workerCode: wUnassigned.workerId }, active: true },
      include: { site: true },
    });
    expect(dbAssignment).toBeDefined();
    expect(dbAssignment?.site.siteCode).toBe('SITE-IT4-E');
    expect(dbAssignment?.status).toBe('ACTIVE');

    // 4. Duplicate Active Assignment Prevention:
    // Assigning the same worker again to the same site must fail (400)
    const dupAssignRes = await ctx.http()
      .post('/api/v1/contractor/sites/SITE-IT4-E/assign-worker')
      .set(...auth(cEast.token))
      .send({ workerCode: wUnassigned.workerId });
    expect(dupAssignRes.status).toBe(400);
    expect(dupAssignRes.body.message).toMatch(/already actively assigned/i);

    // 5. Transfer Rule Enforcement (Prevent direct reassignment of already-assigned worker):
    // cWest attempts to directly assign Prakash to SITE-IT4-W without a transfer -> Must fail (400)
    const reassignRes = await ctx.http()
      .post('/api/v1/contractor/sites/SITE-IT4-W/assign-worker')
      .set(...auth(cWest.token))
      .send({ workerCode: wUnassigned.workerId });
    expect(reassignRes.status).toBe(400);
    expect(reassignRes.body.message).toMatch(/Transfer Request/i);

    // Prakash remains assigned to SITE-IT4-E
    const prakashCurrent = await ctx.prisma.workerSiteAssignment.findFirst({
      where: { worker: { workerCode: wUnassigned.workerId }, active: true },
      include: { site: true },
    });
    expect(prakashCurrent?.site.siteCode).toBe('SITE-IT4-E');

    // 6. Site Details API:
    // Check master details, active/inactive counts, workforce list, travel records, transfers
    const detailRes = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-IT4-E/detail')
      .set(...auth(cEast.token));
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.site.siteCode).toBe('SITE-IT4-E');
    expect(detailRes.body.site.name).toBe('East Coast Horizon');
    expect(detailRes.body.site.address).toBe('Plot 45 Marine Drive, Candolim');
    expect(detailRes.body.site.landmark).toBe('Near Lighthouse');
    expect(detailRes.body.site.contactPhone).toBe('9820000011');
    expect(detailRes.body.site.contractorRole).toBe('PRIMARY');
    expect(detailRes.body.canAssignWorkers).toBe(true);

    // Verify active/inactive counts
    expect(detailRes.body.stats.activeWorkers).toBe(1);
    expect(detailRes.body.stats.inactiveWorkers).toBe(0);
    expect(detailRes.body.stats.totalAssigned).toBe(1);

    // Verify workforce list
    expect(detailRes.body.workers.length).toBe(1);
    const wRow = detailRes.body.workers[0];
    expect(wRow.workerId).toBe(wUnassigned.workerId);
    expect(wRow.name).toBe('Prakash Jena');
    expect(wRow.assignmentStatus).toBe('ACTIVE');
    expect(wRow.startedAt).toBeDefined();
    expect(wRow.malariaStatus).toBeNull(); // Strictly masked

    // 7. Site Workforce Filtering & Search:
    // Search within site workforce
    const searchWorkforce = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-IT4-E/workers?search=Prakash')
      .set(...auth(cEast.token));
    expect(searchWorkforce.status).toBe(200);
    expect(searchWorkforce.body.items.length).toBe(1);
    expect(searchWorkforce.body.items[0].workerId).toBe(wUnassigned.workerId);

    // 8. Ending Worker Assignment:
    const endAssignRes = await ctx.http()
      .post(`/api/v1/contractor/sites/SITE-IT4-E/workers/${wUnassigned.workerId}/end-assignment`)
      .set(...auth(cEast.token))
      .send({ reason: 'Project phase completed' });
    expect(endAssignRes.status).toBe(201);
    expect(endAssignRes.body.success).toBe(true);

    // Verify database record is ended
    const endedDbAssignment = await ctx.prisma.workerSiteAssignment.findFirst({
      where: { worker: { workerCode: wUnassigned.workerId }, siteId: sEast.id },
    });
    expect(endedDbAssignment?.active).toBe(false);
    expect(endedDbAssignment?.status).toBe('ENDED');
    expect(endedDbAssignment?.endedAt).toBeDefined();

    // Verify site detail active/inactive counts updated
    const detailAfterEnd = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-IT4-E/detail')
      .set(...auth(cEast.token));
    expect(detailAfterEnd.status).toBe(200);
    expect(detailAfterEnd.body.stats.activeWorkers).toBe(0);
    expect(detailAfterEnd.body.stats.inactiveWorkers).toBe(1);
    expect(detailAfterEnd.body.stats.totalAssigned).toBe(1);

    // Workforce list with status=ENDED
    const endedWorkforce = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-IT4-E/workers?status=ENDED')
      .set(...auth(cEast.token));
    expect(endedWorkforce.status).toBe(200);
    expect(endedWorkforce.body.items.length).toBe(1);
    expect(endedWorkforce.body.items[0].assignmentStatus).toBe('ENDED');

    // Workforce list with status=ACTIVE -> empty
    const activeWorkforce = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-IT4-E/workers?status=ACTIVE')
      .set(...auth(cEast.token));
    expect(activeWorkforce.status).toBe(200);
    expect(activeWorkforce.body.items.length).toBe(0);

    // 9. RBAC & Cross-Contractor Isolation:
    // Rogue contractor cannot view SITE-IT4-E details
    const rogueDetail = await ctx.http()
      .get('/api/v1/contractor/sites/SITE-IT4-E/detail')
      .set(...auth(cRogue.token));
    expect(rogueDetail.status).toBe(403);

    // Rogue contractor cannot assign workers to SITE-IT4-E
    const rogueAssign = await ctx.http()
      .post('/api/v1/contractor/sites/SITE-IT4-E/assign-worker')
      .set(...auth(cRogue.token))
      .send({ workerCode: wUnassigned.workerId });
    expect(rogueAssign.status).toBe(403);

    // Rogue contractor cannot end assignments at SITE-IT4-E
    const rogueEnd = await ctx.http()
      .post(`/api/v1/contractor/sites/SITE-IT4-E/workers/${wUnassigned.workerId}/end-assignment`)
      .set(...auth(cRogue.token));
    expect(rogueEnd.status).toBe(403);
  });

  it('Contractor Iteration 5: Worker Activity Timeline, Operational Alerts, Health Surveillance Coordination, and Strict Privacy', async () => {
    // 1. Setup contractors and sites
    const areaId = await createArea(ctx, 'Candolim Surveillance Area IT5');
    const cAlpha = await createContractor(ctx, { name: 'Alpha Infrastructure Ltd', username: 'c.alpha.it5' });
    const cBeta = await createContractor(ctx, { name: 'Beta Constructions', username: 'c.beta.it5' });

    const sAlpha = await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-IT5-A',
        name: 'Alpha Palm Residency',
        areaId,
        address: 'Plot 100 Coastal Highway, Candolim',
        landmark: 'Near Football Ground',
        contactPhone: '9822001122',
        contractorId: cAlpha.contractorId,
        active: true,
      },
    });

    const sBeta = await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-IT5-B',
        name: 'Beta Bayfront Towers',
        areaId,
        address: 'Plot 200 Marine Drive, Miramar',
        landmark: 'Near Circle',
        contactPhone: '9822003344',
        contractorId: cBeta.contractorId,
        active: true,
      },
    });

    // 2. Register workers
    const w1 = await registerWorker(ctx, {
      name: 'Santosh Rawat',
      phone: '9820550001',
      pin: '1234',
    });
    const w2 = await registerWorker(ctx, {
      name: 'Dinesh Kumar',
      phone: '9820550002',
      pin: '1234',
    });

    // Worker 1 direct assignment to Alpha site
    const assignRes1 = await ctx.http()
      .post('/api/v1/contractor/sites/SITE-IT5-A/assign-worker')
      .set(...auth(cAlpha.token))
      .send({ workerCode: w1.workerId, note: 'Deployment for Foundation phase' });
    expect(assignRes1.status).toBe(201);

    // Worker 2 direct assignment to Alpha site
    const assignRes2 = await ctx.http()
      .post('/api/v1/contractor/sites/SITE-IT5-A/assign-worker')
      .set(...auth(cAlpha.token))
      .send({ workerCode: w2.workerId, note: 'Deployment for Framing phase' });
    expect(assignRes2.status).toBe(201);

    // 3. Worker Travel Events:
    // w1 entered Goa
    const w1Record = await ctx.prisma.worker.findUnique({ where: { workerCode: w1.workerId } });
    await ctx.prisma.travelRecord.create({
      data: {
        workerId: w1Record!.id,
        planningTravel: false,
        direction: 'ENTERING_GOA',
        originTown: 'Rourkela',
        originState: 'Odisha',
        destination: 'Candolim',
        state: 'Goa',
        departureDate: new Date('2026-11-01T08:00:00.000Z'),
        status: 'CONFIRMED',
        updatedAt: new Date(),
      },
    });

    // w2 exited Goa
    const w2Record = await ctx.prisma.worker.findUnique({ where: { workerCode: w2.workerId } });
    await ctx.prisma.travelRecord.create({
      data: {
        workerId: w2Record!.id,
        planningTravel: true,
        direction: 'LEAVING_GOA',
        destination: 'Ranchi',
        state: 'Jharkhand',
        departureDate: new Date('2026-11-05T09:00:00.000Z'),
        returnDate: new Date('2026-11-25T18:00:00.000Z'),
        status: 'SUBMITTED',
        updatedAt: new Date(),
      },
    });

    // 4. End assignment for worker 2
    const endAssignRes = await ctx.http()
      .post(`/api/v1/contractor/sites/SITE-IT5-A/workers/${w2.workerId}/end-assignment`)
      .set(...auth(cAlpha.token))
      .send({ reason: 'Framing phase complete, worker released' });
    expect(endAssignRes.status).toBe(201);

    // 5. Worker Transfer Workflow:
    // Transfer w2 to Beta site (initiated by contractor Beta)
    const initTransferRes = await ctx.http()
      .post('/api/v1/contractor/transfers/initiate')
      .set(...auth(cBeta.token))
      .send({
        workerId: w2.workerId,
        toSiteId: 'SITE-IT5-B',
        note: 'Requesting worker for electrical wiring',
      });
    expect(initTransferRes.status).toBe(201);
    const transferId = initTransferRes.body.id;

    // Worker accepts transfer
    const wAccept = await ctx.http()
      .post(`/api/v1/transfers/${transferId}/worker/accept`)
      .set(...auth(w2.token))
      .send({});
    expect(wAccept.status).toBe(201);

    // 6. Test Worker Activity Timeline API (`GET /contractor/activity`):
    const activityRes = await ctx.http()
      .get('/api/v1/contractor/activity')
      .set(...auth(cAlpha.token));
    expect(activityRes.status).toBe(200);
    expect(activityRes.body.items).toBeDefined();
    expect(activityRes.body.items.length).toBeGreaterThanOrEqual(4);

    // Verify presence of all expected event types
    const eventTypes = activityRes.body.items.map((e: any) => e.eventType);
    expect(eventTypes).toContain('ASSIGNMENT_STARTED');
    expect(eventTypes).toContain('ASSIGNMENT_ENDED');
    expect(eventTypes).toContain('ENTRY_GOA');
    expect(eventTypes).toContain('EXIT_GOA');

    // Verify event item format
    const startEvent = activityRes.body.items.find((e: any) => e.eventType === 'ASSIGNMENT_STARTED');
    expect(startEvent.workerName).toBeDefined();
    expect(startEvent.workerId).toBeDefined();
    expect(startEvent.siteCode).toBe('SITE-IT5-A');
    expect(startEvent.siteName).toBe('Alpha Palm Residency');
    expect(startEvent.timestamp).toBeDefined();
    expect(startEvent.status).toBeDefined();

    // Test Event-Type Filter: type=TRAVEL
    const travelActivity = await ctx.http()
      .get('/api/v1/contractor/activity?type=TRAVEL')
      .set(...auth(cAlpha.token));
    expect(travelActivity.status).toBe(200);
    expect(travelActivity.body.items.every((e: any) => ['ENTRY_GOA', 'EXIT_GOA'].includes(e.eventType))).toBe(true);

    // Test Worker Search Filter: search=Santosh
    const searchActivity = await ctx.http()
      .get('/api/v1/contractor/activity?search=Santosh')
      .set(...auth(cAlpha.token));
    expect(searchActivity.status).toBe(200);
    expect(searchActivity.body.items.length).toBeGreaterThanOrEqual(2);
    expect(searchActivity.body.items.every((e: any) => e.workerName.includes('Santosh'))).toBe(true);

    // Test Pagination: page=1&pageSize=2
    const pagedActivity = await ctx.http()
      .get('/api/v1/contractor/activity?page=1&pageSize=2')
      .set(...auth(cAlpha.token));
    expect(pagedActivity.status).toBe(200);
    expect(pagedActivity.body.items.length).toBe(2);
    expect(pagedActivity.body.pageSize).toBe(2);
    expect(pagedActivity.body.totalPages).toBeGreaterThanOrEqual(2);

    // 7. Not Feeling Well (Symptom Report) Alert Generation:
    // Worker 1 (actively assigned to Alpha Palm Residency) submits a symptom report
    const symptomRes = await ctx.http()
      .post('/api/v1/records/me/symptom-reports')
      .set(...auth(w1.token))
      .send({
        symptoms: ['FEVER', 'CHILLS', 'HEADACHE'],
        note: 'High fever and severe body pain since morning',
        voiceData: 'base64audio...',
        idempotencyKey: '00000000-0000-0000-0000-000000000001',
      });
    expect(symptomRes.status).toBe(201);
    const reportId = symptomRes.body.id;

    // Verify contractor Alpha received the operational alert
    const alertsRes = await ctx.http()
      .get('/api/v1/contractor/alerts?category=HEALTH_REPORT')
      .set(...auth(cAlpha.token));
    expect(alertsRes.status).toBe(200);
    expect(alertsRes.body.items.length).toBeGreaterThanOrEqual(1);

    const healthAlert = alertsRes.body.items.find((a: any) => a.entityId === reportId);
    expect(healthAlert).toBeDefined();
    expect(healthAlert.category).toBe('HEALTH_REPORT');
    expect(healthAlert.title).toMatch(/Worker Unwell/i);
    expect(healthAlert.workerId).toBe(w1.workerId);
    expect(healthAlert.workerName).toBe('Santosh Rawat');
    expect(healthAlert.siteCode).toBe('SITE-IT5-A');
    expect(healthAlert.siteName).toBe('Alpha Palm Residency');
    expect(healthAlert.read).toBe(false);

    // STRICT MEDICAL PRIVACY VERIFICATION:
    // Operational notice must NEVER expose cleartext symptoms, voice, or clinical diagnosis
    expect(healthAlert.body).not.toMatch(/FEVER|CHILLS|HEADACHE/i);
    expect(healthAlert.body).not.toMatch(/severe body pain/i);
    expect(healthAlert.body).not.toMatch(/base64audio/i);
    expect((healthAlert as any).symptoms).toBeUndefined();
    expect((healthAlert as any).voiceData).toBeUndefined();
    expect((healthAlert as any).note).toBeUndefined();
    expect((healthAlert as any).malariaStatus).toBeUndefined();

    // Health coordination information provided for local surveillance team
    expect(healthAlert.healthCoordination).toBeDefined();
    expect(healthAlert.healthCoordination.contactPhone).toBeDefined();
    expect(healthAlert.healthCoordination.actionNotice).toMatch(/surveillance team/i);

    // Deduplication check: Replaying the report does not create duplicate alerts
    const repeatSymptomRes = await ctx.http()
      .post('/api/v1/records/me/symptom-reports')
      .set(...auth(w1.token))
      .send({
        symptoms: ['FEVER', 'CHILLS', 'HEADACHE'],
        note: 'High fever and severe body pain since morning',
        idempotencyKey: '00000000-0000-0000-0000-000000000001',
      });
    expect(repeatSymptomRes.status).toBe(201);

    const alertsAfterRepeat = await ctx.http()
      .get('/api/v1/contractor/alerts?category=HEALTH_REPORT')
      .set(...auth(cAlpha.token));
    const matchingAlerts = alertsAfterRepeat.body.items.filter((a: any) => a.entityId === reportId);
    expect(matchingAlerts.length).toBe(1); // Deduped

    // 8. Transfer and Assignment Operational Alerts:
    // Contractor Beta should have received TRANSFER_WORKER_RESPONSE (worker accepted transfer)
    const betaAlerts = await ctx.http()
      .get('/api/v1/contractor/alerts?category=TRANSFER_REQUEST')
      .set(...auth(cBeta.token));
    expect(betaAlerts.status).toBe(200);
    expect(betaAlerts.body.items.length).toBeGreaterThanOrEqual(1);

    // 9. Alert Management: Read / Unread Status and Mark as Read:
    expect(alertsRes.body.unreadCount).toBeGreaterThanOrEqual(1);

    // Mark single alert as read
    const markReadRes = await ctx.http()
      .post(`/api/v1/contractor/alerts/${healthAlert.id}/read`)
      .set(...auth(cAlpha.token));
    expect(markReadRes.status).toBe(201);
    expect(markReadRes.body.read).toBe(true);

    // Query unread alerts only
    const unreadAlerts = await ctx.http()
      .get('/api/v1/contractor/alerts?status=UNREAD')
      .set(...auth(cAlpha.token));
    expect(unreadAlerts.status).toBe(200);
    const readItem = unreadAlerts.body.items.find((a: any) => a.id === healthAlert.id);
    expect(readItem).toBeUndefined();

    // Mark all as read
    const markAllRead = await ctx.http()
      .post('/api/v1/contractor/alerts/read-all')
      .set(...auth(cAlpha.token));
    expect(markAllRead.status).toBe(201);
    expect(markAllRead.body.success).toBe(true);

    const unreadAfterAll = await ctx.http()
      .get('/api/v1/contractor/alerts?status=UNREAD')
      .set(...auth(cAlpha.token));
    expect(unreadAfterAll.body.unreadCount).toBe(0);

    // 10. Privacy & Cross-Contractor Isolation:
    // Contractor Beta cannot read or acknowledge Contractor Alpha's alerts
    const crossRead = await ctx.http()
      .post(`/api/v1/contractor/alerts/${healthAlert.id}/read`)
      .set(...auth(cBeta.token));
    expect(crossRead.status).toBe(403);

    // Contractor Beta cannot see Contractor Alpha's worker activity
    const betaActivity = await ctx.http()
      .get('/api/v1/contractor/activity?siteCode=SITE-IT5-A')
      .set(...auth(cBeta.token));
    expect(betaActivity.body.items.length).toBe(0);
  });
});
