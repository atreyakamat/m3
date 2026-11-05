import { createTestApp, type TestContext } from './setup/test-app';
import { auth, registerWorker } from './setup/fixtures';

describe('Feeling Unwell Notification Privacy & Deduplication (e2e)', () => {
  let ctx: TestContext;
  let workerToken: string;
  let workerCode: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.reset();
    const workerRes = await registerWorker(ctx, { name: 'Sunil Unwell', phone: '9000000031', pin: '1234' });
    workerToken = workerRes.token;
    workerCode = workerRes.workerId;
  });

  it('enforces notification privacy: does not expose cleartext symptoms in notification body', async () => {
    const res = await ctx.http().post('/api/v1/records/me/symptom-reports').set(...auth(workerToken))
      .send({
        symptoms: ['fever', 'severe_headache', 'vomiting'],
        note: 'High temperature since morning',
      });
    expect(res.status).toBe(201);

    const notif = await ctx.prisma.notification.findFirst({
      where: { type: 'WORKER_FEELING_UNWELL' },
      orderBy: { createdAt: 'desc' },
    });
    expect(notif).toBeDefined();
    // Notification body must NOT contain sensitive clinical symptoms
    expect(notif?.body).not.toContain('severe_headache');
    expect(notif?.body).not.toContain('vomiting');
    expect(notif?.body).toContain('review');
  });

  it('suppresses duplicate alert when identical report submitted within 2 hours', async () => {
    // Report 1: First report
    const res1 = await ctx.http().post('/api/v1/records/me/symptom-reports').set(...auth(workerToken))
      .send({ symptoms: ['headache'] });
    expect(res1.status).toBe(201);

    const count1 = await ctx.prisma.notification.count({ where: { type: 'WORKER_FEELING_UNWELL' } });
    expect(count1).toBe(1);

    // Report 2: Repeated identical report within 2 hours
    const res2 = await ctx.http().post('/api/v1/records/me/symptom-reports').set(...auth(workerToken))
      .send({ symptoms: ['headache'] });
    expect(res2.status).toBe(201);

    // Should NOT create a second duplicate notification
    const count2 = await ctx.prisma.notification.count({ where: { type: 'WORKER_FEELING_UNWELL' } });
    expect(count2).toBe(1);
  });

  it('dispatches new notification when new or worsening symptoms are reported within 2 hours', async () => {
    // Report 1: headache only
    await ctx.http().post('/api/v1/records/me/symptom-reports').set(...auth(workerToken))
      .send({ symptoms: ['headache'] });

    const count1 = await ctx.prisma.notification.count({ where: { type: 'WORKER_FEELING_UNWELL' } });
    expect(count1).toBe(1);

    // Report 2: worsening symptoms (fever and chills added)
    await ctx.http().post('/api/v1/records/me/symptom-reports').set(...auth(workerToken))
      .send({ symptoms: ['headache', 'fever', 'chills'] });

    // Should create a second notification because symptoms worsened
    const count2 = await ctx.prisma.notification.count({ where: { type: 'WORKER_FEELING_UNWELL' } });
    expect(count2).toBe(2);
  });

  it('dispatches new notification when report submitted after 2 hours', async () => {
    // Report 1: backdated to 2.5 hours ago
    const worker = await ctx.prisma.worker.findFirst({ where: { phone: '9000000031' } });
    const oldReport = await ctx.prisma.symptomReport.create({
      data: {
        workerId: worker!.id,
        symptoms: ['chills'],
        createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
      },
    });
    await ctx.prisma.notification.create({
      data: {
        title: 'Worker Reported Feeling Unwell',
        body: 'Worker submitted a symptom report requiring health worker review.',
        type: 'WORKER_FEELING_UNWELL',
        dedupeKey: `unwell:${oldReport.id}:admin`,
        createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
      },
    });

    const countBefore = await ctx.prisma.notification.count({ where: { type: 'WORKER_FEELING_UNWELL' } });
    expect(countBefore).toBe(1);

    // Report 2: New report after 2 hours
    await ctx.http().post('/api/v1/records/me/symptom-reports').set(...auth(workerToken))
      .send({ symptoms: ['chills'] });

    const countAfter = await ctx.prisma.notification.count({ where: { type: 'WORKER_FEELING_UNWELL' } });
    expect(countAfter).toBe(2);
  });
});
