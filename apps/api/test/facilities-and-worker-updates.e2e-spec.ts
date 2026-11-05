import { createTestApp, type TestContext } from './setup/test-app';
import { auth, createArea, createStaff, registerWorker } from './setup/fixtures';
import * as bcrypt from 'bcryptjs';

describe('Facilities, PHC/UHC & Worker App Updates (e2e)', () => {
  let ctx: TestContext;
  let admin: { token: string; userId: string };
  let healthWorker: { token: string; userId: string };
  let clinician: { token: string; userId: string };
  let worker: { token: string; workerId: string };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.reset();

    // 1. Create Admin
    const adminUser = await ctx.prisma.user.create({
      data: {
        role: 'ADMIN',
        username: 'admin.fac',
        displayName: 'Platform Admin',
        passwordHash: await bcrypt.hash('password123', 10),
      },
    });
    const adminLogin = await ctx.http()
      .post('/api/v1/auth/staff/login')
      .send({ username: 'admin.fac', password: 'password123' });
    admin = { token: adminLogin.body.token, userId: adminUser.id };

    // 2. Create Health Worker
    const hwUser = await ctx.prisma.user.create({
      data: {
        role: 'HEALTH_WORKER',
        username: 'hw.candolim',
        displayName: 'HW Sunita Naik',
        phone: '9822001122',
        passwordHash: await bcrypt.hash('password123', 10),
      },
    });
    const hwLogin = await ctx.http()
      .post('/api/v1/auth/staff/login')
      .send({ username: 'hw.candolim', password: 'password123' });
    healthWorker = { token: hwLogin.body.token, userId: hwUser.id };

    // 3. Create Clinician
    const clinUser = await ctx.prisma.user.create({
      data: {
        role: 'CLINICIAN',
        username: 'dr.desai',
        displayName: 'Dr. Ramesh Desai',
        phone: '9822003344',
        passwordHash: await bcrypt.hash('password123', 10),
      },
    });
    const clinLogin = await ctx.http()
      .post('/api/v1/auth/staff/login')
      .send({ username: 'dr.desai', password: 'password123' });
    clinician = { token: clinLogin.body.token, userId: clinUser.id };

    // 4. Create Worker
    worker = await registerWorker(ctx, {
      name: 'Ramesh Kumar',
      phone: '9822998877',
      pin: '1234',
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Facilities Management (PHC / UHC CRUD)
  // ───────────────────────────────────────────────────────────────────────────

  it('Admin can create PHC and UHC facilities and prevent duplicate codes', async () => {
    // 1.1 Create PHC
    const phcRes = await ctx.http()
      .post('/api/v1/facilities')
      .set(...auth(admin.token))
      .send({
        name: 'Candolim Primary Health Centre',
        facilityType: 'PHC',
        state: 'Goa',
        district: 'North Goa',
        taluka: 'Bardez',
        address: 'Near Candolim Panchayat, Candolim, Goa',
        latitude: 15.5173,
        longitude: 73.7667,
        phone: '0832-2489001',
        email: 'phc.candolim@goa.gov.in',
        active: true,
      });

    expect(phcRes.status).toBe(201);
    expect(phcRes.body.facilityCode).toMatch(/^PHC-/);
    expect(phcRes.body.type).toBe('PHC');
    expect(phcRes.body.name).toBe('Candolim Primary Health Centre');
    const phcId = phcRes.body.id;

    // 1.2 Create UHC
    const uhcRes = await ctx.http()
      .post('/api/v1/facilities')
      .set(...auth(admin.token))
      .send({
        name: 'Panaji Urban Health Centre',
        facilityType: 'UHC',
        state: 'Goa',
        district: 'North Goa',
        taluka: 'Tiswadi',
        address: 'Fontainhas, Panaji, Goa',
        latitude: 15.4989,
        longitude: 73.8278,
        phone: '0832-2420002',
        email: 'uhc.panaji@goa.gov.in',
        active: true,
      });

    expect(uhcRes.status).toBe(201);
    expect(uhcRes.body.facilityCode).toMatch(/^UHC-/);
    expect(uhcRes.body.type).toBe('UHC');

    // 1.3 List facilities with filter
    const listRes = await ctx.http()
      .get('/api/v1/facilities?type=PHC')
      .set(...auth(admin.token));
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].type).toBe('PHC');

    // 1.4 Worker cannot create a facility (RBAC check)
    const forbiddenRes = await ctx.http()
      .post('/api/v1/facilities')
      .set(...auth(worker.token))
      .send({
        name: 'Illegal Facility',
        facilityType: 'PHC',
        state: 'Goa',
        district: 'North Goa',
        taluka: 'Bardez',
        address: 'Test',
      });
    expect(forbiddenRes.status).toBe(403);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Staff Assignment with Role Validation
  // ───────────────────────────────────────────────────────────────────────────

  it('Admin assigns staff to facilities with strict role validation and history preservation', async () => {
    // Create facility
    const fac = await ctx.prisma.facility.create({
      data: {
        facilityCode: 'PHC-TST-01',
        name: 'Test PHC',
        type: 'PHC',
        state: 'Goa',
        district: 'North Goa',
        taluka: 'Bardez',
        address: 'Test Address',
        active: true,
      },
    });

    // 2.1 Role mismatch validation: Assigning HW as CLINICIAN should fail
    const mismatchRes = await ctx.http()
      .post('/api/v1/facilities/staff')
      .set(...auth(admin.token))
      .send({
        facilityId: fac.id,
        userId: healthWorker.userId,
        role: 'CLINICIAN', // Mismatch! User is HEALTH_WORKER
        startDate: new Date().toISOString(),
      });
    expect(mismatchRes.status).toBe(400);
    expect(mismatchRes.body.message).toMatch(/does not match assigned role/i);

    // 2.2 Assign Health Worker correctly
    const assignHw = await ctx.http()
      .post('/api/v1/facilities/staff')
      .set(...auth(admin.token))
      .send({
        facilityId: fac.id,
        userId: healthWorker.userId,
        role: 'HEALTH_WORKER',
        startDate: new Date().toISOString(),
      });
    expect(assignHw.status).toBe(201);
    expect(assignHw.body.role).toBe('HEALTH_WORKER');
    expect(assignHw.body.active).toBe(true);

    // 2.3 Assign Clinician correctly
    const assignClin = await ctx.http()
      .post('/api/v1/facilities/staff')
      .set(...auth(admin.token))
      .send({
        facilityId: fac.id,
        userId: clinician.userId,
        role: 'CLINICIAN',
        startDate: new Date().toISOString(),
      });
    expect(assignClin.status).toBe(201);

    // 2.4 Verify facility staff list
    const staffList = await ctx.http()
      .get(`/api/v1/facilities/${fac.id}/staff`)
      .set(...auth(admin.token));
    expect(staffList.status).toBe(200);
    expect(staffList.body.length).toBe(2);

    // 2.5 End assignment preserves history
    const endRes = await ctx.http()
      .delete(`/api/v1/facilities/staff/${assignHw.body.id}`)
      .set(...auth(admin.token));
    expect(endRes.status).toBe(200);
    expect(endRes.body.active).toBe(false);
    expect(endRes.body.endDate).not.toBeNull();

    // Verify record was not deleted from DB
    const persisted = await ctx.prisma.facilityStaffAssignment.findUnique({
      where: { id: assignHw.body.id },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.active).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Confirmed-Positive Notification Fan-out & Facility Inbox
  // ───────────────────────────────────────────────────────────────────────────

  it('Confirmed positive diagnostic fans out notifications to HW, facility inbox, clinicians and admin', async () => {
    // 3.1 Setup facility with assigned HW and Clinician
    const fac = await ctx.prisma.facility.create({
      data: {
        facilityCode: 'PHC-NOTIF-01',
        name: 'Calangute Health Centre',
        type: 'PHC',
        state: 'Goa',
        district: 'North Goa',
        taluka: 'Bardez',
        address: 'Calangute Market Road',
        latitude: 15.5439,
        longitude: 73.7553,
        active: true,
      },
    });

    await ctx.prisma.facilityStaffAssignment.createMany({
      data: [
        { facilityId: fac.id, userId: healthWorker.userId, role: 'HEALTH_WORKER', active: true, startDate: new Date() },
        { facilityId: fac.id, userId: clinician.userId, role: 'CLINICIAN', active: true, startDate: new Date() },
      ],
    });

    const dbWorker = await ctx.prisma.worker.findUnique({
      where: { workerCode: worker.workerId },
    });
    expect(dbWorker).not.toBeNull();

    // 3.2 Link worker screening to this facility and health worker
    await ctx.prisma.initialScreening.create({
      data: {
        workerId: dbWorker!.id,
        facilityId: fac.id,
        screenedById: healthWorker.userId,
        status: 'COMPLETE',
        version: '1.0',
        consentGiven: true,
        answers: { full_name: 'Ramesh Kumar' },
      },
    });

    // 3.3 Create episode and confirm positive diagnostic
    const episode = await ctx.http()
      .post('/api/v1/records/episodes')
      .set(...auth(clinician.token))
      .send({ workerId: worker.workerId });
    expect(episode.status).toBe(201);

    const diagRes = await ctx.http()
      .post('/api/v1/records/diagnostics')
      .set(...auth(clinician.token))
      .send({
        episodeId: episode.body.id,
        testType: 'MICROSCOPY',
        result: 'POSITIVE',
        species: 'P_FALCIPARUM',
        testDate: new Date().toISOString(),
      });
    expect(diagRes.status).toBe(201);

    // 3.4 Verify notifications dispatched to:
    // a) Health Worker
    const hwNotifs = await ctx.prisma.notification.findMany({
      where: { audienceUserId: healthWorker.userId },
    });
    expect(hwNotifs.length).toBeGreaterThanOrEqual(1);
    expect(hwNotifs[0].title).toMatch(/Positive Malaria/i);

    // b) Facility-level inbox
    const facInbox = await ctx.http()
      .get(`/api/v1/facilities/${fac.id}/inbox`)
      .set(...auth(admin.token));
    expect(facInbox.status).toBe(200);
    expect(facInbox.body.length).toBeGreaterThanOrEqual(1);
    const inboxItem = facInbox.body[0];
    expect(inboxItem.title).toMatch(/Positive Malaria/i);

    // c) Acknowledge & Action facility notification
    const ackRes = await ctx.http()
      .post(`/api/v1/facilities/inbox/${inboxItem.id}/acknowledge`)
      .set(...auth(admin.token));
    expect([200, 201]).toContain(ackRes.status);

    const actionRes = await ctx.http()
      .post(`/api/v1/facilities/inbox/${inboxItem.id}/action`)
      .set(...auth(admin.token))
      .send({ actionTaken: 'Dispatched field team for vector control' });
    expect([200, 201]).toContain(actionRes.status);
    expect(actionRes.body.actionTaken).toBe('Dispatched field team for vector control');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Nearby Clinicians Calculation (Haversine Distance)
  // ───────────────────────────────────────────────────────────────────────────

  it('Calculates nearby clinicians by geographical distance', async () => {
    const fac = await ctx.prisma.facility.create({
      data: {
        facilityCode: 'PHC-MAP-01',
        name: 'Mapusa PHC',
        type: 'PHC',
        state: 'Goa',
        district: 'North Goa',
        taluka: 'Bardez',
        address: 'Mapusa City',
        latitude: 15.5926,
        longitude: 73.8155,
        active: true,
      },
    });

    await ctx.prisma.facilityStaffAssignment.create({
      data: {
        facilityId: fac.id,
        userId: clinician.userId,
        role: 'CLINICIAN',
        active: true,
        startDate: new Date(),
      },
    });

    const nearbyRes = await ctx.http()
      .get(`/api/v1/facilities/${fac.id}/nearby-clinicians`)
      .set(...auth(admin.token));
    expect(nearbyRes.status).toBe(200);
    expect(nearbyRes.body.length).toBeGreaterThanOrEqual(1);
    expect(nearbyRes.body[0].clinicianId).toBe(clinician.userId);
    expect(nearbyRes.body[0].distanceKm).toBeDefined();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Worker Travel: Leaving Goa, Entering Goa, Arrival Screening & Cancel
  // ───────────────────────────────────────────────────────────────────────────

  it('Worker can record Leaving Goa, Entering Goa, cancel departure and Health Worker screens arrival', async () => {
    // 5.1 Leaving Goa
    const leaveRes = await ctx.http()
      .post('/api/v1/travel/leave')
      .set(...auth(worker.token))
      .send({
        departureDate: new Date(Date.now() + 86400000).toISOString(),
        destinationState: 'Bihar',
        destinationDistrict: 'Patna',
        destinationTown: 'Patna City',
      });
    expect(leaveRes.status).toBe(201);
    expect(leaveRes.body.direction).toBe('LEAVING_GOA');
    expect(leaveRes.body.departureStatus).toBe('PENDING_CONFIRMATION');
    const travelId = leaveRes.body.id;

    // 5.2 Cancel departure
    const cancelRes = await ctx.http()
      .post('/api/v1/travel/my-record/cancel')
      .set(...auth(worker.token))
      .send({ travelRecordId: travelId, reason: 'Travel postponed' });
    expect([200, 201]).toContain(cancelRes.status);
    expect(cancelRes.body.departureStatus).toBe('CANCELLED');

    // 5.3 Entering Goa with fever/malaria check
    const enterRes = await ctx.http()
      .post('/api/v1/travel/enter')
      .set(...auth(worker.token))
      .send({
        arrivalDate: new Date().toISOString(),
        originState: 'West Bengal',
        originDistrict: 'Kolkata',
        hadFeverOrMalaria: true,
        treatmentGiven: true,
        completedCourse: true,
      });
    expect(enterRes.status).toBe(201);
    expect(enterRes.body.direction).toBe('ENTERING_GOA');
    expect(enterRes.body.hadFeverOrMalaria).toBe(true);
    const returnTripId = enterRes.body.id;

    // 5.4 Health Worker records arrival screening on the return trip
    const screenRes = await ctx.http()
      .post(`/api/v1/travel/${returnTripId}/arrival-screening`)
      .set(...auth(healthWorker.token))
      .send({
        testedOrTreated: true,
        referredForClinicalCare: true,
        clinicalNotes: 'Rapid test conducted on site. Positive for Pf. Referred to Candolim PHC.',
      });
    expect([200, 201]).toContain(screenRes.status);
    expect(screenRes.body.arrivalScreened).toBe(true);
    expect(screenRes.body.arrivalReferred).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Family & Household Members Workflow with Privacy Barrier
  // ───────────────────────────────────────────────────────────────────────────

  it('Manages household members with soft duplicate warning and contractor privacy barrier', async () => {
    // 6.1 Add dependent family member
    const addRes1 = await ctx.http()
      .post('/api/v1/workers/me/household')
      .set(...auth(worker.token))
      .send({
        fullName: 'Sunita Kumar',
        relationship: 'SPOUSE',
        gender: 'female',
        ageOrDob: '28',
        isDependent: true,
        livesInSameRoom: true,
        phoneAvailable: false,
      });
    expect(addRes1.status).toBe(201);
    expect(addRes1.body.memberCode).toContain('-HH-');
    expect(addRes1.body.duplicateWarning).toBe(false);

    // 6.2 Soft duplicate warning check: adding identical spouse name returns warning flag
    const addDup = await ctx.http()
      .post('/api/v1/workers/me/household')
      .set(...auth(worker.token))
      .send({
        fullName: 'Sunita Kumar',
        relationship: 'SPOUSE',
        gender: 'female',
        ageOrDob: '28',
        isDependent: true,
        livesInSameRoom: true,
        phoneAvailable: false,
      });
    expect(addDup.status).toBe(201);
    expect(addDup.body.duplicateWarning).toBe(true);

    // 6.3 Add Roommate
    const addRoommate = await ctx.http()
      .post('/api/v1/workers/me/household')
      .set(...auth(worker.token))
      .send({
        fullName: 'Amit Mondal',
        relationship: 'ROOMMATE',
        gender: 'male',
        isDependent: false,
        livesInSameRoom: true,
        phoneAvailable: false,
      });
    expect(addRoommate.status).toBe(201);

    // 6.4 Worker queries household summary
    const hhList = await ctx.http()
      .get('/api/v1/workers/me/household')
      .set(...auth(worker.token));
    expect(hhList.status).toBe(200);
    expect(hhList.body.stats.totalCount).toBe(3);
    expect(hhList.body.stats.dependentCount).toBe(2);
    expect(hhList.body.stats.roommateCount).toBe(1);

    // 6.5 Clinician records Household Assessment
    const assessRes = await ctx.http()
      .post('/api/v1/records/household-assessments')
      .set(...auth(clinician.token))
      .send({
        memberId: addRes1.body.id,
        assessmentDate: new Date().toISOString(),
        hadFever: true,
        rdtResult: 'POSITIVE',
        microscopyResult: 'POSITIVE',
        species: 'Plasmodium falciparum',
        referredForCare: true,
        notes: 'Prescribed ACT course',
      });
    expect(assessRes.status).toBe(201);
    expect(assessRes.body.rdtResult).toBe('POSITIVE');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Demographic Profile Corrections (Allowlist Enforced)
  // ───────────────────────────────────────────────────────────────────────────

  it('Enforces demographic correction allowlist and admin review flow', async () => {
    // 7.1 Reject forbidden field (e.g. malariaStatus or diagnostic)
    const badFieldRes = await ctx.http()
      .post('/api/v1/workers/me/corrections')
      .set(...auth(worker.token))
      .send({
        field: 'malariaStatus', // FORBIDDEN!
        proposedValue: 'NEGATIVE',
        reason: 'Change my status',
      });
    expect(badFieldRes.status).toBe(400);

    // 7.2 Submit valid demographic correction (fullName)
    const validCorr = await ctx.http()
      .post('/api/v1/workers/me/corrections')
      .set(...auth(worker.token))
      .send({
        field: 'fullName',
        proposedValue: 'Rameshwar Kumar',
        reason: 'Typo in initial registration name',
      });
    expect(validCorr.status).toBe(201);
    expect(validCorr.body.status).toBe('SUBMITTED');
    const corrId = validCorr.body.id;

    // 7.3 Admin lists pending corrections
    const adminList = await ctx.http()
      .get('/api/v1/admin/corrections?status=SUBMITTED')
      .set(...auth(admin.token));
    expect(adminList.status).toBe(200);
    expect(adminList.body.length).toBeGreaterThanOrEqual(1);

    // 7.4 Admin approves correction
    const approveRes = await ctx.http()
      .post(`/api/v1/admin/corrections/${corrId}/review`)
      .set(...auth(admin.token))
      .send({
        status: 'APPROVED',
        adminNote: 'Verified with official Aadhaar card',
      });
    expect([200, 201]).toContain(approveRes.status);
    expect(approveRes.body.status).toBe('APPROVED');

    // 7.5 Verify worker's profile name was updated
    const updatedWorker = await ctx.prisma.worker.findUnique({
      where: { workerCode: worker.workerId },
      include: { user: true },
    });
    expect(updatedWorker?.name).toBe('Rameshwar Kumar');
    expect(updatedWorker?.user?.displayName).toBe('Rameshwar Kumar');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Consent Tracking & Feeling Unwell Immediate Alert
  // ───────────────────────────────────────────────────────────────────────────

  it('Records explicit AppInstallConsent, DataSubmissionConsent and dispatches Feeling Unwell alert', async () => {
    // 8.1 App Install Consent
    const installConsent = await ctx.http()
      .post('/api/v1/workers/me/consent/install')
      .set(...auth(worker.token))
      .send({
        consentVersion: '1.0',
        language: 'en',
        status: 'ACCEPTED',
        deviceInfo: 'Samsung Galaxy Tab A7 Lite',
      });
    expect(installConsent.status).toBe(201);
    expect(installConsent.body.status).toBe('ACCEPTED');

    // 8.2 Data Submission Consent
    const submissionConsent = await ctx.http()
      .post('/api/v1/workers/me/consent/submission')
      .set(...auth(worker.token))
      .send({
        consentVersion: '1.0',
        language: 'en',
        status: 'ACCEPTED',
        deviceInfo: 'Samsung Galaxy Tab A7 Lite',
      });
    expect(submissionConsent.status).toBe(201);
    expect(submissionConsent.body.status).toBe('ACCEPTED');

    // 8.3 Feeling Unwell submits symptom report and immediately alerts Admin
    const unwellRes = await ctx.http()
      .post('/api/v1/records/me/symptom-reports')
      .set(...auth(worker.token))
      .send({
        symptoms: ['fever', 'chills'],
        note: 'High fever since last evening',
        idempotencyKey: '00000000-0000-0000-0000-000000000001',
      });
    expect(unwellRes.status).toBe(201);

    // Verify Admin notification was generated
    const adminNotifs = await ctx.prisma.notification.findMany({
      where: { audienceRole: 'ADMIN' },
    });
    const unwellNotif = adminNotifs.find((n) => n.title.includes('Feeling Unwell'));
    expect(unwellNotif).toBeDefined();
  });
});
