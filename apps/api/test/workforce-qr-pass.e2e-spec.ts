import { createTestApp, type TestContext } from './setup/test-app';
import {
  auth,
  createArea,
  createStaff,
  registerWorker,
} from './setup/fixtures';
import * as bcrypt from 'bcryptjs';

describe('Workforce Management & QR Worker Pass (e2e)', () => {
  let ctx: TestContext;
  let admin: { token: string };

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await ctx.reset();
    admin = await createStaff(ctx, { role: 'ADMIN', username: 'admin.workforce' });
  });

  // Helper to create a contractor with user account and active session
  async function createContractor(name: string, phone: string, code: string) {
    const contractor = await ctx.prisma.contractor.create({ data: { name } });
    const pinHash = await bcrypt.hash('1234', 10);
    const user = await ctx.prisma.user.create({
      data: {
        role: 'CONTRACTOR',
        phone,
        stakeholderCode: code,
        displayName: name,
        passwordHash: pinHash,
        mustChangeCredential: false,
        contractorId: contractor.id,
      },
    });
    const login = await ctx.http()
      .post('/api/v1/auth/login')
      .send({ phone, pin: '1234' });
    return { contractor, user, token: login.body.token as string };
  }

  it('Covers all 20 workforce management, multi-contractor & QR pass cases', async () => {
    const areaId = await createArea(ctx, 'Candolim Coastal');

    // 1. Provision two contractors: C1 and C2
    const c1 = await createContractor('Alpha Infrastructure', '9820011111', 'C000010');
    const c2 = await createContractor('Beta Builders Goa', '9820022222', 'C000020');

    // 2. Provision two sites: Site A and Site B
    const siteA = await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-ALF',
        name: 'Alpha Palm Grove',
        areaId,
        contractorId: c1.contractor.id,
      },
    });
    const siteB = await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-BET',
        name: 'Beta Sunset Bay',
        areaId,
        contractorId: c2.contractor.id,
      },
    });

    // Case 1 & Case 2: Multi-contractor site & Multi-site contractor
    // Assign C2 also to Site A via Admin API
    const addC2Res = await ctx.http()
      .post(`/api/v1/admin/sites/${siteA.siteCode}/contractors`)
      .set(...auth(admin.token))
      .send({ contractorId: c2.contractor.id })
      .expect(201);
    expect(addC2Res.body.contractorId).toBe(c2.contractor.id);
    expect(addC2Res.body.siteId).toBe(siteA.id);

    // Verify Site A has both C1 and C2
    const siteAContractors = await ctx.http()
      .get(`/api/v1/admin/sites/${siteA.siteCode}/contractors`)
      .set(...auth(admin.token))
      .expect(200);
    expect(siteAContractors.body.total).toBe(2);

    // Verify C2 manages both Site A and Site B
    const c2Profile = await ctx.http()
      .get('/api/v1/contractor/profile')
      .set(...auth(c2.token))
      .expect(200);
    const c2SiteIds = c2Profile.body.assignedSites.map((s: any) => s.siteId);
    expect(c2SiteIds).toContain(siteA.siteCode);
    expect(c2SiteIds).toContain(siteB.siteCode);

    // Case 6 & Case 7: Worker generates secure QR pass token
    const worker1 = await registerWorker(ctx, { name: 'Ramesh Patel', phone: '9870001111', pin: '1111' });
    const genRes = await ctx.http()
      .post('/api/v1/workers/me/pass/generate')
      .set(...auth(worker1.token))
      .send({})
      .expect(201);

    expect(genRes.body.token).toBeDefined();
    expect(genRes.body.token.length).toBeGreaterThanOrEqual(32);
    expect(genRes.body.expiresAt).toBeDefined();
    expect(genRes.body.remainingSeconds).toBeGreaterThan(290);
    // Token is opaque - contains no personal or clinical information
    expect(genRes.body.token).not.toContain('Ramesh');
    expect(genRes.body.token).not.toContain('9870001111');

    // Case 11: Contractor scans QR pass -> identity confirmation
    const scanRes = await ctx.http()
      .post('/api/v1/contractor/pass/scan')
      .set(...auth(c1.token))
      .send({ token: genRes.body.token })
      .expect(201);
    expect(scanRes.body.workerCode).toBe(worker1.workerId);
    expect(scanRes.body.name).toBe('Ramesh Patel');
    expect(scanRes.body.hasActiveAssignment).toBe(false);
    expect(scanRes.body.canRequest).toBe(true);

    // Case 12: Case A (Direct Assignment of unassigned worker)
    const directRes = await ctx.http()
      .post('/api/v1/contractor/pass/request')
      .set(...auth(c1.token))
      .send({ token: genRes.body.token, siteCode: siteA.siteCode, note: 'Direct onboarding' })
      .expect(201);
    expect(directRes.body.directAssignment).toBe(true);
    expect(directRes.body.status).toBe('ASSIGNED');

    // Case 3 & Case 4: Single active assignment tracking Worker, Site, Contractor, status
    const worker1Record = await ctx.prisma.worker.findUniqueOrThrow({
      where: { workerCode: worker1.workerId },
    });
    const activeAssignments = await ctx.prisma.workerSiteAssignment.findMany({
      where: { workerId: worker1Record.id, active: true },
    });
    expect(activeAssignments.length).toBe(1);
    expect(activeAssignments[0].siteId).toBe(siteA.id);
    expect(activeAssignments[0].contractorId).toBe(c1.contractor.id);
    expect(activeAssignments[0].status).toBe('ACTIVE');
    expect(activeAssignments[0].endedAt).toBeNull();

    // Case 10: Single-use enforcement (reusing used pass token fails)
    await ctx.http()
      .post('/api/v1/contractor/pass/request')
      .set(...auth(c1.token))
      .send({ token: genRes.body.token, siteCode: siteA.siteCode })
      .expect(400);

    // Case 8: Expired pass rejection
    const genRes2 = await ctx.http()
      .post('/api/v1/workers/me/pass/generate')
      .set(...auth(worker1.token))
      .send({})
      .expect(201);
    // Artificially expire the token in database
    await ctx.prisma.workerPassToken.updateMany({
      where: { workerId: worker1Record.id, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 60000) },
    });
    await ctx.http()
      .post('/api/v1/contractor/pass/scan')
      .set(...auth(c2.token))
      .send({ token: genRes2.body.token })
      .expect(400);

    // Case 9: Revoked pass rejection
    const genRes3 = await ctx.http()
      .post('/api/v1/workers/me/pass/generate')
      .set(...auth(worker1.token))
      .send({})
      .expect(201);
    // Worker revokes active pass
    await ctx.http()
      .post('/api/v1/workers/me/pass/revoke')
      .set(...auth(worker1.token))
      .send({})
      .expect(201);
    await ctx.http()
      .post('/api/v1/contractor/pass/scan')
      .set(...auth(c2.token))
      .send({ token: genRes3.body.token })
      .expect(400);

    // Case 16: Self-assignment prevention
    // Worker generates fresh pass; C1 (current contractor) scans it
    const genRes4 = await ctx.http()
      .post('/api/v1/workers/me/pass/generate')
      .set(...auth(worker1.token))
      .send({})
      .expect(201);
    const selfScan = await ctx.http()
      .post('/api/v1/contractor/pass/scan')
      .set(...auth(c1.token))
      .send({ token: genRes4.body.token })
      .expect(201);
    expect(selfScan.body.isAssignedToCaller).toBe(true);
    expect(selfScan.body.canRequest).toBe(false);

    // Case 13: Case B (Same-site transfer between C1 and C2 at Site A)
    // C2 scans worker1 pass and requests assignment to Site A
    const sameSiteReq = await ctx.http()
      .post('/api/v1/contractor/pass/request')
      .set(...auth(c2.token))
      .send({ token: genRes4.body.token, siteCode: siteA.siteCode, note: 'Transfer to Beta team' })
      .expect(201);
    expect(sameSiteReq.body.directAssignment).toBe(false);
    expect(sameSiteReq.body.status).toBe('PENDING_WORKER_RESPONSE');
    expect(sameSiteReq.body.transferId).toBeDefined();
    const sameSiteTransferId = sameSiteReq.body.transferId;

    // Case 15: Duplicate transfer prevention
    // Worker generates another pass; C2 tries to request again while transfer is pending
    const genRes5 = await ctx.http()
      .post('/api/v1/workers/me/pass/generate')
      .set(...auth(worker1.token))
      .send({})
      .expect(201);
    const dupScan = await ctx.http()
      .post('/api/v1/contractor/pass/scan')
      .set(...auth(c2.token))
      .send({ token: genRes5.body.token })
      .expect(201);
    expect(dupScan.body.canRequest).toBe(false);
    expect(dupScan.body.pendingTransfer).toBeDefined();

    // Case 17: Worker transfer acceptance -> updates active assignment, preserves history
    await ctx.http()
      .post(`/api/v1/transfers/${sameSiteTransferId}/worker/accept`)
      .set(...auth(worker1.token))
      .send({})
      .expect(201);

    // Contractor C1 (releasing contractor) approves transfer
    await ctx.http()
      .post(`/api/v1/transfers/${sameSiteTransferId}/contractor/approve`)
      .set(...auth(c1.token))
      .send({ reason: 'Approved release to Beta team' })
      .expect(201);

    // Case 5: Verify assignment history was preserved:
    // 1 old assignment with TRANSFERRED status, 1 new assignment with ACTIVE status
    const allAssignments = await ctx.prisma.workerSiteAssignment.findMany({
      where: { workerId: worker1Record.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(allAssignments.length).toBe(2);
    expect(allAssignments[0].status).toBe('TRANSFERRED');
    expect(allAssignments[0].active).toBe(false);
    expect(allAssignments[0].endedAt).not.toBeNull();
    expect(allAssignments[0].contractorId).toBe(c1.contractor.id);

    expect(allAssignments[1].status).toBe('ACTIVE');
    expect(allAssignments[1].active).toBe(true);
    expect(allAssignments[1].contractorId).toBe(c2.contractor.id);
    expect(allAssignments[1].siteId).toBe(siteA.id);

    // Case 14: Case C (Cross-site transfer from Site A to Site B)
    // Create Worker 2 assigned to Site B under C2
    const worker2 = await registerWorker(ctx, { name: 'Sunil Kumar', phone: '9870002222', pin: '2222' });
    const genResW2 = await ctx.http()
      .post('/api/v1/workers/me/pass/generate')
      .set(...auth(worker2.token))
      .send({})
      .expect(201);

    // Directly assign worker2 to C2 at Site B
    await ctx.http()
      .post('/api/v1/contractor/pass/request')
      .set(...auth(c2.token))
      .send({ token: genResW2.body.token, siteCode: siteB.siteCode })
      .expect(201);

    // C1 requests transfer of Worker 2 to Site A
    const genResW2Cross = await ctx.http()
      .post('/api/v1/workers/me/pass/generate')
      .set(...auth(worker2.token))
      .send({})
      .expect(201);

    const crossReq = await ctx.http()
      .post('/api/v1/contractor/pass/request')
      .set(...auth(c1.token))
      .send({ token: genResW2Cross.body.token, siteCode: siteA.siteCode, note: 'Cross-site transfer' })
      .expect(201);
    expect(crossReq.body.directAssignment).toBe(false);
    expect(crossReq.body.status).toBe('PENDING_WORKER_RESPONSE');
    const crossTransferId = crossReq.body.transferId;

    // Case 18: Worker rejects transfer -> assignment unchanged
    await ctx.http()
      .post(`/api/v1/transfers/${crossTransferId}/worker/reject`)
      .set(...auth(worker2.token))
      .send({})
      .expect(201);

    const worker2Record = await ctx.prisma.worker.findUniqueOrThrow({
      where: { workerCode: worker2.workerId },
    });
    const w2Assignment = await ctx.prisma.workerSiteAssignment.findFirst({
      where: { workerId: worker2Record.id, active: true },
    });
    expect(w2Assignment?.siteId).toBe(siteB.id);
    expect(w2Assignment?.contractorId).toBe(c2.contractor.id);

    // Case 19: Contractor rejection of a transfer
    const genResW2Retry = await ctx.http()
      .post('/api/v1/workers/me/pass/generate')
      .set(...auth(worker2.token))
      .send({})
      .expect(201);
    const crossReq2 = await ctx.http()
      .post('/api/v1/contractor/pass/request')
      .set(...auth(c1.token))
      .send({ token: genResW2Retry.body.token, siteCode: siteA.siteCode })
      .expect(201);
    const crossTransferId2 = crossReq2.body.transferId;

    // Worker accepts
    await ctx.http()
      .post(`/api/v1/transfers/${crossTransferId2}/worker/accept`)
      .set(...auth(worker2.token))
      .send({})
      .expect(201);

    // Releasing contractor rejects
    await ctx.http()
      .post(`/api/v1/transfers/${crossTransferId2}/contractor/reject`)
      .set(...auth(c2.token))
      .send({ reason: 'Worker needed on critical structural work' })
      .expect(201);

    // Verify worker 2 is still at Site B
    const w2StillAtSiteB = await ctx.prisma.workerSiteAssignment.findFirst({
      where: { workerId: worker2Record.id, active: true },
    });
    expect(w2StillAtSiteB?.siteId).toBe(siteB.id);

    // Case 20: Admin safe contractor removal guards active workers
    // Contractor C2 has active worker1 at Site A. Removing C2 without reassigning throws 409 Conflict.
    await ctx.http()
      .delete(`/api/v1/admin/sites/${siteA.siteCode}/contractors/${c2.contractor.id}`)
      .set(...auth(admin.token))
      .expect(409);

    // Removing C2 with reassignment to C1 succeeds safely
    const removeRes = await ctx.http()
      .delete(`/api/v1/admin/sites/${siteA.siteCode}/contractors/${c2.contractor.id}?reassignTo=${c1.contractor.id}`)
      .set(...auth(admin.token))
      .expect(200);
    expect(removeRes.body.removed).toBe(true);
    expect(removeRes.body.reassignedWorkers).toBe(1);

    // Verify worker1 assignment is now under C1
    const w1Reassigned = await ctx.prisma.workerSiteAssignment.findFirst({
      where: { workerId: worker1Record.id, active: true },
    });
    expect(w1Reassigned?.contractorId).toBe(c1.contractor.id);
  });

  it('Enforces QR token security, prevents multiple active passes, and handles concurrent consumption atomically', async () => {
    const areaId = await createArea(ctx, 'Anjuna North');
    const c1 = await createContractor('Coastal Concrete', '9820033333', 'C000030');
    const c2 = await createContractor('Goa Builders Ltd', '9820044444', 'C000040');

    const site = await ctx.prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-ANJ',
        name: 'Anjuna Heights',
        areaId,
        contractorId: c1.contractor.id,
      },
    });

    // Add C2 to the same site
    await ctx.http()
      .post(`/api/v1/admin/sites/${site.siteCode}/contractors`)
      .set(...auth(admin.token))
      .send({ contractorId: c2.contractor.id })
      .expect(201);

    const worker = await registerWorker(ctx, { name: 'Kailash Yadav', phone: '9870002222', pin: '2222' });
    const workerRecord = await ctx.prisma.worker.findUniqueOrThrow({ where: { workerCode: worker.workerId } });

    // 1. Worker generates Pass 1
    const pass1Res = await ctx.http()
      .post('/api/v1/workers/me/pass/generate')
      .set(...auth(worker.token))
      .expect(201);
    const token1 = pass1Res.body.token;

    // Verify token 1 status
    const status1 = await ctx.http()
      .get('/api/v1/workers/me/pass/status')
      .set(...auth(worker.token))
      .expect(200);
    expect(status1.body.activeToken).toBeDefined();

    // 2. Worker generates Pass 2 -> Pass 1 MUST be revoked immediately
    const pass2Res = await ctx.http()
      .post('/api/v1/workers/me/pass/generate')
      .set(...auth(worker.token))
      .expect(201);
    const token2 = pass2Res.body.token;
    expect(token2).not.toBe(token1);

    // Verify only ONE active token exists in DB for this worker
    const activeTokensInDb = await ctx.prisma.workerPassToken.findMany({
      where: { workerId: workerRecord.id, revokedAt: null, usedAt: null, expiresAt: { gt: new Date() } },
    });
    expect(activeTokensInDb.length).toBe(1);

    // Verify Pass 1 is rejected if scanned or requested
    await ctx.http()
      .post('/api/v1/contractor/pass/scan')
      .set(...auth(c1.token))
      .send({ token: token1 })
      .expect(400);

    await ctx.http()
      .post('/api/v1/contractor/pass/request')
      .set(...auth(c1.token))
      .send({ token: token1, siteCode: site.siteCode })
      .expect(400);

    // 3. Test Simultaneous Token Consumption with token 2:
    // Two concurrent requests using the exact same valid token 2
    const [resA, resB] = await Promise.all([
      ctx.http()
        .post('/api/v1/contractor/pass/request')
        .set(...auth(c1.token))
        .send({ token: token2, siteCode: site.siteCode }),
      ctx.http()
        .post('/api/v1/contractor/pass/request')
        .set(...auth(c1.token))
        .send({ token: token2, siteCode: site.siteCode }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Exactly one must succeed (201) and exactly one must fail (400)
    expect(statuses).toEqual([201, 400]);

    const successfulRes = resA.status === 201 ? resA : resB;
    const failedRes = resA.status === 400 ? resA : resB;
    expect(successfulRes.body.directAssignment).toBe(true);
    expect(successfulRes.body.status).toBe('ASSIGNED');
    expect(failedRes.body.message).toMatch(/already been used/i);

    // Verify exactly 1 active assignment created for the worker
    const assignments = await ctx.prisma.workerSiteAssignment.findMany({
      where: { workerId: workerRecord.id, active: true },
    });
    expect(assignments.length).toBe(1);

    // Verify token2 cannot be used a third time
    await ctx.http()
      .post('/api/v1/contractor/pass/request')
      .set(...auth(c1.token))
      .send({ token: token2, siteCode: site.siteCode })
      .expect(400);

    // 4. Test same-site transfer permissions & receiving contractor access restrictions
    // Worker is now actively under C1. Worker generates Pass 3.
    const pass3Res = await ctx.http()
      .post('/api/v1/workers/me/pass/generate')
      .set(...auth(worker.token))
      .expect(201);
    const token3 = pass3Res.body.token;

    // C2 scans and initiates transfer to C2 at the same site
    const transferReq = await ctx.http()
      .post('/api/v1/contractor/pass/request')
      .set(...auth(c2.token))
      .send({ token: token3, siteCode: site.siteCode, note: 'Transfer to C2 team' })
      .expect(201);
    expect(transferReq.body.directAssignment).toBe(false);
    expect(transferReq.body.status).toBe('PENDING_WORKER_RESPONSE');
    const transferId = transferReq.body.transferId;

    // CRITICAL: While transfer is pending, receiving contractor C2 MUST NOT access worker as active team member
    // Attempting to fetch worker detail by C2 must return 403 Forbidden
    await ctx.http()
      .get(`/api/v1/contractor/workers/${worker.workerId}`)
      .set(...auth(c2.token))
      .expect(403);

    // Worker list for C2 must NOT include worker
    const c2WorkersList = await ctx.http()
      .get(`/api/v1/contractor/sites/${site.siteCode}/workers`)
      .set(...auth(c2.token))
      .expect(200);
    const c2WorkerIds = c2WorkersList.body.items.map((w: any) => w.workerId);
    expect(c2WorkerIds).not.toContain(worker.workerId);

    // 5. Receiving contractor cancels transfer request
    await ctx.http()
      .post(`/api/v1/transfers/${transferId}/cancel`)
      .set(...auth(c2.token))
      .send({ reason: 'Team filled' })
      .expect(201);

    const cancelledTransfer = await ctx.prisma.siteTransferRequest.findUniqueOrThrow({
      where: { id: transferId },
    });
    expect(cancelledTransfer.status).toBe('CANCELLED');

    // Worker remains safely under C1
    const workerStillUnderC1 = await ctx.prisma.workerSiteAssignment.findFirst({
      where: { workerId: workerRecord.id, active: true },
    });
    expect(workerStillUnderC1?.contractorId).toBe(c1.contractor.id);
  });
});
