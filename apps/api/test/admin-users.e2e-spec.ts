import { createTestApp, type TestContext } from './setup/test-app';
import { auth, createAdmin, createArea, createContractor, createPendingStakeholder, createSite } from './setup/fixtures';

describe('Admin user management (e2e)', () => {
  let ctx: TestContext;
  let admin: { token: string };

  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.close(); });
  beforeEach(async () => {
    await ctx.reset();
    admin = await createAdmin(ctx, { username: 'a.users' });
  });

  it('creates every provisionable role with the correct unique ID prefix', async () => {
    const cases: Array<[string, RegExp]> = [
      ['CONTRACTOR', /^C\d{6}$/],
      ['HEALTH_WORKER', /^HW\d{6}$/],
      ['CLINICIAN', /^CL\d{6}$/],
      ['PATHOLOGIST', /^P\d{6}$/],
      ['RESEARCH_LAB', /^RL\d{6}$/],
    ];
    const phones = ['9300000001', '9300000002', '9300000003', '9300000004', '9300000005'];
    const ids: string[] = [];
    for (let i = 0; i < cases.length; i += 1) {
      const res = await ctx.http().post('/api/v1/admin/users').set(...auth(admin.token))
        .send({ fullName: `User ${i}`, phone: phones[i], role: cases[i][0], tempPin: '1234' });
      expect(res.status).toBe(201);
      expect(res.body.stakeholderId).toMatch(cases[i][1]);
      expect(res.body.mustChangeCredential).toBe(true);
      expect(res.body).not.toHaveProperty('pin');
      expect(res.body).not.toHaveProperty('tempPin');
      ids.push(res.body.stakeholderId);
    }
    expect(new Set(ids).size).toBe(5);
  });

  it('prevents duplicate phone numbers and duplicate role IDs', async () => {
    await createPendingStakeholder(ctx, { role: 'CLINICIAN', stakeholderCode: 'CL000001', phone: '9300000010', tempPin: '1234' });
    const dupPhone = await ctx.http().post('/api/v1/admin/users').set(...auth(admin.token))
      .send({ fullName: 'Dup', phone: '9300000010', role: 'CLINICIAN', tempPin: '4321' });
    expect(dupPhone.status).toBe(409);

    // Direct user rows carrying the same stakeholderCode cannot coexist (unique constraint).
    let clash = null;
    try {
      await ctx.prisma.user.create({ data: { role: 'CLINICIAN', displayName: 'Dup code', stakeholderCode: 'CL000001' } });
    } catch (e) {
      clash = e;
    }
    expect(clash).toBeTruthy();
  });

  it('assigns contractor sites at creation only when they are contractor-free', async () => {
    const areaId = await createArea(ctx, 'Assign Area');
    await createSite(ctx, { siteCode: 'SITE-A1', name: 'Assign One', areaId });
    const taken = await createContractor(ctx, { name: 'Holder', username: 'c.holder' });
    await ctx.prisma.constructionSite.update({ where: { siteCode: 'SITE-A1' }, data: { contractorId: taken.contractorId } });

    const res = await ctx.http().post('/api/v1/admin/users').set(...auth(admin.token))
      .send({ fullName: 'Assign Me', phone: '9300000020', role: 'CONTRACTOR', tempPin: '1234', siteIds: ['SITE-A1'] });
    expect(res.status).toBe(409);

    // Unassigned site works and creation keeps profile separate from assignment.
    await createSite(ctx, { siteCode: 'SITE-A2', name: 'Assign Two', areaId });
    const ok = await ctx.http().post('/api/v1/admin/users').set(...auth(admin.token))
      .send({ fullName: 'Assign Me', phone: '9300000021', role: 'CONTRACTOR', tempPin: '1234', siteIds: ['SITE-A2'] });
    expect(ok.status).toBe(201);
    const site = await ctx.prisma.constructionSite.findUnique({ where: { siteCode: 'SITE-A2' } });
    expect(site?.contractorId).toBeTruthy();
  });

  it('searches and filters users; supports activate/deactivate and PIN reset', async () => {
    const pre = await createPendingStakeholder(ctx, { role: 'CLINICIAN', stakeholderCode: 'CL000010', phone: '9300000040', tempPin: '5678' });
    const res = await ctx.http().get('/api/v1/admin/users').set(...auth(admin.token))
      .query({ role: 'CLINICIAN', search: 'CL000010' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    const detail = await ctx.http().get(`/api/v1/admin/users/${pre.userId}`).set(...auth(admin.token));
    expect(detail.body.mustChangeCredential).toBe(true);

    const deact = await ctx.http().post(`/api/v1/admin/users/${pre.userId}/deactivate`).set(...auth(admin.token)).send({});
    expect(deact.body.active).toBe(false);
    // deactivated users cannot log in
    const login = await ctx.http().post('/api/v1/auth/staff/login').send({ username: '9300000040', password: '5678' });
    expect(login.status).toBe(403);

    const act = await ctx.http().post(`/api/v1/admin/users/${pre.userId}/activate`).set(...auth(admin.token)).send({});
    expect(act.body.active).toBe(true);

    const reset = await ctx.http().post(`/api/v1/admin/users/${pre.userId}/reset-pin`).set(...auth(admin.token)).send({ tempPin: '9999' });
    expect(reset.status).toBe(201);
    expect(reset.body.mustChangeCredential).toBe(true);
    const relogin = await ctx.http().post('/api/v1/auth/staff/login').send({ username: '9300000040', password: '9999' });
    expect(relogin.status).toBe(201);
    expect(relogin.body.user.credentialChangeRequired).toBe(true);
    expect(await ctx.prisma.auditLog.count({ where: { action: 'USER_PIN_RESET' } })).toBe(1);
  });

  it('does not offer an admin endpoint to hard-delete users or workers', async () => {
    const res = await ctx.http().delete('/api/v1/admin/users/nonexistent').set(...auth(admin.token));
    expect([404, 405]).toContain(res.status); // no delete route exists
  });
});
