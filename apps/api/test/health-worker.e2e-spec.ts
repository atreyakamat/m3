import { createTestApp, type TestContext } from './setup/test-app';
import { auth, registerWorker } from './setup/fixtures';
import { Role, FacilityType, TestType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

describe('Health Worker Module (e2e)', () => {
  let ctx: TestContext;
  let admin: { token: string; userId: string };
  let healthWorker: { token: string; mobileToken: string; userId: string; staffCode: string };
  let clinician: { token: string; userId: string };
  let facilityA: { id: string; facilityCode: string; name: string };
  let facilityB: { id: string; facilityCode: string; name: string };
  let worker: { token: string; workerId: string; workerCode: string; id: string; phone: string };

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
        role: Role.ADMIN,
        username: 'admin.hw',
        displayName: 'Platform Admin',
        passwordHash: await bcrypt.hash('password123', 10),
      },
    });
    const adminLogin = await ctx.http()
      .post('/api/v1/auth/staff/login')
      .send({ username: 'admin.hw', password: 'password123' });
    admin = { token: adminLogin.body.token, userId: adminUser.id };

    // 2. Create Facilities
    const facARes = await ctx.http()
      .post('/api/v1/facilities')
      .set(...auth(admin.token))
      .send({
        facilityCode: 'PHC-CAN-01',
        name: 'Candolim Primary Health Centre',
        type: FacilityType.PHC,
        state: 'Goa',
        district: 'North Goa',
        taluka: 'Bardez',
        contactPhone: '9822110011',
      });
    facilityA = facARes.body;

    const facBRes = await ctx.http()
      .post('/api/v1/facilities')
      .set(...auth(admin.token))
      .send({
        facilityCode: 'UHC-PAN-01',
        name: 'Panaji Urban Health Centre',
        type: FacilityType.UHC,
        state: 'Goa',
        district: 'North Goa',
        taluka: 'Tiswadi',
        contactPhone: '9822110022',
      });
    facilityB = facBRes.body;

    // 3. Create Health Worker with stakeholder staff code
    const hwUser = await ctx.prisma.user.create({
      data: {
        role: Role.HEALTH_WORKER,
        username: 'hw.priya',
        displayName: 'HW Priya Sharma',
        phone: '9822334455',
        stakeholderCode: 'HW000001',
        passwordHash: await bcrypt.hash('password123', 10),
        active: true,
      },
    });

    // Assign Health Worker to Facility A
    await ctx.http()
      .post('/api/v1/facilities/staff')
      .set(...auth(admin.token))
      .send({
        facilityId: facilityA.id,
        userId: hwUser.id,
        role: Role.HEALTH_WORKER,
      });

    // Health Worker web login
    const hwLoginWeb = await ctx.http()
      .post('/api/v1/auth/staff/login')
      .send({ username: 'hw.priya', password: 'password123' });

    // Health Worker mobile login
    const hwLoginMob = await ctx.http()
      .post('/api/v1/auth/login')
      .send({ phone: '9822334455', pin: 'password123' });

    healthWorker = {
      token: hwLoginWeb.body.token,
      mobileToken: hwLoginMob.body.token,
      userId: hwUser.id,
      staffCode: 'HW000001',
    };

    // 4. Create Clinician assigned to Facility A
    const clinUser = await ctx.prisma.user.create({
      data: {
        role: Role.CLINICIAN,
        username: 'dr.desai',
        displayName: 'Dr. Ramesh Desai',
        phone: '9822998877',
        stakeholderCode: 'CL000001',
        passwordHash: await bcrypt.hash('password123', 10),
        active: true,
      },
    });
    await ctx.http()
      .post('/api/v1/facilities/staff')
      .set(...auth(admin.token))
      .send({
        facilityId: facilityA.id,
        userId: clinUser.id,
        role: Role.CLINICIAN,
      });
    const clinLogin = await ctx.http()
      .post('/api/v1/auth/staff/login')
      .send({ username: 'dr.desai', password: 'password123' });
    clinician = { token: clinLogin.body.token, userId: clinUser.id };

    // 5. Register a worker
    const workerRes = await registerWorker(ctx, {
      name: 'Ramesh Patel',
      phone: '9822112233',
      pin: '1234',
    });
    const dbWorker = await ctx.prisma.worker.findUniqueOrThrow({
      where: { phone: '9822112233' },
    });
    worker = {
      token: workerRes.token,
      workerId: dbWorker.id,
      workerCode: dbWorker.workerCode,
      id: dbWorker.id,
      phone: '9822112233',
    };
  });

  describe('1. Health Worker Authentication & Profile', () => {
    it('authenticates Health Worker on both web and mobile platforms', () => {
      expect(healthWorker.token).toBeTruthy();
      expect(healthWorker.mobileToken).toBeTruthy();
    });

    it('returns Health Worker profile, staff code, and assigned facilities', async () => {
      const res = await ctx.http()
        .get('/api/v1/health-worker/me')
        .set(...auth(healthWorker.token));

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(healthWorker.userId);
      expect(res.body.staffCode).toBe('HW000001');
      expect(res.body.role).toBe('HEALTH_WORKER');
      expect(res.body.assignedFacilities).toHaveLength(1);
      expect(res.body.assignedFacilities[0].id).toBe(facilityA.id);
      expect(res.body.activeFacility.id).toBe(facilityA.id);
    });

    it('allows Health Worker to select active facility when authorized for multiple', async () => {
      // Admin assigns Health Worker to Facility B as well
      await ctx.http()
        .post('/api/v1/facilities/staff')
        .set(...auth(admin.token))
        .send({
          facilityId: facilityB.id,
          userId: healthWorker.userId,
          role: Role.HEALTH_WORKER,
        });

      // Switch active facility to Facility B
      const switchRes = await ctx.http()
        .post('/api/v1/health-worker/active-facility')
        .set(...auth(healthWorker.token))
        .send({ facilityId: facilityB.id });

      expect(switchRes.status).toBe(200);
      expect(switchRes.body.activeFacility.id).toBe(facilityB.id);

      // Verify profile reflects Facility B
      const meRes = await ctx.http()
        .get('/api/v1/health-worker/me')
        .set(...auth(healthWorker.token));
      expect(meRes.body.activeFacility.id).toBe(facilityB.id);
    });

    it('rejects selecting a facility to which the Health Worker is NOT assigned', async () => {
      const fakeFacilityId = '99999999-9999-4999-8999-999999999999';
      const res = await ctx.http()
        .post('/api/v1/health-worker/active-facility')
        .set(...auth(healthWorker.token))
        .send({ facilityId: fakeFacilityId });

      expect(res.status).toBe(403);
    });
  });

  describe('2. Health Worker Dashboard Statistics', () => {
    it('returns facility-scoped metrics with zero leakage to unassigned facilities', async () => {
      const res = await ctx.http()
        .get(`/api/v1/health-worker/dashboard?facilityId=${facilityA.id}`)
        .set(...auth(healthWorker.token));

      expect(res.status).toBe(200);
      expect(res.body.facility.id).toBe(facilityA.id);
      expect(res.body).toHaveProperty('totalAssignedWorkers');
      expect(res.body).toHaveProperty('awaitingScreening');
      expect(res.body).toHaveProperty('screenedCount');
      expect(res.body).toHaveProperty('suspectedCases');
      expect(res.body).toHaveProperty('confirmedPositiveCases');
      expect(res.body).toHaveProperty('confirmedNegativeCases');
      expect(res.body).toHaveProperty('pendingFollowUps');
      expect(res.body).toHaveProperty('newTravelArrivals');
      expect(res.body).toHaveProperty('newFeelingUnwellReports');
    });

    it('blocks access to dashboard of an unassigned facility', async () => {
      const res = await ctx.http()
        .get(`/api/v1/health-worker/dashboard?facilityId=${facilityB.id}`)
        .set(...auth(healthWorker.token));

      expect(res.status).toBe(403);
    });
  });

  describe('3. Worker and Household Search', () => {
    it('finds worker by workerCode, name, or phone', async () => {
      // Search by phone
      const resPhone = await ctx.http()
        .get(`/api/v1/health-worker/search?q=9822112233&facilityId=${facilityA.id}`)
        .set(...auth(healthWorker.token));

      expect(resPhone.status).toBe(200);
      expect(resPhone.body.workers).toHaveLength(1);
      expect(resPhone.body.workers[0].workerCode).toBe(worker.workerCode);

      // Search by name
      const resName = await ctx.http()
        .get(`/api/v1/health-worker/search?q=Ramesh&facilityId=${facilityA.id}`)
        .set(...auth(healthWorker.token));

      expect(resName.status).toBe(200);
      expect(resName.body.workers).toHaveLength(1);
      expect(resName.body.workers[0].name).toBe('Ramesh Patel');

      // Search by workerCode
      const resCode = await ctx.http()
        .get(`/api/v1/health-worker/search?q=${worker.workerCode}&facilityId=${facilityA.id}`)
        .set(...auth(healthWorker.token));

      expect(resCode.status).toBe(200);
      expect(resCode.body.workers).toHaveLength(1);
    });

    it('finds household member by memberCode and lists associated family', async () => {
      // Create household member for worker
      const hh = await ctx.prisma.householdMember.create({
        data: {
          memberCode: `HH-${worker.workerCode}-01`,
          workerId: worker.id,
          fullName: 'Geeta Patel',
          relationship: 'SPOUSE',
          ageOrDob: '26',
          gender: 'female',
          isDependent: true,
        },
      });

      const res = await ctx.http()
        .get(`/api/v1/health-worker/search?q=Geeta&facilityId=${facilityA.id}`)
        .set(...auth(healthWorker.token));

      expect(res.status).toBe(200);
      expect(res.body.householdMembers).toHaveLength(1);
      expect(res.body.householdMembers[0].memberCode).toBe(hh.memberCode);
      expect(res.body.householdMembers[0].primaryWorker.workerCode).toBe(worker.workerCode);
    });

    it('retrieves comprehensive worker record with clinical & travel history', async () => {
      const res = await ctx.http()
        .get(`/api/v1/health-worker/workers/${worker.id}`)
        .set(...auth(healthWorker.token));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(worker.id);
      expect(res.body.workerCode).toBe(worker.workerCode);
      expect(res.body).toHaveProperty('episodes');
      expect(res.body).toHaveProperty('travelRecords');
      expect(res.body).toHaveProperty('householdMembers');
    });
  });

  describe('4. Screening Workflow (Worker & Household Member)', () => {
    it('records worker initial screening retaining facility and health worker attribution', async () => {
      const screeningAnswers = {
        full_name: 'Ramesh Patel',
        gender: 'male',
        date_of_birth: '1995-05-15',
        fever_today: 'no',
      };

      const res = await ctx.http()
        .post('/api/v1/health-worker/screening')
        .set(...auth(healthWorker.token))
        .send({
          workerId: worker.id,
          facilityId: facilityA.id,
          answers: screeningAnswers,
          clinicalObservations: 'Healthy male, afebrile, pulse 72 bpm.',
          isAssisted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('COMPLETE');
      expect(res.body.facilityId).toBe(facilityA.id);
      expect(res.body.screenedById).toBe(healthWorker.userId);

      // Verify in DB that original questionnaire attribution is retained
      const dbScreening = await ctx.prisma.initialScreening.findUniqueOrThrow({
        where: { workerId: worker.id },
      });
      expect(dbScreening.facilityId).toBe(facilityA.id);
      expect(dbScreening.screenedById).toBe(healthWorker.userId);
    });

    it('screens a registered household member and creates HouseholdAssessment', async () => {
      const hh = await ctx.prisma.householdMember.create({
        data: {
          memberCode: `HH-${worker.workerCode}-02`,
          workerId: worker.id,
          fullName: 'Aakash Patel',
          relationship: 'CHILD',
          ageOrDob: '6',
          gender: 'male',
          isDependent: true,
        },
      });

      const res = await ctx.http()
        .post('/api/v1/health-worker/household-screening')
        .set(...auth(healthWorker.token))
        .send({
          memberId: hh.id,
          facilityId: facilityA.id,
          symptoms: ['fever'],
          clinicalHistory: 'Fever for 2 days, poor appetite.',
          examinationFindings: 'Temp 101F, no rash.',
          testRequested: true,
          testType: TestType.RDT,
          referralInfo: 'Referred to Candolim PHC outpatient clinic.',
        });

      expect(res.status).toBe(201);
      expect(res.body.memberId).toBe(hh.id);
      expect(res.body.testRequested).toBe(true);

      // Verify separate household assessment record
      const dbAssessment = await ctx.prisma.householdAssessment.findFirst({
        where: { memberId: hh.id },
      });
      expect(dbAssessment).toBeTruthy();
      expect(dbAssessment?.clinicianId).toBe(healthWorker.userId);
    });
  });

  describe('5. Suspected Malaria Cases, Test Requests & Role Boundaries', () => {
    let episodeId: string;

    it('records a suspected malaria case opening an episode with status SUSPECTED', async () => {
      const res = await ctx.http()
        .post('/api/v1/health-worker/cases')
        .set(...auth(healthWorker.token))
        .send({
          workerId: worker.id,
          facilityId: facilityA.id,
          onsetDate: '2026-11-04',
          symptoms: ['fever', 'chills', 'body_ache'],
          clinicalObservations: 'Oral temperature 102.4F, severe chills reported.',
          notes: 'Suspected P. vivax case in high-risk taluka.',
        });

      expect(res.status).toBe(201);
      expect(res.body.workerId).toBe(worker.id);
      expect(res.body.status).toBe('SUSPECTED');
      episodeId = res.body.id;
    });

    it('initiates diagnostic test request (RDT) for the suspected case', async () => {
      const caseRes = await ctx.http()
        .post('/api/v1/health-worker/cases')
        .set(...auth(healthWorker.token))
        .send({
          workerId: worker.id,
          facilityId: facilityA.id,
          onsetDate: '2026-11-04',
          symptoms: ['fever', 'chills'],
        });
      const targetEpisodeId = caseRes.body.id;

      const res = await ctx.http()
        .post('/api/v1/health-worker/test-requests')
        .set(...auth(healthWorker.token))
        .send({
          episodeId: targetEpisodeId,
          workerId: worker.id,
          facilityId: facilityA.id,
          testType: TestType.RDT,
          sampleDetails: 'Capillary blood collected at field site.',
        });

      expect(res.status).toBe(201);
      expect(res.body.episodeId).toBe(targetEpisodeId);
      expect(res.body.testType).toBe('RDT');
    });

    it('strictly PREVENTS Health Worker from recording a confirmed diagnostic result (HTTP 403)', async () => {
      const ep = await ctx.prisma.malariaEpisode.create({
        data: { workerId: worker.id, status: 'SUSPECTED' },
      });

      const res = await ctx.http()
        .post('/api/v1/records/diagnostics')
        .set(...auth(healthWorker.token))
        .send({
          episodeId: ep.id,
          testType: 'RDT',
          result: 'POSITIVE',
          species: 'P_VIVAX',
          testDate: new Date().toISOString(),
        });

      expect(res.status).toBe(403);
    });

    it('allows authorized Clinician/Pathologist to confirm POSITIVE result and triggers fan-out notifications', async () => {
      // 1. Create episode
      const ep = await ctx.prisma.malariaEpisode.create({
        data: { workerId: worker.id, status: 'SUSPECTED' },
      });

      // 2. Ensure worker has screening record with facilityA and healthWorker attribution
      await ctx.prisma.initialScreening.upsert({
        where: { workerId: worker.id },
        update: { facilityId: facilityA.id, screenedById: healthWorker.userId },
        create: {
          workerId: worker.id,
          facilityId: facilityA.id,
          screenedById: healthWorker.userId,
          status: 'COMPLETE',
          version: '1.0',
          consentGiven: true,
          answers: {},
        },
      });

      // 3. Clinician records confirmed POSITIVE result
      const res = await ctx.http()
        .post('/api/v1/records/diagnostics')
        .set(...auth(clinician.token))
        .send({
          episodeId: ep.id,
          testType: 'RDT',
          result: 'POSITIVE',
          species: 'P_VIVAX',
          testDate: new Date().toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.result).toBe('POSITIVE');

      // 3. Verify notification fan-out:
      // a) Health Worker who screened received notification
      const hwNotifications = await ctx.prisma.notification.findMany({
        where: { audienceUserId: healthWorker.userId, type: 'POSITIVE_MALARIA_RESULT' },
      });
      expect(hwNotifications.length).toBeGreaterThan(0);

      // b) Facility A inbox received notification
      const facNotifications = await ctx.prisma.notification.findMany({
        where: { audienceFacilityId: facilityA.id, type: 'POSITIVE_MALARIA_RESULT' },
      });
      expect(facNotifications.length).toBeGreaterThan(0);

      // c) Clinician at Facility A received notification
      const clinNotifications = await ctx.prisma.notification.findMany({
        where: { audienceUserId: clinician.userId, type: 'POSITIVE_MALARIA_RESULT' },
      });
      expect(clinNotifications.length).toBeGreaterThan(0);

      // d) Admin received notification
      const adminNotifications = await ctx.prisma.notification.findMany({
        where: { audienceRole: Role.ADMIN, type: 'POSITIVE_MALARIA_RESULT' },
      });
      expect(adminNotifications.length).toBeGreaterThan(0);
    });
  });

  describe('6. Follow-Up and Referral Workflow', () => {
    it('allows Health Worker to record follow-up visit outcome and referral attendance', async () => {
      // 1. Link worker to facilityA via screening
      await ctx.prisma.initialScreening.upsert({
        where: { workerId: worker.id },
        update: { facilityId: facilityA.id, screenedById: healthWorker.userId },
        create: {
          workerId: worker.id,
          facilityId: facilityA.id,
          screenedById: healthWorker.userId,
          status: 'COMPLETE',
          version: '1.0',
          consentGiven: true,
          answers: {},
        },
      });

      const res = await ctx.http()
        .post('/api/v1/health-worker/follow-ups')
        .set(...auth(healthWorker.token))
        .send({
          workerId: worker.id,
          question: 'Day 3 treatment adherence and symptom check',
          response: 'Patient reports fever resolved, taking all prescribed tablets.',
          attendedReferral: true,
          referralFacilityId: facilityA.id,
          note: 'Worker verified taking ACT medication course.',
        });

      expect(res.status).toBe(201);
      expect(res.body.workerId).toBe(worker.id);
      expect(res.body.response).toContain('fever resolved');

      // Check list of follow-ups
      const listRes = await ctx.http()
        .get(`/api/v1/health-worker/follow-ups?facilityId=${facilityA.id}`)
        .set(...auth(healthWorker.token));

      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBeGreaterThan(0);
    });
  });

  describe('7. Travel & Arrival Screening Integration', () => {
    it('lists workers entering Goa and allows Health Worker to complete arrival screening on travel journey', async () => {
      // Create entering travel record for worker
      const travel = await ctx.prisma.travelRecord.create({
        data: {
          workerId: worker.id,
          direction: 'ENTERING_GOA',
          originState: 'Bihar',
          originDistrict: 'Patna',
          hadFeverOrMalaria: true,
          status: 'SUBMITTED',
        },
      });

      // Health Worker lists arrivals
      const arrivalsRes = await ctx.http()
        .get(`/api/v1/health-worker/travel-arrivals?facilityId=${facilityA.id}`)
        .set(...auth(healthWorker.token));

      expect(arrivalsRes.status).toBe(200);
      expect(arrivalsRes.body.some((r: any) => r.id === travel.id)).toBe(true);

      // Health Worker completes arrival screening using existing travel arrival screening endpoint
      const screenRes = await ctx.http()
        .post(`/api/v1/travel/${travel.id}/arrival-screening`)
        .set(...auth(healthWorker.token))
        .send({
          arrivalFacilityId: facilityA.id,
          arrivalFever: true,
          arrivalTestedOrTreated: true,
          arrivalReferred: true,
        });

      expect(screenRes.status).toBe(201);
      expect(screenRes.body.arrivalScreened).toBe(true);

      // Confirm no duplicate travel record was created
      const count = await ctx.prisma.travelRecord.count({ where: { workerId: worker.id } });
      expect(count).toBe(1);
    });
  });

  describe('8. Feeling Unwell Reports Review', () => {
    it('lists feeling unwell reports and allows Health Worker review', async () => {
      const report = await ctx.prisma.symptomReport.create({
        data: {
          workerId: worker.id,
          symptoms: ['chills', 'headache'],
          note: 'Worker feels weak on site.',
        },
      });

      const listRes = await ctx.http()
        .get(`/api/v1/health-worker/symptom-reports?facilityId=${facilityA.id}`)
        .set(...auth(healthWorker.token));

      expect(listRes.status).toBe(200);
      expect(listRes.body.some((r: any) => r.id === report.id)).toBe(true);

      const reviewRes = await ctx.http()
        .post(`/api/v1/health-worker/symptom-reports/${report.id}/review`)
        .set(...auth(healthWorker.token))
        .send({ actionTaken: 'Initiated onsite rapid diagnostic test.' });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.reviewed).toBe(true);
    });
  });

  describe('9. Strict Role-Based Access Control (RBAC)', () => {
    it('blocks Health Worker from Admin-only endpoints (HTTP 403)', async () => {
      const res = await ctx.http()
        .get('/api/v1/admin/users')
        .set(...auth(healthWorker.token));

      expect(res.status).toBe(403);
    });

    it('blocks Health Worker from creating facilities (HTTP 403)', async () => {
      const res = await ctx.http()
        .post('/api/v1/facilities')
        .set(...auth(healthWorker.token))
        .send({
          facilityCode: 'PHC-FAKE-01',
          name: 'Fake PHC',
          type: FacilityType.PHC,
          district: 'North Goa',
          taluka: 'Bardez',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('10. Facility Notification Inbox', () => {
    it('retrieves facility notifications, acknowledges and records action', async () => {
      const notif = await ctx.prisma.notification.create({
        data: {
          audienceFacilityId: facilityA.id,
          type: 'POSITIVE_MALARIA_RESULT',
          title: 'Confirmed Positive Malaria Result at Facility',
          body: 'Worker M3-GOA-0001 tested POSITIVE for malaria (RDT).',
          dedupeKey: `test:pos_diag:${Date.now()}:fac:${facilityA.id}`,
        },
      });

      // 1. List inbox
      const inboxRes = await ctx.http()
        .get(`/api/v1/health-worker/inbox?facilityId=${facilityA.id}`)
        .set(...auth(healthWorker.token));

      expect(inboxRes.status).toBe(200);
      expect(inboxRes.body.facilityId).toBe(facilityA.id);
      expect(inboxRes.body.notifications.some((n: any) => n.id === notif.id)).toBe(true);
      expect(inboxRes.body.unacknowledgedCount).toBeGreaterThanOrEqual(1);

      // 2. Acknowledge
      const ackRes = await ctx.http()
        .post(`/api/v1/health-worker/inbox/${notif.id}/acknowledge`)
        .set(...auth(healthWorker.token));

      expect(ackRes.status).toBe(200);
      expect(ackRes.body.acknowledgedAt).not.toBeNull();

      // 3. Record Action
      const actRes = await ctx.http()
        .post(`/api/v1/health-worker/inbox/${notif.id}/action`)
        .set(...auth(healthWorker.token))
        .send({ actionTaken: 'Dispatched community health worker for home visit.' });

      expect(actRes.status).toBe(200);
      expect(actRes.body.actionTaken).toBe('Dispatched community health worker for home visit.');
      expect(actRes.body.actionTakenById).toBe(healthWorker.userId);
    });
  });
});
