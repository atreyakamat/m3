import assert from 'node:assert';

const API_BASE = 'http://localhost:8003/api/v1';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return { status: res.status, ok: res.ok, body: json };
}

async function run() {
  console.log('====================================================');
  console.log('M3 Reset & Initial Test Setup Verification Suite');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // Check 1: Admin Web Login with existing password (ChangeMe123!)
  // --------------------------------------------------------------------------
  console.log('--- 1. Admin Web Login ---');
  const adminRes = await request('/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'ChangeMe123!' }),
  });
  assert.strictEqual(adminRes.status, 201, `Admin login failed: ${JSON.stringify(adminRes.body)}`);
  assert.strictEqual(adminRes.body.role, 'ADMIN', 'Admin role mismatch');
  const adminToken = adminRes.body.token;
  assert(adminToken, 'Admin token not received');
  console.log('✔ Admin successfully authenticated with existing credentials (token received).');

  // Verify Admin Mobile Login is BLOCKED (RBAC check)
  const adminMobileRes = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: 'admin', pin: 'ChangeMe123!' }),
  });
  assert.strictEqual(adminMobileRes.status, 403, 'Admin mobile login should be rejected with 403');
  console.log(`✔ Admin mobile login blocked: ${adminMobileRes.body.message}`);

  // --------------------------------------------------------------------------
  // Check 2: Contractor 1 (9000000101) Mobile Login & First-login PIN Change
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Contractor 1 (9000000101) Mobile Login ---');
  const c1Res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: '9000000101', pin: '1234' }),
  });
  assert.strictEqual(c1Res.status, 201, `Contractor 1 login failed: ${JSON.stringify(c1Res.body)}`);
  assert.strictEqual(c1Res.body.role, 'CONTRACTOR', 'Contractor 1 role mismatch');
  let c1Token = c1Res.body.token;

  if (c1Res.body.credentialChangeRequired) {
    console.log('✔ Contractor 1 logged in successfully with first-login change enforced.');
    const c1Change = await request('/auth/change-credential', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c1Token}` },
      body: JSON.stringify({ newCredential: '1234', confirmCredential: '1234' }),
    });
    assert.strictEqual(c1Change.status, 201, `Contractor 1 PIN change failed: ${JSON.stringify(c1Change.body)}`);
    c1Token = c1Change.body.token;
    console.log('✔ Contractor 1 successfully completed first-login PIN change.');
  } else {
    console.log('✔ Contractor 1 logged in successfully (credential change already completed).');
  }

  // Profile check
  const c1Profile = await request('/contractor/profile', {
    headers: { Authorization: `Bearer ${c1Token}` },
  });
  assert.strictEqual(c1Profile.status, 200, 'Failed to fetch Contractor 1 profile');
  const assignedSiteCodes1 = c1Profile.body.assignedSites.map((s) => s.siteCode);
  assert(assignedSiteCodes1.includes('SITE-TEST01'), 'SITE-TEST01 not in Contractor 1 assigned sites');
  console.log(`✔ Contractor 1 assigned sites: ${JSON.stringify(assignedSiteCodes1)}`);

  // Site statistics for SITE-TEST01
  const c1Stats = await request('/contractor/sites/SITE-TEST01/stats', {
    headers: { Authorization: `Bearer ${c1Token}` },
  });
  assert.strictEqual(c1Stats.status, 200, 'Failed to fetch Contractor 1 site stats');
  console.log('✔ Contractor 1 Site Statistics:');
  console.log(`    Total Workers:       ${c1Stats.body.totalWorkers} (Expected: 4)`);
  console.log(`    Positive:            ${c1Stats.body.positive} (Expected: 2)`);
  console.log(`    Negative:            ${c1Stats.body.negative} (Expected: 2)`);
  console.log(`    Awaiting Results:    ${c1Stats.body.awaitingResults} (Expected: 0)`);
  console.log(`    No Result Recorded:  ${c1Stats.body.noResultRecorded} (Expected: 0)`);
  assert.strictEqual(c1Stats.body.totalWorkers, 4);
  assert.strictEqual(c1Stats.body.positive, 2);
  assert.strictEqual(c1Stats.body.negative, 2);
  assert.strictEqual(c1Stats.body.awaitingResults, 0);
  assert.strictEqual(c1Stats.body.noResultRecorded, 0);

  // Workers list for SITE-TEST01
  const c1Workers = await request('/contractor/sites/SITE-TEST01/workers', {
    headers: { Authorization: `Bearer ${c1Token}` },
  });
  assert.strictEqual(c1Workers.status, 200, 'Failed to list workers for Contractor 1');
  assert.strictEqual(c1Workers.body.total, 4, `Expected 4 workers, got ${c1Workers.body.total}`);
  console.log(`✔ Contractor 1 lists all ${c1Workers.body.total} workers on SITE-TEST01.`);

  // Search by worker ID: M3-TEST01
  const c1Search = await request('/contractor/sites/SITE-TEST01/workers?search=M3-TEST01', {
    headers: { Authorization: `Bearer ${c1Token}` },
  });
  assert.strictEqual(c1Search.status, 200);
  assert.strictEqual(c1Search.body.items.length, 1);
  assert.strictEqual(c1Search.body.items[0].workerId, 'M3-TEST01');
  assert.strictEqual(c1Search.body.items[0].malariaStatus, 'POSITIVE');
  console.log(`✔ Contractor 1 searched M3-TEST01: found ${c1Search.body.items[0].name} (Status: POSITIVE)`);

  // Contractor 1 detail view & privacy check
  const c1WorkerDetail = await request('/contractor/workers/M3-TEST01', {
    headers: { Authorization: `Bearer ${c1Token}` },
  });
  assert.strictEqual(c1WorkerDetail.status, 200);
  assert.strictEqual(c1WorkerDetail.body.workerId, 'M3-TEST01');
  assert.strictEqual(c1WorkerDetail.body.malariaStatus, 'POSITIVE');
  // Privacy restrictions check: must NOT expose aadhaar, species, clinical prescriptions or notes
  assert.strictEqual(c1WorkerDetail.body.aadhaar, undefined, 'Aadhaar exposed!');
  assert.strictEqual(c1WorkerDetail.body.species, undefined, 'Species exposed!');
  assert.strictEqual(c1WorkerDetail.body.prescriptions, undefined, 'Prescriptions exposed!');
  assert.strictEqual(c1WorkerDetail.body.clinicalNotes, undefined, 'Clinical notes exposed!');
  console.log('✔ Contractor Privacy Rule Enforced: No Aadhaar, species, notes, or prescriptions exposed.');

  // --------------------------------------------------------------------------
  // Check 3: Contractor 2 (9000000102) Mobile Login & First-login PIN Change
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Contractor 2 (9000000102) Mobile Login ---');
  const c2Res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone: '9000000102', pin: '1234' }),
  });
  assert.strictEqual(c2Res.status, 201, `Contractor 2 login failed: ${JSON.stringify(c2Res.body)}`);
  assert.strictEqual(c2Res.body.role, 'CONTRACTOR', 'Contractor 2 role mismatch');
  let c2Token = c2Res.body.token;

  if (c2Res.body.credentialChangeRequired) {
    console.log('✔ Contractor 2 logged in successfully with first-login change enforced.');
    const c2Change = await request('/auth/change-credential', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c2Token}` },
      body: JSON.stringify({ newCredential: '1234', confirmCredential: '1234' }),
    });
    assert.strictEqual(c2Change.status, 201, `Contractor 2 PIN change failed: ${JSON.stringify(c2Change.body)}`);
    c2Token = c2Change.body.token;
    console.log('✔ Contractor 2 successfully completed first-login PIN change.');
  } else {
    console.log('✔ Contractor 2 logged in successfully (credential change already completed).');
  }

  // Profile check
  const c2Profile = await request('/contractor/profile', {
    headers: { Authorization: `Bearer ${c2Token}` },
  });
  assert.strictEqual(c2Profile.status, 200, 'Failed to fetch Contractor 2 profile');
  const assignedSiteCodes2 = c2Profile.body.assignedSites.map((s) => s.siteCode);
  assert(assignedSiteCodes2.includes('SITE-TEST01'), 'SITE-TEST01 not in Contractor 2 assigned sites');
  console.log(`✔ Contractor 2 assigned sites: ${JSON.stringify(assignedSiteCodes2)}`);

  // Site statistics for SITE-TEST01 (Must match Contractor 1)
  const c2Stats = await request('/contractor/sites/SITE-TEST01/stats', {
    headers: { Authorization: `Bearer ${c2Token}` },
  });
  assert.strictEqual(c2Stats.status, 200);
  assert.strictEqual(c2Stats.body.totalWorkers, 4);
  assert.strictEqual(c2Stats.body.positive, 2);
  assert.strictEqual(c2Stats.body.negative, 2);
  assert.strictEqual(c2Stats.body.awaitingResults, 0);
  assert.strictEqual(c2Stats.body.noResultRecorded, 0);
  console.log('✔ Contractor 2 sees identical aggregate site statistics (4 total: 2 pos, 2 neg).');

  // Workers list for SITE-TEST01
  const c2Workers = await request('/contractor/sites/SITE-TEST01/workers', {
    headers: { Authorization: `Bearer ${c2Token}` },
  });
  assert.strictEqual(c2Workers.status, 200);
  assert.strictEqual(c2Workers.body.total, 4);
  console.log(`✔ Contractor 2 lists all ${c2Workers.body.total} workers on SITE-TEST01.`);

  // Search by worker ID: M3-TEST03
  const c2Search = await request('/contractor/sites/SITE-TEST01/workers?search=M3-TEST03', {
    headers: { Authorization: `Bearer ${c2Token}` },
  });
  assert.strictEqual(c2Search.status, 200);
  assert.strictEqual(c2Search.body.items.length, 1);
  assert.strictEqual(c2Search.body.items[0].workerId, 'M3-TEST03');
  assert.strictEqual(c2Search.body.items[0].malariaStatus, 'NEGATIVE');
  console.log(`✔ Contractor 2 searched M3-TEST03: found ${c2Search.body.items[0].name} (Status: NEGATIVE)`);

  // Contractor Web Login Rejection
  const c1WebRes = await request('/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ username: '9000000101', password: '1234' }),
  });
  assert.strictEqual(c1WebRes.status, 403, 'Contractor web login should be rejected with 403');
  console.log(`✔ Contractor web login blocked: ${c1WebRes.body.message}`);

  // --------------------------------------------------------------------------
  // Check 4: Worker 1-4 Mobile Access & Security
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Worker Accounts Verification ---');
  const workerTests = [
    { code: 'M3-TEST01', phone: '9000000201', expectedStatus: 'POSITIVE' },
    { code: 'M3-TEST02', phone: '9000000202', expectedStatus: 'POSITIVE' },
    { code: 'M3-TEST03', phone: '9000000203', expectedStatus: 'NEGATIVE' },
    { code: 'M3-TEST04', phone: '9000000204', expectedStatus: 'NEGATIVE' },
  ];

  for (const wt of workerTests) {
    // 4.1 Mobile Login
    const wLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone: wt.phone, pin: '1234' }),
    });
    assert.strictEqual(wLogin.status, 201, `Worker ${wt.code} login failed`);
    assert.strictEqual(wLogin.body.user.role, 'WORKER');
    const wToken = wLogin.body.token;

    // 4.2 Profile & Diagnostic Status
    const wProfile = await request('/workers/me', {
      headers: { Authorization: `Bearer ${wToken}` },
    });
    assert.strictEqual(wProfile.status, 200);
    assert.strictEqual(wProfile.body.workerId, wt.code);
    assert.strictEqual(wProfile.body.malariaStatus, wt.expectedStatus);
    assert(wProfile.body.currentSite, 'Missing current site in worker profile');
    assert.strictEqual(wProfile.body.currentSite.siteId, 'SITE-TEST01');

    // 4.3 QR Worker Pass Generation
    const wPass = await request('/workers/me/pass/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${wToken}` },
    });
    assert.strictEqual(wPass.status, 201, `Failed to generate QR pass for ${wt.code}`);
    assert(wPass.body.token, 'Missing pass token');
    assert.strictEqual(wPass.body.workerCode, wt.code);

    // 4.4 QR Pass Status
    const wPassStatus = await request('/workers/me/pass/status', {
      headers: { Authorization: `Bearer ${wToken}` },
    });
    assert.strictEqual(wPassStatus.status, 200);
    assert(wPassStatus.body.activeToken, 'Expected active token in pass status');
    assert.strictEqual(wPassStatus.body.workerCode, wt.code);

    // 4.5 Worker Web Login BLOCKED
    const wWeb = await request('/auth/staff/login', {
      method: 'POST',
      body: JSON.stringify({ username: wt.phone, password: '1234' }),
    });
    assert.strictEqual(wWeb.status, 403, `Worker ${wt.code} web login should be rejected with 403`);

    console.log(`✔ Worker ${wt.code} (${wt.phone}): Mobile OK, Pass OK, Status: ${wt.expectedStatus}, Web Login Blocked.`);
  }

  // --------------------------------------------------------------------------
  // Check 5: Admin Management & Visibility
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Admin Management & Visibility ---');
  // Site details
  const adminSite = await request('/admin/sites/SITE-TEST01', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(adminSite.status, 200);
  assert.strictEqual(adminSite.body.siteId, 'SITE-TEST01');
  assert.strictEqual(adminSite.body.name, 'M3 Test Construction Site');
  assert.strictEqual(adminSite.body.assignedContractors.length, 2);
  assert.strictEqual(adminSite.body.linkedWorkers.length, 4);
  console.log(`✔ Admin Site View: ${adminSite.body.name} (${adminSite.body.siteId}) with 2 contractors & 4 linked workers.`);

  // Contractors list
  const adminContractors = await request('/admin/users?role=CONTRACTOR', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(adminContractors.status, 200);
  assert.strictEqual(adminContractors.body.items.length, 2);
  console.log(`✔ Admin Contractors View: ${adminContractors.body.items.length} contractors (C000001, C000002)`);

  // Workers list
  const adminWorkers = await request('/admin/workers', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(adminWorkers.status, 200);
  assert.strictEqual(adminWorkers.body.items.length, 4);
  console.log(`✔ Admin Workers View: ${adminWorkers.body.items.length} workers in database.`);

  // --------------------------------------------------------------------------
  // Check 6: Duplicate Account Prevention
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Duplicate Account Prevention ---');
  // Attempt duplicate worker phone registration
  const dupWorkerRes = await request('/auth/worker/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Duplicate Attempt',
      phone: '9000000201', // Already belongs to Worker 1
      pin: '9999',
    }),
  });
  assert.strictEqual(dupWorkerRes.status, 409, 'Expected 409 Conflict for duplicate worker phone');
  console.log(`✔ Duplicate worker registration rejected with 409: ${dupWorkerRes.body.message}`);

  // Attempt duplicate contractor phone registration
  const dupContractorRes = await request('/admin/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      fullName: 'Duplicate Contractor',
      phone: '9000000101', // Already belongs to Contractor 1
      role: 'CONTRACTOR',
      tempPin: '9999',
    }),
  });
  assert.strictEqual(dupContractorRes.status, 409, 'Expected 409 Conflict for duplicate contractor phone');
  console.log(`✔ Duplicate contractor creation rejected with 409: ${dupContractorRes.body.message}`);

  console.log('\n====================================================');
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

run().catch((e) => {
  console.error('\n❌ Verification Failed:', e);
  process.exit(1);
});
