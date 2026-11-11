import { createTestApp, type TestContext } from './setup/test-app';
import { auth, createArea, createContractor, registerWorker } from './setup/fixtures';
import { Role, FacilityType, TestType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

describe('Iteration 6: End-to-End Integration and Final Acceptance Testing', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  it('Verifies Point 1: Workforce Alert Authorization and Cross-Contractor Data Isolation', async () => {
    // 1. Setup two distinct contractors
    const areaId = await createArea(ctx, 'Candolim Coastal Area');
    const cAlpha = await createContractor(ctx, { name: 'Alpha Infrastructure Ltd', username: 'c.alpha.p1' });
    const cBeta = await createContractor(ctx, { name: 'Beta Constructions Ltd', username: 'c.beta.p1' });

    // 2. Setup separate construction sites
    const sAlpha = await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-P1-ALPHA',
        name: 'Alpha Palm Residency',
        areaId,
        contractorId: cAlpha.contractorId,
        active: true,
      },
    });

    const sBeta = await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-P1-BETA',
        name: 'Beta Bayview Towers',
        areaId,
        contractorId: cBeta.contractorId,
        active: true,
      },
    });

    // 3. Register worker assigned to Alpha
    const w1 = await registerWorker(ctx, { name: 'Ramesh Nayak', phone: '9820010001', pin: '1234' });
    const assignRes = await ctx.http()
      .post('/api/v1/contractor/sites/SITE-P1-ALPHA/assign-worker')
      .set(...auth(cAlpha.token))
      .send({ workerCode: w1.workerId, note: 'Alpha workforce direct assign' });
    expect(assignRes.status).toBe(201);

    // 4. Worker submits symptom report ("Not feeling well")
    const symptomRes = await ctx.http()
      .post('/api/v1/records/me/symptom-reports')
      .set(...auth(w1.token))
      .send({
        symptoms: ['FEVER', 'HEADACHE'],
        note: 'High temperature since morning',
        idempotencyKey: '00000000-0000-0000-0000-000000000011',
      });
    expect(symptomRes.status).toBe(201);
    const reportId = symptomRes.body.id;

    // 5. Contractor Alpha receives operational alert
    const alphaAlerts = await ctx.http()
      .get('/api/v1/contractor/alerts?category=HEALTH_REPORT')
      .set(...auth(cAlpha.token));
    expect(alphaAlerts.status).toBe(200);
    const alphaAlert = alphaAlerts.body.items.find((a: any) => a.entityId === reportId);
    expect(alphaAlert).toBeDefined();
    expect(alphaAlert.workerName).toBe('Ramesh Nayak');
    expect(alphaAlert.siteCode).toBe('SITE-P1-ALPHA');

    // 6. ISOLATION CHECK: Contractor Beta CANNOT see Contractor Alpha's alerts
    const betaAlerts = await ctx.http()
      .get('/api/v1/contractor/alerts?category=HEALTH_REPORT')
      .set(...auth(cBeta.token));
    expect(betaAlerts.status).toBe(200);
    expect(betaAlerts.body.items.length).toBe(0);

    // 7. AUTHORIZATION CHECK: Contractor Beta CANNOT acknowledge Contractor Alpha's alert
    const rogueAck = await ctx.http()
      .post(`/api/v1/contractor/alerts/${alphaAlert.id}/read`)
      .set(...auth(cBeta.token));
    expect(rogueAck.status).toBe(403);

    // 8. Contractor Beta mark-all-read does NOT affect Contractor Alpha
    const betaMarkAll = await ctx.http()
      .post('/api/v1/contractor/alerts/read-all')
      .set(...auth(cBeta.token));
    expect(betaMarkAll.status).toBe(201);

    const alphaAlertsAfter = await ctx.http()
      .get('/api/v1/contractor/alerts?status=UNREAD')
      .set(...auth(cAlpha.token));
    expect(alphaAlertsAfter.body.unreadCount).toBeGreaterThanOrEqual(1);

    // 9. ISOLATION CHECK: Contractor Beta CANNOT query Contractor Alpha's site events
    const betaActivity = await ctx.http()
      .get('/api/v1/contractor/activity?siteCode=SITE-P1-ALPHA')
      .set(...auth(cBeta.token));
    expect(betaActivity.body.items.length).toBe(0);

    // 10. ISOLATION CHECK: Contractor Beta CANNOT access Contractor Alpha's worker details
    const betaWorkerDetail = await ctx.http()
      .get(`/api/v1/contractor/workers/${w1.workerId}`)
      .set(...auth(cBeta.token));
    expect(betaWorkerDetail.status).toBe(403);
  });

  it('Verifies Point 2: Maintained PHC Surveillance Source and Health Team Coordination', async () => {
    const areaId = await createArea(ctx, 'Candolim Health Zone');
    const cAlpha = await createContractor(ctx, { name: 'Alpha Infrastructure', username: 'c.alpha.p2' });

    // Ensure maintained database facility exists
    const phcFacility = await ctx.prisma.facility.create({
      data: {
        facilityCode: 'PHC-CAN-VAL01',
        name: 'Candolim Primary Health Centre',
        type: FacilityType.PHC,
        state: 'Goa',
        district: 'North Goa',
        taluka: 'Bardez',
        contactPhone: '0832-2489021',
        active: true,
      },
    });

    await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-P2-A',
        name: 'Candolim Vista Complex',
        areaId,
        contractorId: cAlpha.contractorId,
        active: true,
      },
    });

    const worker = await registerWorker(ctx, { name: 'Santosh Rawat', phone: '9820010002', pin: '1234' });
    await ctx.http()
      .post('/api/v1/contractor/sites/SITE-P2-A/assign-worker')
      .set(...auth(cAlpha.token))
      .send({ workerCode: worker.workerId });

    // Worker reports feeling unwell
    await ctx.http()
      .post('/api/v1/records/me/symptom-reports')
      .set(...auth(worker.token))
      .send({ symptoms: ['FEVER', 'CHILLS'] });

    const alerts = await ctx.http()
      .get('/api/v1/contractor/alerts?category=HEALTH_REPORT')
      .set(...auth(cAlpha.token));
    expect(alerts.status).toBe(200);
    expect(alerts.body.items.length).toBeGreaterThanOrEqual(1);

    const alert = alerts.body.items[0];
    expect(alert.healthCoordination).toBeDefined();
    // Verified against database facility registry
    expect(alert.healthCoordination.facilityName).toBe('Candolim Primary Health Centre');
    expect(alert.healthCoordination.contactPhone).toBe('0832-2489021');
    expect(alert.healthCoordination.taluka).toBe('Bardez');
    expect(alert.healthCoordination.actionNotice).toMatch(/health surveillance team/i);
  });

  it('Verifies Point 3: Offline Submissions, Idempotency, and Duplicate Prevention', async () => {
    const areaId = await createArea(ctx, 'Panaji Surveillance Zone');
    const cAlpha = await createContractor(ctx, { name: 'Coastal Builders', username: 'c.alpha.p3' });

    await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-P3-A',
        name: 'Miramar Waterfront',
        areaId,
        contractorId: cAlpha.contractorId,
        active: true,
      },
    });

    const worker = await registerWorker(ctx, { name: 'Dinesh Kumar', phone: '9820010003', pin: '1234' });
    await ctx.http()
      .post('/api/v1/contractor/sites/SITE-P3-A/assign-worker')
      .set(...auth(cAlpha.token))
      .send({ workerCode: worker.workerId });

    const clientUuid = 'a0000000-0000-0000-0000-000000000099';

    // 1. Initial offline sync submission
    const sync1 = await ctx.http()
      .post('/api/v1/records/me/symptom-reports')
      .set(...auth(worker.token))
      .send({
        symptoms: ['FEVER'],
        idempotencyKey: clientUuid,
      });
    expect(sync1.status).toBe(201);
    const reportId = sync1.body.id;

    // Verify 1 notification created for authorized contractor
    const contractorUser = await ctx.prisma.user.findFirst({ where: { contractorId: cAlpha.contractorId } });
    const notifs1 = await ctx.prisma.notification.count({
      where: { type: 'WORKER_FEELING_UNWELL', entityId: reportId, audienceUserId: contractorUser!.id },
    });
    expect(notifs1).toBe(1);

    // 2. Replay of identical offline submission (same idempotencyKey)
    const sync2 = await ctx.http()
      .post('/api/v1/records/me/symptom-reports')
      .set(...auth(worker.token))
      .send({
        symptoms: ['FEVER'],
        idempotencyKey: clientUuid,
      });
    expect(sync2.status).toBe(201);
    expect(sync2.body.id).toBe(reportId); // Returns same prior record

    // Verify duplicate alert is strictly suppressed
    const notifs2 = await ctx.prisma.notification.count({
      where: { type: 'WORKER_FEELING_UNWELL', entityId: reportId, audienceUserId: contractorUser!.id },
    });
    expect(notifs2).toBe(1); // ZERO duplicate alerts

    // 3. Repeated submission within 2 hours without new symptoms
    const repeatWithin2h = await ctx.http()
      .post('/api/v1/records/me/symptom-reports')
      .set(...auth(worker.token))
      .send({ symptoms: ['FEVER'] });
    expect(repeatWithin2h.status).toBe(201);

    const totalWorkerUnwellNotifs = await ctx.prisma.notification.count({
      where: { type: 'WORKER_FEELING_UNWELL' },
    });
    // 1 for Admin + 1 for Contractor. Zero duplicate notifications created on repeat!
    expect(totalWorkerUnwellNotifs).toBe(2);

    const contractorNotifsAfterRepeat = await ctx.prisma.notification.count({
      where: { type: 'WORKER_FEELING_UNWELL', audienceUserId: contractorUser!.id },
    });
    expect(contractorNotifsAfterRepeat).toBe(1);

    // 4. Travel record duplicate prevention: repeat submission with idempotency key returns prior record
    const travelKey = '00000000-0000-0000-0000-000000000088';
    const travel1 = await ctx.http()
      .post('/api/v1/records/me/travel')
      .set(...auth(worker.token))
      .send({
        direction: 'ENTERING_GOA',
        originTown: 'Patna',
        originState: 'Bihar',
        destination: 'Panaji',
        state: 'Goa',
        departureDate: new Date().toISOString(),
        idempotencyKey: travelKey,
      });
    expect(travel1.status).toBe(201);

    const travel2 = await ctx.http()
      .post('/api/v1/records/me/travel')
      .set(...auth(worker.token))
      .send({
        direction: 'ENTERING_GOA',
        originTown: 'Patna',
        originState: 'Bihar',
        destination: 'Panaji',
        state: 'Goa',
        departureDate: new Date().toISOString(),
        idempotencyKey: travelKey,
      });
    expect(travel2.status).toBe(201);
    expect(travel2.body.id).toBe(travel1.body.id); // Deduplicated travel record
  });

  it('Verifies Point 4: Strict Medical Privacy Audit across All Contractor Endpoints', async () => {
    const areaId = await createArea(ctx, 'Candolim Privacy Area');
    const contractor = await createContractor(ctx, { name: 'Privacy Infra', username: 'c.privacy.p4' });

    await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-P4-A',
        name: 'Privacy Sands',
        areaId,
        contractorId: contractor.contractorId,
        active: true,
      },
    });

    const worker = await registerWorker(ctx, { name: 'Vikram Singh', phone: '9820010004', pin: '1234' });
    await ctx.http()
      .post('/api/v1/contractor/sites/SITE-P4-A/assign-worker')
      .set(...auth(contractor.token))
      .send({ workerCode: worker.workerId });

    // Worker registers sensitive clinical symptoms, audio voice note, and free text notes
    await ctx.http()
      .post('/api/v1/records/me/symptom-reports')
      .set(...auth(worker.token))
      .send({
        symptoms: ['FEVER', 'SEVERE_CHILLS', 'VOMITING', 'BODY_ACHE'],
        note: 'Suffering from high fever and severe shivering since yesterday night',
        voiceData: 'data:audio/mp4;base64,GkXfo59ChoEBQveBAULygQETH4PBbW1r...',
      });

    // 1. Audit Contractor Alerts API (`GET /contractor/alerts`)
    const alertsRes = await ctx.http()
      .get('/api/v1/contractor/alerts')
      .set(...auth(contractor.token));
    expect(alertsRes.status).toBe(200);

    const alertJson = JSON.stringify(alertsRes.body);
    // MUST NOT CONTAIN ANY SENSITIVE SYMPTOMS, VOICE DATA, OR CLINICAL NOTES
    expect(alertJson).not.toMatch(/FEVER|SEVERE_CHILLS|VOMITING|BODY_ACHE/i);
    expect(alertJson).not.toMatch(/high fever and severe shivering/i);
    expect(alertJson).not.toMatch(/GkXfo59ChoEBQveBAULygQETH4PBbW1r/i);
    expect(alertJson).not.toMatch(/"voiceData"/i);
    expect(alertJson).not.toMatch(/"diagnosis"/i);

    // 2. Audit Contractor Activity Timeline API (`GET /contractor/activity`)
    const activityRes = await ctx.http()
      .get('/api/v1/contractor/activity')
      .set(...auth(contractor.token));
    expect(activityRes.status).toBe(200);

    const activityJson = JSON.stringify(activityRes.body);
    expect(activityJson).not.toMatch(/FEVER|CHILLS|VOMITING/i);
    expect(activityJson).not.toMatch(/shivering/i);

    // 3. Audit Contractor Worker Details API (`GET /contractor/workers/:workerCode`)
    const workerRes = await ctx.http()
      .get(`/api/v1/contractor/workers/${worker.workerId}`)
      .set(...auth(contractor.token));
    expect(workerRes.status).toBe(200);
    // Individual malaria status must remain null (no confirmed result yet)
    expect(workerRes.body.malariaStatus).toBeNull();
    // No household clinical history or symptoms leaked
    expect((workerRes.body as any).symptoms).toBeUndefined();
    expect((workerRes.body as any).prescriptions).toBeUndefined();
  });

  it('Verifies Complete Integrated Inter-Role Lifecycle: Worker -> Contractor -> Health Worker', async () => {
    // 1. Admin provisions Area and Facility
    const areaId = await createArea(ctx, 'Integrated Surveillance Taluka');
    const adminUser = await ctx.prisma.user.create({
      data: {
        role: Role.ADMIN,
        username: 'admin.e2e',
        displayName: 'E2E Admin',
        passwordHash: await bcrypt.hash('password123', 10),
      },
    });
    const adminLogin = await ctx.http()
      .post('/api/v1/auth/staff/login')
      .send({ username: 'admin.e2e', password: 'password123' });
    const adminToken = adminLogin.body.token;

    const facRes = await ctx.http()
      .post('/api/v1/facilities')
      .set(...auth(adminToken))
      .send({
        facilityCode: 'PHC-E2E-01',
        name: 'Candolim Community Health Centre',
        type: FacilityType.CHC,
        state: 'Goa',
        district: 'North Goa',
        taluka: 'Bardez',
        contactPhone: '9822998877',
      });
    expect(facRes.status).toBe(201);
    const facilityId = facRes.body.id;

    // 2. Health Worker provisioned
    const hwUser = await ctx.prisma.user.create({
      data: {
        role: Role.HEALTH_WORKER,
        username: 'hw.e2e',
        displayName: 'HW Sunita Rao',
        phone: '9822007788',
        stakeholderCode: 'HW000099',
        passwordHash: await bcrypt.hash('password123', 10),
        active: true,
      },
    });

    await ctx.http()
      .post('/api/v1/facilities/staff')
      .set(...auth(adminToken))
      .send({ facilityId, userId: hwUser.id, role: Role.HEALTH_WORKER });

    const hwLogin = await ctx.http()
      .post('/api/v1/auth/staff/login')
      .send({ username: 'hw.e2e', password: 'password123' });
    const hwToken = hwLogin.body.token;

    // 3. Contractor provisioned
    const contractor = await createContractor(ctx, { name: 'E2E Projects Ltd', username: 'c.e2e.contractor' });
    const site = await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-E2E-01',
        name: 'E2E Palm Resort',
        areaId,
        contractorId: contractor.contractorId,
        active: true,
      },
    });

    // 4. Worker Registers & Submits Travel with GPS coordinates
    const worker = await registerWorker(ctx, { name: 'Prakash Jena', phone: '9820559901', pin: '1234' });
    const travelRes = await ctx.http()
      .post('/api/v1/records/me/travel')
      .set(...auth(worker.token))
      .send({
        direction: 'ENTERING_GOA',
        originTown: 'Bhubaneswar',
        originState: 'Odisha',
        destination: 'Candolim',
        state: 'Goa',
        departureDate: new Date().toISOString(),
        latitude: 15.5186,
        longitude: 73.7631,
      });
    expect(travelRes.status).toBe(201);

    // 5. Worker registers Household Member
    const hhRes = await ctx.http()
      .post('/api/v1/workers/me/household')
      .set(...auth(worker.token))
      .send({
        fullName: 'Manoj Jena',
        relationship: 'SIBLING',
        gender: 'male',
        age: 22,
      });
    expect(hhRes.status).toBe(201);

    // 6. Contractor directly assigns worker to Site
    const assignRes = await ctx.http()
      .post('/api/v1/contractor/sites/SITE-E2E-01/assign-worker')
      .set(...auth(contractor.token))
      .send({ workerCode: worker.workerId, note: 'Masonry Phase' });
    expect(assignRes.status).toBe(201);

    // 7. Verify Contractor Dashboard reflects metrics
    const dashRes = await ctx.http()
      .get('/api/v1/contractor/dashboard')
      .set(...auth(contractor.token));
    expect(dashRes.status).toBe(200);
    expect(dashRes.body.metrics.totalAssignedWorkers).toBe(1);
    expect(dashRes.body.metrics.activeWorkers).toBe(1);

    // 8. Health Worker searches for worker by workerCode
    const hwSearch = await ctx.http()
      .get(`/api/v1/health-worker/search?q=${worker.workerId}`)
      .set(...auth(hwToken));
    expect(hwSearch.status).toBe(200);
    expect(hwSearch.body.workers.length).toBeGreaterThanOrEqual(1);
    expect(hwSearch.body.workers[0].workerCode).toBe(worker.workerId);

    // 9. Health Worker views Travel Arrivals
    const travelArrivals = await ctx.http()
      .get(`/api/v1/health-worker/travel-arrivals?facilityId=${facilityId}`)
      .set(...auth(hwToken));
    expect(travelArrivals.status).toBe(200);
  });

  it('Verifies Full Transfer State Transitions and Multi-Contractor Notification Machine', async () => {
    const areaId = await createArea(ctx, 'Transfer Area Zone');
    const cNorth = await createContractor(ctx, { name: 'North Builders', username: 'c.north.trans' });
    const cSouth = await createContractor(ctx, { name: 'South Infra', username: 'c.south.trans' });

    await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-TRANS-N',
        name: 'North Residency',
        areaId,
        contractorId: cNorth.contractorId,
        active: true,
      },
    });

    await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-TRANS-S',
        name: 'South Heights',
        areaId,
        contractorId: cSouth.contractorId,
        active: true,
      },
    });

    // 1. Worker assigned to North
    const worker = await registerWorker(ctx, { name: 'Sunil Gavaskar', phone: '9820558801', pin: '1234' });
    await ctx.http()
      .post('/api/v1/contractor/sites/SITE-TRANS-N/assign-worker')
      .set(...auth(cNorth.token))
      .send({ workerCode: worker.workerId });

    // 2. Contractor South initiates pull transfer: North -> South
    const initTransfer = await ctx.http()
      .post('/api/v1/contractor/transfers/initiate')
      .set(...auth(cSouth.token))
      .send({
        workerId: worker.workerId,
        toSiteId: 'SITE-TRANS-S',
        note: 'Requesting experienced carpenter for roof installation',
      });
    expect(initTransfer.status).toBe(201);
    expect(initTransfer.body.status).toBe('PENDING_WORKER_RESPONSE');
    const transferId = initTransfer.body.id;

    // 3. Worker accepts transfer
    const workerAccept = await ctx.http()
      .post(`/api/v1/transfers/${transferId}/worker/accept`)
      .set(...auth(worker.token))
      .send({});
    expect(workerAccept.status).toBe(201);
    expect(workerAccept.body.status).toBe('PENDING_CURRENT_CONTRACTOR');

    // Operational alert received by releasing Contractor North
    const northAlerts = await ctx.http()
      .get('/api/v1/contractor/alerts?category=TRANSFER_REQUEST')
      .set(...auth(cNorth.token));
    expect(northAlerts.status).toBe(200);
    const releaseReqAlert = northAlerts.body.items.find((a: any) => a.entityId === transferId);
    expect(releaseReqAlert).toBeDefined();

    // 4. Current contractor North releases worker (approves transfer)
    const releaseApprove = await ctx.http()
      .post(`/api/v1/contractor/transfers/${transferId}/approve`)
      .set(...auth(cNorth.token))
      .send({ note: 'Released on schedule' });
    expect(releaseApprove.status).toBe(201);
    expect(releaseApprove.body.status).toBe('ACCEPTED');

    // 5. Verify workforce state transition:
    // Old assignment closed, new active assignment on South site
    const workerRecord = await ctx.prisma.worker.findUnique({
      where: { workerCode: worker.workerId },
      include: {
        assignments: {
          include: { site: true },
          orderBy: { startedAt: 'asc' },
        },
      },
    });
    expect(workerRecord?.assignments.length).toBe(2);
    const activeAss = workerRecord?.assignments.find((a) => a.active);
    expect(activeAss).toBeDefined();
    expect(activeAss?.site.siteCode).toBe('SITE-TRANS-S');

    // 6. Verify Transfer Activity Feed on both contractors
    const northActivity = await ctx.http()
      .get('/api/v1/contractor/activity?type=TRANSFER')
      .set(...auth(cNorth.token));
    expect(northActivity.status).toBe(200);
    expect(northActivity.body.items.some((e: any) => e.eventType.includes('TRANSFER'))).toBe(true);

    const southActivity = await ctx.http()
      .get('/api/v1/contractor/activity?type=TRANSFER')
      .set(...auth(cSouth.token));
    expect(southActivity.status).toBe(200);
    expect(southActivity.body.items.some((e: any) => e.eventType.includes('TRANSFER'))).toBe(true);
  });

  it('Verifies RBAC Boundary Protection across Worker, Contractor, Health Worker, and Admin Roles', async () => {
    const areaId = await createArea(ctx, 'RBAC Zone');
    const worker = await registerWorker(ctx, { name: 'RBAC Worker', phone: '9820557701', pin: '1234' });
    const contractor = await createContractor(ctx, { name: 'RBAC Builders', username: 'c.rbac.user' });

    // 1. Worker attempting Contractor endpoints -> 403 Forbidden
    const wToContractor = await ctx.http()
      .get('/api/v1/contractor/dashboard')
      .set(...auth(worker.token));
    expect(wToContractor.status).toBe(403);

    const wToContractorAlerts = await ctx.http()
      .get('/api/v1/contractor/alerts')
      .set(...auth(worker.token));
    expect(wToContractorAlerts.status).toBe(403);

    // 2. Worker attempting Health Worker endpoints -> 403 Forbidden
    const wToHealthWorker = await ctx.http()
      .get('/api/v1/health-worker/dashboard')
      .set(...auth(worker.token));
    expect(wToHealthWorker.status).toBe(403);

    // 3. Contractor attempting Admin endpoints -> 403 Forbidden
    const cToAdmin = await ctx.http()
      .get('/api/v1/admin/users')
      .set(...auth(contractor.token));
    expect(cToAdmin.status).toBe(403);

    // 4. Contractor attempting Health Worker endpoints -> 403 Forbidden
    const cToHealthWorker = await ctx.http()
      .get('/api/v1/health-worker/workers/search?query=test')
      .set(...auth(contractor.token));
    expect(cToHealthWorker.status).toBe(403);
  });
});
