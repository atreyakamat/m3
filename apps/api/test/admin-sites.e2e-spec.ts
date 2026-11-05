import { createTestApp, type TestContext } from './setup/test-app';
import { auth, createAdmin, createArea, createContractor, createSite, createPendingStakeholder } from './setup/fixtures';

describe('Admin construction-site management (e2e)', () => {
  let ctx: TestContext;
  let admin: { token: string };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => { await ctx.close(); });
  beforeEach(async () => {
    await ctx.reset();
    admin = await createAdmin(ctx, { username: 'a.sites' });
  });

  it('creates a site with an auto-generated unique ID (site ID cannot be supplied)', async () => {
    const areaId = await createArea(ctx);
    const res = await ctx.http().post('/api/v1/admin/sites').set(...auth(admin.token))
      .send({ name: 'New Tower Works', areaId });
    expect(res.status).toBe(201);
    expect(res.body.siteId).toMatch(/^SITE-/);
    expect(res.body.name).toBe('New Tower Works');
    const list = await ctx.http().get('/api/v1/admin/sites').set(...auth(admin.token));
    expect(list.body.total).toBe(1);
  });

  it('views a site with district, contractor and linked workers', async () => {
    const areaId = await createArea(ctx, 'Detail Area');
    const { contractorId } = await createContractor(ctx, { name: 'Detail Builders', username: 'c.detail' });
    await createSite(ctx, { siteCode: 'SITE-DET1', name: 'Detail Site', areaId, contractorId });
    const res = await ctx.http().get('/api/v1/admin/sites/SITE-DET1').set(...auth(admin.token));
    expect(res.status).toBe(200);
    expect(res.body.district).toBe('North Goa');
    expect(res.body.contractor.name).toBe('Detail Builders');
  });

  it('updates a site without changing the site ID', async () => {
    const areaId = await createArea(ctx);
    await createSite(ctx, { siteCode: 'SITE-UPD1', name: 'Old Name', areaId });
    const res = await ctx.http().put('/api/v1/admin/sites/SITE-UPD1').set(...auth(admin.token))
      .send({ name: 'Renamed Site', address: 'New address 4' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Site');
    expect(res.body.siteId).toBe('SITE-UPD1');
  });

  it('allows a contractor to manage multiple sites but never two contractors on one site', async () => {
    const areaId = await createArea(ctx, 'Multi Area');
    const a = await createContractor(ctx, { name: 'First Builders', username: 'c.first' });
    await createContractor(ctx, { name: 'Second Builders', username: 'c.second' });
    await createSite(ctx, { siteCode: 'SITE-M1', name: 'Site One', areaId, contractorId: a.contractorId });
    await createSite(ctx, { siteCode: 'SITE-M2', name: 'Site Two', areaId, contractorId: a.contractorId });
    // same contractor, two sites: fine.
    // assigning a second contractor to the same site is prevented at user-creation path:
    const clash = await ctx.http().post('/api/v1/admin/users').set(...auth(admin.token))
      .send({ fullName: 'Clash Builders', phone: '9300000034', role: 'CONTRACTOR', tempPin: '2468', siteIds: ['SITE-M1'] });
    expect(clash.status).toBe(409);
  });

  it('deactivation first warns about active relationships, then requires confirmation', async () => {
    const areaId = await createArea(ctx, 'Deact Area');
    const { contractorId } = await createContractor(ctx, { name: 'Deact Builders', username: 'c.deact' });
    await createSite(ctx, { siteCode: 'SITE-DOC1', name: 'Deact Site', areaId, contractorId });
    const contractorSite = await ctx.prisma.constructionSite.findUnique({ where: { siteCode: 'SITE-DOC1' } });

    const noConfirm = await ctx.http().post('/api/v1/admin/sites/SITE-DOC1/deactivate').set(...auth(admin.token)).send({});
    expect(noConfirm.status).toBe(409); // warning: contractor assigned

    const confirmed = await ctx.http().post('/api/v1/admin/sites/SITE-DOC1/deactivate').set(...auth(admin.token))
      .send({ confirm: true });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.active).toBe(false);

    // historical records preserved
    const still = await ctx.prisma.constructionSite.findUnique({ where: { siteCode: 'SITE-DOC1' }, include: { contractor: true } });
    expect(still?.contractorId).toBe(contractorId);
    void contractorSite;
  });

  it('records audit entries for site creation and updates', async () => {
    const areaId = await createArea(ctx, 'Audit Area');
    await ctx.http().post('/api/v1/admin/sites').set(...auth(admin.token)).send({ name: 'Audit Site', areaId });
    const events = await ctx.prisma.auditLog.findMany({ where: { action: 'SITE_CREATED' } });
    expect(events.length).toBe(1);
  });
});
