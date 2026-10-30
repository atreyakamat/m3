import { createTestApp, type TestContext } from './setup/test-app';
import { auth, registerWorker } from './setup/fixtures';

describe('Initial screening (e2e)', () => {
  let ctx: TestContext;
  let token: string;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.close(); });
  beforeEach(async () => {
    await ctx.reset();
    ({ token } = await registerWorker(ctx, { name: 'Asha', phone: '9000000010', pin: '1234' }));
  });

  const fullAnswers = { full_name: 'Asha', gender: 'female', mobile_number: '9000000010', fever_today: 'no' };

  it('saves and resumes a draft', async () => {
    const draft = await ctx.http().put('/api/v1/screening/me/draft').set(...auth(token))
      .send({ answers: { full_name: 'Asha' }, consentGiven: false });
    expect(draft.status).toBe(200);
    expect(draft.body.status).toBe('DRAFT');

    const resumed = await ctx.http().get('/api/v1/screening/me').set(...auth(token));
    expect(resumed.body.answers.full_name).toBe('Asha');
    expect(resumed.body.status).toBe('DRAFT');
  });

  it('refuses to complete without consent', async () => {
    const res = await ctx.http().post('/api/v1/screening/me/complete').set(...auth(token))
      .send({ answers: fullAnswers, consentGiven: false });
    expect(res.status).toBe(400);
  });

  it('refuses to complete with missing required fields', async () => {
    const res = await ctx.http().post('/api/v1/screening/me/complete').set(...auth(token))
      .send({ answers: { full_name: 'Asha' }, consentGiven: true });
    expect(res.status).toBe(400);
    expect(res.body.message.missingFieldIds ?? res.body.missingFieldIds).toBeDefined();
  });

  it('completes once and prevents a second initial screening', async () => {
    const first = await ctx.http().post('/api/v1/screening/me/complete').set(...auth(token))
      .send({ answers: fullAnswers, consentGiven: true });
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('COMPLETE');

    const second = await ctx.http().post('/api/v1/screening/me/complete').set(...auth(token))
      .send({ answers: fullAnswers, consentGiven: true });
    expect(second.status).toBe(409);
  });

  it('does not let a completed screening revert to draft', async () => {
    await ctx.http().post('/api/v1/screening/me/complete').set(...auth(token))
      .send({ answers: fullAnswers, consentGiven: true });
    const draft = await ctx.http().put('/api/v1/screening/me/draft').set(...auth(token))
      .send({ answers: fullAnswers, consentGiven: true });
    expect(draft.status).toBe(409);
  });
});
