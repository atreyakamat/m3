import { createTestApp, type TestContext } from './setup/test-app';
import { auth, createStaff, registerWorker } from './setup/fixtures';

describe('Health records (e2e)', () => {
  let ctx: TestContext;
  let worker: { token: string; workerId: string };
  let clinician: { token: string };

  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.close(); });
  beforeEach(async () => {
    await ctx.reset();
    worker = await registerWorker(ctx, { name: 'Asha', phone: '9000000030', pin: '1234' });
    clinician = await createStaff(ctx, { role: 'CLINICIAN', username: 'clin1' });
  });

  it('malaria status is NO_RESULT until an authorized diagnostic exists (never from symptoms)', async () => {
    // Worker submits a symptom report — must NOT change status.
    await ctx.http().post('/api/v1/records/me/symptom-reports').set(...auth(worker.token))
      .send({ symptoms: ['headache'], note: 'tired' });
    let me = await ctx.http().get('/api/v1/workers/me').set(...auth(worker.token));
    expect(me.body.malariaStatus).toBe('NO_RESULT');

    // Clinician opens an episode and records a POSITIVE RDT.
    const ep = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token))
      .send({ workerId: worker.workerId });
    await ctx.http().post('/api/v1/records/diagnostics').set(...auth(clinician.token))
      .send({ episodeId: ep.body.id, testType: 'RDT', result: 'POSITIVE', species: 'P_VIVAX', testDate: '2026-10-20' });

    me = await ctx.http().get('/api/v1/workers/me').set(...auth(worker.token));
    expect(me.body.malariaStatus).toBe('POSITIVE');
  });

  it('a worker cannot create diagnostic results', async () => {
    const ep = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token))
      .send({ workerId: worker.workerId });
    const res = await ctx.http().post('/api/v1/records/diagnostics').set(...auth(worker.token))
      .send({ episodeId: ep.body.id, testType: 'RDT', result: 'NEGATIVE', testDate: '2026-10-20' });
    expect(res.status).toBe(403);
  });

  it('current prescription is latest; history retains all and is never overwritten', async () => {
    const ep = await ctx.http().post('/api/v1/records/episodes').set(...auth(clinician.token))
      .send({ workerId: worker.workerId });
    await ctx.http().post('/api/v1/records/prescriptions').set(...auth(clinician.token))
      .send({ episodeId: ep.body.id, details: 'Chloroquine 3 days' });
    await new Promise((r) => setTimeout(r, 10));
    await ctx.http().post('/api/v1/records/prescriptions').set(...auth(clinician.token))
      .send({ episodeId: ep.body.id, details: 'Primaquine 14 days' });

    const current = await ctx.http().get('/api/v1/records/me/prescriptions/current').set(...auth(worker.token));
    expect(current.body.details).toBe('Primaquine 14 days');

    const history = await ctx.http().get('/api/v1/records/me/prescriptions/history').set(...auth(worker.token));
    expect(history.body.length).toBe(2);
  });

  it('symptom report idempotency: same key does not duplicate', async () => {
    const key = '11111111-1111-1111-1111-111111111111';
    await ctx.http().post('/api/v1/records/me/symptom-reports').set(...auth(worker.token))
      .send({ symptoms: ['fever'], idempotencyKey: key });
    await ctx.http().post('/api/v1/records/me/symptom-reports').set(...auth(worker.token))
      .send({ symptoms: ['fever'], idempotencyKey: key });
    const count = await ctx.prisma.symptomReport.count();
    expect(count).toBe(1);
  });
});
