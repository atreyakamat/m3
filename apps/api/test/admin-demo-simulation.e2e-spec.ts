import { createTestApp, type TestContext } from './setup/test-app';
import { auth, createAdmin } from './setup/fixtures';
import { seedGoaHierarchy } from '../prisma/seed-goa';

describe('Admin Setup and Complete Workflow Simulation (e2e)', () => {
  let ctx: TestContext;
  let admin: { token: string; id: string };

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedGoaHierarchy();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.reset();
    admin = await createAdmin(ctx, { username: 'admin.simulation' });
    await seedGoaHierarchy();
  });

  describe('1. Authoritative Goa Geographical Hierarchy', () => {
    it('returns the complete hierarchical tree with 3 official districts and 12 talukas', async () => {
      const res = await ctx.http().get('/api/v1/admin/locations/tree').set(...auth(admin.token));
      expect(res.status).toBe(200);
      expect(res.body.state.name).toBe('Goa');

      // Verify Kushavati is officially recognised with its 4 talukas
      const districtNames = res.body.districts.map((d: { name: string }) => d.name);
      expect(districtNames).toContain('North Goa');
      expect(districtNames).toContain('South Goa');
      expect(districtNames).toContain('Kushavati');

      const kushavati = res.body.districts.find((d: { name: string }) => d.name === 'Kushavati');
      expect(kushavati).toBeDefined();

      const kushavatiTalukas = res.body.talukas.filter((t: { parentId: string }) => t.parentId === kushavati.id);
      const talukaNames = kushavatiTalukas.map((t: { name: string }) => t.name);
      expect(talukaNames).toEqual(expect.arrayContaining(['Quepem', 'Sanguem', 'Canacona', 'Dharbandora']));
      expect(talukaNames.length).toBe(4);

      // Verify cascading area resolution (Curchorem under Quepem)
      const quepem = kushavatiTalukas.find((t: { name: string }) => t.name === 'Quepem');
      const quepemAreas = res.body.areas.filter((a: { parentId: string }) => a.parentId === quepem.id);
      const areaNames = quepemAreas.map((a: { name: string }) => a.name);
      expect(areaNames).toContain('Curchorem');
    });

    it('creates a site using the cascading Goa hierarchy with landmark and contact phone', async () => {
      const treeRes = await ctx.http().get('/api/v1/admin/locations/tree').set(...auth(admin.token));
      const curchorem = treeRes.body.areas.find((a: { name: string }) => a.name === 'Curchorem');
      expect(curchorem).toBeDefined();

      const createRes = await ctx.http().post('/api/v1/admin/sites').set(...auth(admin.token)).send({
        name: 'Zuari Riverfront Complex',
        areaId: curchorem.id,
        address: 'Plot 42, Quepem Industrial Area',
        landmark: 'Near Quepem Municipal Council',
        contactPhone: '9822112233',
      });

      expect(createRes.status).toBe(201);
      expect(createRes.body.siteId).toMatch(/^SITE-/);
      expect(createRes.body.area).toBe('Curchorem');
      expect(createRes.body.taluka).toBe('Quepem');
      expect(createRes.body.district).toBe('Kushavati');
      expect(createRes.body.landmark).toBe('Near Quepem Municipal Council');
      expect(createRes.body.contactPhone).toBe('9822112233');
    });
  });

  describe('2. Contractor Creation, Human-Readable Code, and Temporary PIN', () => {
    it('creates a contractor with C-prefix code and enforces mandatory first-login PIN change', async () => {
      const res = await ctx.http().post('/api/v1/admin/users').set(...auth(admin.token)).send({
        fullName: 'Vikram Dempo',
        phone: '9811002201',
        role: 'CONTRACTOR',
        tempPin: '4321',
      });

      expect(res.status).toBe(201);
      expect(res.body.stakeholderId).toMatch(/^C\d{6}$/);
      expect(res.body.mustChangeCredential).toBe(true);

      // Contractor attempts login with temporary PIN
      const loginRes = await ctx.http().post('/api/v1/auth/login').send({
        phone: '9811002201',
        pin: '4321',
      });
      expect(loginRes.status).toBe(201);
      expect(loginRes.body.credentialChangeRequired).toBe(true);

      // First-login PIN change
      const changeRes = await ctx.http().post('/api/v1/auth/change-credential').set(...auth(loginRes.body.token)).send({
        newCredential: '9876',
        confirmCredential: '9876',
      });
      expect(changeRes.status).toBe(201);
      expect(changeRes.body.token).toBeDefined();

      // Old PIN is rejected
      const oldLogin = await ctx.http().post('/api/v1/auth/login').send({
        phone: '9811002201',
        pin: '4321',
      });
      expect(oldLogin.status).toBe(401);

      // New PIN is accepted without credentialChangeRequired
      const newLogin = await ctx.http().post('/api/v1/auth/login').send({
        phone: '9811002201',
        pin: '9876',
      });
      expect(newLogin.status).toBe(201);
      expect(newLogin.body.credentialChangeRequired).toBeUndefined();
    });
  });

  describe('3. Demonstration Data Reset and Workflow Isolation', () => {
    it('initializes 10 balanced synthetic workers (5 pos, 5 neg) and demo site', async () => {
      const resetRes = await ctx.http().post('/api/v1/admin/demo-data/reset').set(...auth(admin.token)).send({});
      expect(resetRes.status).toBe(201);
      expect(resetRes.body.contractor).toBeDefined();
      expect(resetRes.body.contractor.phone).toBe('9800000001');
      expect(resetRes.body.contractor.temporaryPinNotice).toBe('1234');

      expect(resetRes.body.site).toBeDefined();
      expect(resetRes.body.site.siteCode).toBe('SITE-DEMO01');
      expect(resetRes.body.site.district).toBe('Kushavati');

      // Verify 10 workers: 5 positive, 5 negative
      expect(resetRes.body.workers.length).toBe(10);
      const positiveCount = resetRes.body.workers.filter((w: { malariaStatus: string }) => w.malariaStatus === 'POSITIVE').length;
      const negativeCount = resetRes.body.workers.filter((w: { malariaStatus: string }) => w.malariaStatus === 'NEGATIVE').length;
      expect(positiveCount).toBe(5);
      expect(negativeCount).toBe(5);

      // Worker 6 has upcoming travel alert (within 7 days)
      const worker6 = resetRes.body.workers.find((w: { phone: string }) => w.phone === '9800000016');
      expect(worker6.hasUpcomingTravel).toBe(true);
      expect(worker6.malariaStatus).toBe('POSITIVE');
    });

    it('contractor sees only POSITIVE, NEGATIVE, or Undisclosed status for assigned workers', async () => {
      // Re-initialize demo data
      await ctx.http().post('/api/v1/admin/demo-data/reset').set(...auth(admin.token)).send({});

      // Log in as Demo Contractor
      const contractorLogin = await ctx.http().post('/api/v1/auth/login').send({
        phone: '9800000001',
        pin: '1234',
      });
      expect(contractorLogin.status).toBe(201);

      // First login change to permanent PIN
      const tokenRes = await ctx.http().post('/api/v1/auth/change-credential').set(...auth(contractorLogin.body.token)).send({
        newCredential: '5566',
        confirmCredential: '5566',
      });
      const contractorToken = tokenRes.body.token;

      // Contractor views assigned site workers
      const workersRes = await ctx.http().get('/api/v1/contractor/sites/SITE-DEMO01/workers').set(...auth(contractorToken));
      expect(workersRes.status).toBe(200);
      expect(workersRes.body.items.length).toBe(10);

      // Verify privacy rules: individual malaria status must be POSITIVE, NEGATIVE, or null (undisclosed)
      for (const w of workersRes.body.items) {
        expect(['POSITIVE', 'NEGATIVE', null]).toContain(w.malariaStatus);
        // Prescriptions, medical history, Aadhaar must NEVER be exposed to contractor
        expect(w.prescriptions).toBeUndefined();
        expect(w.doctorNotes).toBeUndefined();
        expect(w.aadhaar).toBeUndefined();
      }

      // Aggregate statistics show exact counts
      const statsRes = await ctx.http().get('/api/v1/contractor/sites/SITE-DEMO01/stats').set(...auth(contractorToken));
      expect(statsRes.status).toBe(200);
      expect(statsRes.body.totalWorkers).toBe(10);
      expect(statsRes.body.positive).toBe(5);
      expect(statsRes.body.negative).toBe(5);
    });

    it('handles high-risk travel alert and report submission by contractor', async () => {
      await ctx.http().post('/api/v1/admin/demo-data/reset').set(...auth(admin.token)).send({});

      const contractorLogin = await ctx.http().post('/api/v1/auth/login').send({
        phone: '9800000001',
        pin: '1234',
      });
      expect(contractorLogin.status).toBe(201);

      const tokenRes = await ctx.http().post('/api/v1/auth/change-credential').set(...auth(contractorLogin.body.token)).send({
        newCredential: '5566',
        confirmCredential: '5566',
      });
      const contractorToken = tokenRes.body.token;

      // Contractor checks upcoming travels
      const travelRes = await ctx.http().get('/api/v1/contractor/sites/SITE-DEMO01/travels').set(...auth(contractorToken));
      expect(travelRes.status).toBe(200);
      expect(travelRes.body.items.length).toBeGreaterThan(0);

      const highRisk = travelRes.body.items.find((t: { isPositiveWorkerAlert: boolean }) => t.isPositiveWorkerAlert === true);
      expect(highRisk).toBeDefined();
      expect(highRisk.workerName).toBe('Vikas Yadav');

      // Contractor reports the positive-worker travel
      const reportRes = await ctx.http().post('/api/v1/travel/reports').set(...auth(contractorToken)).send({
        workerId: highRisk.workerId,
        travelRecordId: highRisk.travelRecordId,
        comment: 'Worker is currently positive and travelling to Bihar within 3 days. Informed for follow-up.',
      });
      expect(reportRes.status).toBe(201);
      expect(reportRes.body.status).toBe('OPEN');

      // Duplicate report prevented
      const dupRes = await ctx.http().post('/api/v1/travel/reports').set(...auth(contractorToken)).send({
        workerId: highRisk.workerId,
        travelRecordId: highRisk.travelRecordId,
        comment: 'Duplicate report attempt',
      });
      expect(dupRes.status).toBe(409);

      // Admin overview reflects the travel report and correct counts
      const overviewRes = await ctx.http().get('/api/v1/admin/overview').set(...auth(admin.token));
      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.contractors.total).toBeGreaterThanOrEqual(1);
      expect(overviewRes.body.travel.unacknowledgedTravelReports).toBeGreaterThanOrEqual(1);
    });
  });
});
