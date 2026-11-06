import { createTestApp, type TestContext } from './setup/test-app';
import { auth, registerWorker, createContractor, createStaff, createSite } from './setup/fixtures';

describe('Worker Travel Reports & Household Active/Inactive Monitoring (e2e)', () => {
  let ctx: TestContext;
  let workerToken: string;
  let workerId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.reset();
    const w = await registerWorker(ctx, { name: 'Ramesh Worker', phone: '9000000031', pin: '1234' });
    workerToken = w.token;
    workerId = w.workerId;
  });

  describe('Worker Travel Report Submission', () => {
    it('allows a worker to submit a travel report on POST /api/v1/travel/reports', async () => {
      // First, create a travel record via /records/me/travel
      const trRes = await ctx.http()
        .post('/api/v1/records/me/travel')
        .set(...auth(workerToken))
        .send({
          planningTravel: true,
          departureDate: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
          destination: 'Patna',
          state: 'Bihar',
        });
      expect(trRes.status).toBe(201);
      const travelRecordId = trRes.body.id;

      // Submit travel report as WORKER
      const reportRes = await ctx.http()
        .post('/api/v1/travel/reports')
        .set(...auth(workerToken))
        .send({
          travelRecordId,
          comment: 'Visiting family in Bihar for 2 weeks, taking prescribed medicines',
        });

      expect(reportRes.status).toBe(201);
      expect(reportRes.body.id).toBeDefined();
      expect(reportRes.body.travelRecordId).toBe(travelRecordId);

      // Verify worker can view their travel reports via GET /api/v1/travel/reports
      const listReports = await ctx.http()
        .get('/api/v1/travel/reports')
        .set(...auth(workerToken));
      expect(listReports.status).toBe(200);
      expect(Array.isArray(listReports.body)).toBe(true);
      expect(listReports.body.length).toBeGreaterThanOrEqual(1);
      expect(listReports.body[0].reason).toContain('Visiting family in Bihar');
    });

    it('allows a worker to submit a departure with expectedReturnDate and prevents duplicates', async () => {
      const depDate = new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString();
      const returnDate = new Date(Date.now() + 18 * 24 * 3600 * 1000).toISOString();

      const leaveRes = await ctx.http()
        .post('/api/v1/travel/leave')
        .set(...auth(workerToken))
        .send({
          departureDate: depDate,
          destinationState: 'Bihar',
          destinationDistrict: 'Patna',
          expectedReturnDate: returnDate,
          purpose: 'Family wedding',
        });
      expect(leaveRes.status).toBe(201);
      expect(leaveRes.body.id).toBeDefined();
      expect(leaveRes.body.departureStatus).toBe('PENDING_CONFIRMATION');
      expect(leaveRes.body.purpose).toBe('Family wedding');

      // Duplicate submission test: posting identical departure returns existing record without duplicate
      const duplicateRes = await ctx.http()
        .post('/api/v1/travel/leave')
        .set(...auth(workerToken))
        .send({
          departureDate: depDate,
          destinationState: 'Bihar',
          destinationDistrict: 'Patna',
        });
      expect(duplicateRes.status).toBe(201);
      expect(duplicateRes.body.id).toBe(leaveRes.body.id);
    });

    it('allows a worker to view their travel records via GET /api/v1/travel/records', async () => {
      await ctx.http()
        .post('/api/v1/records/me/travel')
        .set(...auth(workerToken))
        .send({
          planningTravel: true,
          departureDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
          destination: 'Kolkata',
          state: 'West Bengal',
        });

      const res = await ctx.http()
        .get('/api/v1/travel/records')
        .set(...auth(workerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].destination).toBe('Kolkata');
    });

    it('allows worker to cancel planned travel and prevents another worker from cancelling it', async () => {
      const trRes = await ctx.http()
        .post('/api/v1/travel/leave')
        .set(...auth(workerToken))
        .send({
          departureDate: new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString(),
          destinationState: 'Jharkhand',
        });
      expect(trRes.status).toBe(201);
      const travelId = trRes.body.id;

      // Another worker tries to cancel this travel record -> Forbidden
      const w2 = await registerWorker(ctx, { name: 'Other Worker', phone: '9000000032', pin: '1234' });
      const unauthCancel = await ctx.http()
        .post('/api/v1/travel/my-record/cancel')
        .set(...auth(w2.token))
        .send({ travelRecordId: travelId, reason: 'Malicious cancellation' });
      expect(unauthCancel.status).toBe(403);

      // Authorized worker cancels own journey
      const cancelRes = await ctx.http()
        .post('/api/v1/travel/my-record/cancel')
        .set(...auth(workerToken))
        .send({ travelRecordId: travelId, reason: 'Trip rescheduled' });
      expect(cancelRes.status).toBe(201);
      expect(cancelRes.body.cancelled).toBe(true);

      // Verify record is preserved with CANCELLED status
      const records = await ctx.http()
        .get('/api/v1/travel/records')
        .set(...auth(workerToken));
      const record = records.body.find((r: any) => r.id === travelId);
      expect(record).toBeDefined();
      expect(record.status).toBe('CANCELLED');
      expect(record.departureStatus).toBe('CANCELLED');
    });
  });

  describe('Household Member Active/Inactive Status & Continuous Monitoring', () => {
    it('allows toggling household member active status and retains member for continuous monitoring', async () => {
      // 1. Add household member
      const addRes = await ctx.http()
        .post('/api/v1/workers/me/household')
        .set(...auth(workerToken))
        .send({
          fullName: 'Geeta Devi',
          relationship: 'SPOUSE',
          gender: 'female',
          ageYears: 27,
          isDependent: true,
        });
      expect(addRes.status).toBe(201);
      const memberId = addRes.body.id;
      expect(addRes.body.active).toBe(true);

      // 2. Initial stats check
      const initialGet = await ctx.http()
        .get('/api/v1/workers/me/household')
        .set(...auth(workerToken));
      expect(initialGet.status).toBe(200);
      expect(initialGet.body.stats.activeCount).toBe(1);
      expect(initialGet.body.stats.inactiveCount).toBe(0);

      // 3. Deactivate household member (e.g. temporarily moved away or left site)
      const updateRes = await ctx.http()
        .put(`/api/v1/workers/me/household/${memberId}`)
        .set(...auth(workerToken))
        .send({
          active: false,
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.active).toBe(false);

      // 4. Verify inactive member is STILL returned in household list (continuous surveillance monitoring)
      const afterDeact = await ctx.http()
        .get('/api/v1/workers/me/household')
        .set(...auth(workerToken));
      expect(afterDeact.status).toBe(200);
      expect(afterDeact.body.members.length).toBe(1);
      expect(afterDeact.body.members[0].id).toBe(memberId);
      expect(afterDeact.body.members[0].active).toBe(false);
      expect(afterDeact.body.stats.totalCount).toBe(1);
      expect(afterDeact.body.stats.activeCount).toBe(0);
      expect(afterDeact.body.stats.inactiveCount).toBe(1);

      // 5. Reactivate member
      const reactivateRes = await ctx.http()
        .put(`/api/v1/workers/me/household/${memberId}`)
        .set(...auth(workerToken))
        .send({
          active: true,
        });
      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.active).toBe(true);

      const afterReactivate = await ctx.http()
        .get('/api/v1/workers/me/household')
        .set(...auth(workerToken));
      expect(afterReactivate.body.stats.activeCount).toBe(1);
      expect(afterReactivate.body.stats.inactiveCount).toBe(0);
    });

    it('enforces privacy rules: contractor cannot access household endpoints or clinical data', async () => {
      // 1. Worker adds household member
      const addRes = await ctx.http()
        .post('/api/v1/workers/me/household')
        .set(...auth(workerToken))
        .send({
          fullName: 'Pooja Devi',
          relationship: 'CHILD',
          gender: 'female',
          ageYears: 6,
          isDependent: true,
        });
      expect(addRes.status).toBe(201);
      const memberId = addRes.body.id;

      // 2. Create contractor
      const contractor = await createContractor(ctx, { name: 'Goa Builders', username: '9876543210' });

      // 3. Contractor tries to access worker household endpoints -> 403 Forbidden
      const contrHhRes = await ctx.http()
        .get('/api/v1/workers/me/household')
        .set(...auth(contractor.token));
      expect(contrHhRes.status).toBe(403);

      const contrHhPut = await ctx.http()
        .put(`/api/v1/workers/me/household/${memberId}`)
        .set(...auth(contractor.token))
        .send({ active: false });
      expect(contrHhPut.status).toBe(403);

      // 4. Contractor tries to access health worker household members endpoint -> 403 Forbidden
      const contrHwRes = await ctx.http()
        .get(`/api/v1/health-worker/household-members/${memberId}`)
        .set(...auth(contractor.token));
      expect(contrHwRes.status).toBe(403);
    });

    it('allows Health Worker to view household member, see active status, and update status', async () => {
      // 1. Worker adds member
      const addRes = await ctx.http()
        .post('/api/v1/workers/me/household')
        .set(...auth(workerToken))
        .send({
          fullName: 'Mohan Kumar',
          relationship: 'SIBLING',
          gender: 'male',
          ageYears: 22,
          isDependent: false,
        });
      expect(addRes.status).toBe(201);
      const memberId = addRes.body.id;

      // 2. Create Health Worker
      const hw = await createStaff(ctx, { role: 'HEALTH_WORKER', username: 'hw_sunita' });

      // 3. Health Worker gets household member details
      const hwGet = await ctx.http()
        .get(`/api/v1/health-worker/household-members/${memberId}`)
        .set(...auth(hw.token));
      expect(hwGet.status).toBe(200);
      expect(hwGet.body.fullName).toBe('Mohan Kumar');
      expect(hwGet.body.active).toBe(true);

      // 4. Health Worker updates status to inactive
      const hwPatch = await ctx.http()
        .patch(`/api/v1/health-worker/household-members/${memberId}/status`)
        .set(...auth(hw.token))
        .send({ active: false });
      expect(hwPatch.status).toBe(200);
      expect(hwPatch.body.active).toBe(false);

      // 5. Worker checks household: member is inactive
      const workerCheck = await ctx.http()
        .get('/api/v1/workers/me/household')
        .set(...auth(workerToken));
      expect(workerCheck.body.members[0].active).toBe(false);
      expect(workerCheck.body.stats.inactiveCount).toBe(1);
    });
  });
});
