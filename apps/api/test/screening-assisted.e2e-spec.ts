import { createTestApp, type TestContext } from './setup/test-app';
import { auth, registerWorker } from './setup/fixtures';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

describe('Assisted Initial Screening (e2e)', () => {
  let ctx: TestContext;
  let workerToken: string;
  let workerUser: any;
  let healthWorker: any;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.reset();
    const workerRes = await registerWorker(ctx, { name: 'Low Literacy Worker', phone: '9000000011', pin: '1234' });
    workerToken = workerRes.token;
    workerUser = workerRes.user;

    const passwordHash = await bcrypt.hash('password123', 10);
    healthWorker = await ctx.prisma.user.create({
      data: {
        role: Role.HEALTH_WORKER,
        username: 'sunita_hw',
        displayName: 'Sunita HW',
        phone: '9000000099',
        passwordHash,
        active: true,
      },
    });
  });

  const fullAnswers = {
    full_name: 'Low Literacy Worker',
    gender: 'female',
    mobile_number: '9000000011',
    fever_today: 'no',
  };

  it('records assisted completion with verified Health Worker staff ID', async () => {
    const res = await ctx
      .http()
      .post('/api/v1/screening/me/complete')
      .set(...auth(workerToken))
      .send({
        answers: fullAnswers,
        consentGiven: true,
        isAssisted: true,
        assistedByStaffId: healthWorker.id,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETE');

    // Verify in database: Worker remains the subject, and screenedById is set to healthWorker
    const worker = await ctx.prisma.worker.findFirst({ where: { phone: '9000000011' } });
    const inDb = await ctx.prisma.initialScreening.findUnique({
      where: { workerId: worker!.id },
    });
    expect(inDb).toBeDefined();
    expect(inDb?.screenedById).toBe(healthWorker.id);
    const answers = inDb?.answers as any;
    expect(answers.isAssisted).toBe(true);
    expect(answers.assistedByStaffId).toBe(healthWorker.id);
  });

  it('rejects assisted completion when assistedByStaffId is invalid or non-staff', async () => {
    const res = await ctx
      .http()
      .post('/api/v1/screening/me/complete')
      .set(...auth(workerToken))
      .send({
        answers: fullAnswers,
        consentGiven: true,
        isAssisted: true,
        assistedByStaffId: '00000000-0000-0000-0000-000000000000',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/staff/i);
  });
});
