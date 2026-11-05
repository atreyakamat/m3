import { createTestApp, type TestContext } from './setup/test-app';
import { auth, registerWorker } from './setup/fixtures';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

describe('Household Extended Statistics & Clinical Record Separation (e2e)', () => {
  let ctx: TestContext;
  let workerToken: string;
  let clinicianToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.reset();
    const workerRes = await registerWorker(ctx, { name: 'Worker Head of House', phone: '9000000021', pin: '1234' });
    workerToken = workerRes.token;

    const passwordHash = await bcrypt.hash('password123', 10);
    const clinician = await ctx.prisma.user.create({
      data: {
        role: Role.CLINICIAN,
        username: 'dr_patil',
        displayName: 'Dr. Patil',
        passwordHash,
        active: true,
      },
    });
    const loginRes = await ctx.http().post('/api/v1/auth/staff/login').send({ username: 'dr_patil', password: 'password123' });
    clinicianToken = loginRes.body.token;
  });

  it('computes 7 distinct household statistics and preserves clinical separation from primary worker', async () => {
    // 1. Add Member 1: Spouse (dependent, screened positive)
    const m1Res = await ctx.http().post('/api/v1/workers/me/household').set(...auth(workerToken))
      .send({
        fullName: 'Sunita Devi',
        relationship: 'SPOUSE',
        gender: 'female',
        ageYears: 28,
        isDependent: true,
        isRoommate: false,
      });
    expect(m1Res.status).toBe(201);
    const m1 = m1Res.body;

    // 2. Add Member 2: Roommate (co-located, NOT dependent, screened negative)
    const m2Res = await ctx.http().post('/api/v1/workers/me/household').set(...auth(workerToken))
      .send({
        fullName: 'Manoj Kumar',
        relationship: 'ROOMMATE',
        gender: 'male',
        ageYears: 25,
        isDependent: false,
        isRoommate: true,
      });
    expect(m2Res.status).toBe(201);
    const m2 = m2Res.body;

    // 3. Add Member 3: Child (dependent, awaiting screening)
    const m3Res = await ctx.http().post('/api/v1/workers/me/household').set(...auth(workerToken))
      .send({
        fullName: 'Aarav Kumar',
        relationship: 'CHILD',
        gender: 'male',
        ageYears: 4,
        isDependent: true,
        isRoommate: false,
      });
    expect(m3Res.status).toBe(201);

    // 4. Clinician performs assessment for Member 1 (Positive Vivax)
    const assess1Res = await ctx.http().post('/api/v1/records/household-assessments').set(...auth(clinicianToken))
      .send({
        memberId: m1.id,
        hasFever: true,
        symptoms: ['fever', 'chills'],
        suspectedMalaria: true,
        rdtPerformed: true,
        rdtResult: 'POSITIVE',
        species: 'Plasmodium vivax',
      });
    expect(assess1Res.status).toBe(201);

    // 5. Clinician performs assessment for Member 2 (Negative)
    const assess2Res = await ctx.http().post('/api/v1/records/household-assessments').set(...auth(clinicianToken))
      .send({
        memberId: m2.id,
        hasFever: false,
        symptoms: [],
        suspectedMalaria: false,
        rdtPerformed: true,
        rdtResult: 'NEGATIVE',
      });
    expect(assess2Res.status).toBe(201);

    // 6. Worker queries household list and extended statistics
    const hhRes = await ctx.http().get('/api/v1/workers/me/household').set(...auth(workerToken));
    expect(hhRes.status).toBe(200);

    const stats = hhRes.body.stats;
    expect(stats).toBeDefined();
    expect(stats.totalCount).toBe(3);
    expect(stats.dependentCount).toBe(2); // Spouse and Child, NOT Roommate
    expect(stats.roommateCount).toBe(1); // Manoj Kumar
    expect(stats.screenedCount).toBe(2); // Member 1 and Member 2
    expect(stats.awaitingScreening).toBe(1); // Member 3
    expect(stats.confirmedPositiveCount).toBe(1); // Member 1
    expect(stats.confirmedNegativeCount).toBe(1); // Member 2

    // 7. Verification of clinical separation: Primary Worker profile remains NEGATIVE / unaffected
    const workerProfile = await ctx.http().get('/api/v1/workers/me').set(...auth(workerToken));
    expect(workerProfile.status).toBe(200);
    // Primary worker is not confirmed positive just because a household member was positive
    expect(workerProfile.body.malariaStatus).not.toBe('POSITIVE');
  });
});
