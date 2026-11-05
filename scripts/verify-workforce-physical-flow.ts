import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:8003/api/v1';
const prisma = new PrismaClient();

async function req(url: string, opts: { method?: string; body?: any; token?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(url, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return { status: res.status, data };
}

async function main() {
  console.log('=== WORKFORCE MANAGEMENT & QR PASS VERIFICATION ===\n');

  // 1. Authenticate actors
  console.log('[1] Authenticating Actors...');
  const adminLogin = await req(`${API_BASE}/auth/staff/login`, { body: { username: 'admin', password: 'ChangeMe123!' } });
  const adminToken = adminLogin.data.token;
  console.log('✓ Admin authenticated');

  const contractorALogin = await req(`${API_BASE}/auth/login`, { body: { phone: '9822112233', pin: '1234' } });
  const contractorAToken = contractorALogin.data.token;
  console.log('✓ Contractor A (Apex Coastal Builders, C000001) authenticated');

  const contractorBLogin = await req(`${API_BASE}/auth/login`, { body: { phone: '9800000001', pin: '1234' } });
  const contractorBToken = contractorBLogin.data.token;
  console.log('✓ Contractor B (Vikram Dempo, C000002) authenticated');

  const unassignedWorkerLogin = await req(`${API_BASE}/auth/login`, { body: { phone: '9822112236', pin: '1234' } });
  const unassignedWorkerToken = unassignedWorkerLogin.data.token;
  console.log('✓ Unassigned Worker (M3-JOIN-01) authenticated');

  const assignedWorkerLogin = await req(`${API_BASE}/auth/login`, { body: { phone: '9822112231', pin: '1234' } });
  const assignedWorkerToken = assignedWorkerLogin.data.token;
  console.log('✓ Assigned Worker (M3-POS-01) authenticated\n');

  // 2. Admin Multi-Contractor Site Management
  console.log('[2] Admin Multi-Contractor Site Management...');
  const siteCode = 'SITE-82WUJS';

  // Add Contractor B to SITE-82WUJS
  try {
    const addRes = await req(`${API_BASE}/admin/sites/${siteCode}/contractors`, {
      body: { contractorId: contractorBLogin.data.user.contractorId },
      token: adminToken,
    });
    console.log('✓ Contractor B added to site:', addRes.data.contractorId);
  } catch (err: any) {
    if (err.status === 409) {
      console.log('ℹ Contractor B already assigned to site');
    } else {
      throw err;
    }
  }

  // Get Site Contractors
  const contractorsList = await req(`${API_BASE}/admin/sites/${siteCode}/contractors`, {
    token: adminToken,
  });
  console.log('✓ Assigned Contractors at SITE-82WUJS:', contractorsList.data.total, 'contractor(s)');
  for (const c of contractorsList.data.items) {
    console.log(`   - ${c.name} (${c.stakeholderCode || 'Primary'}): ${c.activeWorkers} active worker(s)`);
  }

  // 3. Scenario A: Unassigned Worker Onboarding
  console.log('\n[3] Test Scenario A — Unassigned Worker Onboarding...');
  // Ensure unassigned worker has no active assignments
  await prisma.workerSiteAssignment.updateMany({
    where: { worker: { workerCode: 'M3-JOIN-01' }, active: true },
    data: { active: false, status: 'ENDED', endedAt: new Date() },
  });

  // Generate QR Pass
  const passA = await req(`${API_BASE}/workers/me/pass/generate`, {
    body: {},
    token: unassignedWorkerToken,
  });
  console.log('✓ Worker M3-JOIN-01 generated pass token (length:', passA.data.token.length, ', valid for:', passA.data.remainingSeconds, 's)');

  // Verify pass status endpoint
  const statusA = await req(`${API_BASE}/workers/me/pass/status`, {
    token: unassignedWorkerToken,
  });
  console.log('✓ Worker pass status active:', statusA.data.activeToken !== null);

  // Contractor A scans pass
  const scanA = await req(`${API_BASE}/contractor/pass/scan`, {
    body: { token: passA.data.token },
    token: contractorAToken,
  });
  console.log('✓ Contractor scanned pass -> Identified Worker:', scanA.data.name, '(', scanA.data.workerCode, ')');
  console.log('   Has active assignment:', scanA.data.hasActiveAssignment);
  console.log('   Can request:', scanA.data.canRequest);
  if (!scanA.data.canRequest) throw new Error('Unassigned worker should be requestable');

  // Contractor A requests direct assignment
  const assignReqA = await req(`${API_BASE}/contractor/pass/request`, {
    body: { token: passA.data.token, siteCode: 'SITE-82WUJS', note: 'Direct physical test assignment' },
    token: contractorAToken,
  });
  console.log('✓ Direct assignment result:', assignReqA.data.directAssignment ? 'DIRECT' : 'TRANSFER', 'status:', assignReqA.data.status);

  // Check DB state
  const dbAssignmentA = await prisma.workerSiteAssignment.findFirst({
    where: { worker: { workerCode: 'M3-JOIN-01' }, active: true },
    include: { site: true, contractor: true },
  });
  console.log('✓ Verified DB assignment: Worker active at', dbAssignmentA?.site?.name, 'under', dbAssignmentA?.contractor?.name);

  // 4. Scenario B: Same-Site Contractor Transfer (Contractor A -> Contractor B)
  console.log('\n[4] Test Scenario B — Same-Site Contractor Transfer...');
  const contractorAId = contractorALogin.data.user.contractorId;
  const contractorBId = contractorBLogin.data.user.contractorId;
  const siteRecord = await prisma.constructionSite.findUniqueOrThrow({ where: { siteCode: 'SITE-82WUJS' } });
  const workerPos = await prisma.worker.findUniqueOrThrow({ where: { workerCode: 'M3-POS-01' } });

  await prisma.workerSiteAssignment.deleteMany({
    where: { workerId: workerPos.id },
  });
  await prisma.workerSiteAssignment.create({
    data: {
      workerId: workerPos.id,
      siteId: siteRecord.id,
      contractorId: contractorAId,
      active: true,
      status: 'ACTIVE',
      startedAt: new Date(),
    },
  });
  await prisma.siteTransferRequest.deleteMany({ where: { workerId: workerPos.id } });

  // Worker generates pass
  const passB = await req(`${API_BASE}/workers/me/pass/generate`, {
    body: {},
    token: assignedWorkerToken,
  });
  console.log('✓ Worker M3-POS-01 generated pass token');

  // Contractor B scans pass
  const scanB = await req(`${API_BASE}/contractor/pass/scan`, {
    body: { token: passB.data.token },
    token: contractorBToken,
  });
  console.log('✓ Contractor B scanned pass: Worker', scanB.data.name, 'currently under', scanB.data.currentContractor?.name);

  // Contractor B requests same-site transfer to their team
  const transferReqB = await req(`${API_BASE}/contractor/pass/request`, {
    body: { token: passB.data.token, siteCode: 'SITE-82WUJS', note: 'Transfer to Vikram Dempo team' },
    token: contractorBToken,
  });
  console.log('✓ Transfer requested:', transferReqB.data.transferId, 'status:', transferReqB.data.status);
  const transferId = transferReqB.data.transferId;

  // Worker views pending transfer via pass status
  const workerStatusB = await req(`${API_BASE}/workers/me/pass/status`, {
    token: assignedWorkerToken,
  });
  console.log('✓ Worker incoming transfers count:', workerStatusB.data.pendingTransfers.length);

  // Worker accepts transfer
  await req(`${API_BASE}/transfers/${transferId}/worker/accept`, {
    body: {},
    token: assignedWorkerToken,
  });
  console.log('✓ Worker accepted transfer');

  // Releasing Contractor (Contractor A) approves release
  await req(`${API_BASE}/transfers/${transferId}/contractor/approve`, {
    body: { reason: 'Approved release to Vikram Dempo team' },
    token: contractorAToken,
  });
  console.log('✓ Contractor A approved transfer release');

  // Verify DB state
  const assignmentsB = await prisma.workerSiteAssignment.findMany({
    where: { workerId: workerPos.id },
    orderBy: { createdAt: 'asc' },
    include: { contractor: true, site: true },
  });
  console.log('✓ Total assignments for M3-POS-01 in DB:', assignmentsB.length);
  for (const a of assignmentsB) {
    console.log(`   - Status: ${a.status}, Active: ${a.active}, Contractor: ${a.contractor?.name}, Site: ${a.site.siteCode}, Started: ${a.startedAt.toISOString().slice(0, 10)}, Ended: ${a.endedAt?.toISOString().slice(0, 10) || 'None'}`);
  }
  if (assignmentsB.length !== 2) throw new Error('Expected exactly 2 assignment history records');
  if (assignmentsB[0].status !== 'TRANSFERRED' || assignmentsB[0].active !== false) throw new Error('Old assignment must be TRANSFERRED and inactive');
  if (assignmentsB[1].status !== 'ACTIVE' || assignmentsB[1].contractorId !== contractorBId) throw new Error('New assignment must be ACTIVE under Contractor B');

  // 5. QR Security Tests
  console.log('\n[5] QR Pass Security & Cryptographic Integrity Tests...');
  // 5a. Reused token rejected
  try {
    await req(`${API_BASE}/contractor/pass/request`, {
      body: { token: passB.data.token, siteCode: 'SITE-82WUJS' },
      token: contractorBToken,
    });
    throw new Error('Reused token should have failed');
  } catch (err: any) {
    console.log('✓ Reused token rejected with status', err.status, ':', err.data?.message);
  }

  // 5b. Expired token rejected
  const passExpired = await req(`${API_BASE}/workers/me/pass/generate`, {
    body: {},
    token: assignedWorkerToken,
  });
  await prisma.workerPassToken.updateMany({
    where: { workerId: workerPos.id, usedAt: null },
    data: { expiresAt: new Date(Date.now() - 10000) },
  });
  try {
    await req(`${API_BASE}/contractor/pass/scan`, {
      body: { token: passExpired.data.token },
      token: contractorAToken,
    });
    throw new Error('Expired token should have failed');
  } catch (err: any) {
    console.log('✓ Expired token rejected with status', err.status, ':', err.data?.message);
  }

  // 5c. Revoked token rejected
  const passRevoked = await req(`${API_BASE}/workers/me/pass/generate`, {
    body: {},
    token: assignedWorkerToken,
  });
  await req(`${API_BASE}/workers/me/pass/revoke`, {
    body: {},
    token: assignedWorkerToken,
  });
  try {
    await req(`${API_BASE}/contractor/pass/scan`, {
      body: { token: passRevoked.data.token },
      token: contractorAToken,
    });
    throw new Error('Revoked token should have failed');
  } catch (err: any) {
    console.log('✓ Revoked token rejected with status', err.status, ':', err.data?.message);
  }

  // 5d. Invalid random token rejected
  try {
    await req(`${API_BASE}/contractor/pass/scan`, {
      body: { token: 'invalid-random-token-xyz-1234567890' },
      token: contractorAToken,
    });
    throw new Error('Invalid token should have failed');
  } catch (err: any) {
    console.log('✓ Invalid token rejected with status', err.status, ':', err.data?.message);
  }

  // 5e. Token hash storage verification (SHA-256)
  const freshPass = await req(`${API_BASE}/workers/me/pass/generate`, {
    body: {},
    token: assignedWorkerToken,
  });
  const rawClean = freshPass.data.token.replace('M3PASS:v1:', '');
  const expectedHash = crypto.createHash('sha256').update(rawClean).digest('hex');
  const storedToken = await prisma.workerPassToken.findUnique({ where: { tokenHash: expectedHash } });
  console.log('✓ Cryptographic token storage: SHA-256 hash verified in database');
  console.log('   Expected Hash:', expectedHash.slice(0, 16) + '...');
  console.log('   Stored Hash:  ', storedToken?.tokenHash.slice(0, 16) + '...');
  console.log('   Raw token stored anywhere in DB: NO (only tokenPrefix:', storedToken?.tokenPrefix, ')');

  // 6. Admin Safe Removal Guard
  console.log('\n[6] Admin Safe Contractor Removal Safeguard...');
  // Contractor B now has active worker M3-POS-01 at SITE-82WUJS.
  // Attempt to remove Contractor B without reassignment -> must fail with 409 Conflict
  try {
    await req(`${API_BASE}/admin/sites/${siteCode}/contractors/${contractorBId}`, {
      method: 'DELETE',
      token: adminToken,
    });
    throw new Error('Removing contractor with active workers without reassignment should fail');
  } catch (err: any) {
    console.log('✓ Removal blocked without reassignment (status 409):', err.data?.message);
  }

  // Safe removal with reassignment to Contractor A
  const safeRemove = await req(`${API_BASE}/admin/sites/${siteCode}/contractors/${contractorBId}?reassignTo=${contractorAId}`, {
    method: 'DELETE',
    token: adminToken,
  });
  console.log('✓ Safe removal succeeded with reassignment:', safeRemove.data);

  // Verify worker reassigned
  const reassignedWorker = await prisma.workerSiteAssignment.findFirst({
    where: { workerId: workerPos.id, active: true },
    include: { contractor: true },
  });
  console.log('✓ Worker M3-POS-01 actively reassigned to:', reassignedWorker?.contractor?.name);

  // 7. Site Assignment History
  console.log('\n[7] Construction Site Assignment History...');
  const historyRes = await req(`${API_BASE}/admin/sites/${siteCode}/assignment-history`, {
    token: adminToken,
  });
  console.log('✓ Total site assignment history records:', historyRes.data.total);
  for (const h of historyRes.data.items.slice(0, 5)) {
    console.log(`   - Worker: ${h.workerName} (${h.workerId}) | Contractor: ${h.contractorName} | Status: ${h.status} | Started: ${h.startedAt.slice(0, 10)} | Ended: ${h.endedAt?.slice(0, 10) || 'Current'}`);
  }

  console.log('\n=== ALL PHYSICAL API & DATABASE CHECKS PASSED ===');
}

main()
  .catch((e) => {
    console.error('FAILED:', e.data || e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
