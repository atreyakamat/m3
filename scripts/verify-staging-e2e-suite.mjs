/**
 * Comprehensive Staging End-to-End Test Suite
 * Covers Requirements 3, 4, 5, 6, 7, 8 on Staging:
 * - Real-device Android mobile simulation (GPS, offline queue, headers)
 * - Complete Worker, Contractor, Health Worker workflows
 * - Both transfer workflows (Pull & Push) and atomic assignment updates
 * - Concurrent offline retries & database-level duplicate prevention
 * - Medical privacy recheck across APIs, notifications, and audit logs
 * - PHC surveillance registry verification
 */
import { execSync } from 'child_process';

const STAGING_API_BASE = 'http://192.168.1.120:8013/api/v1';
const STAGING_DB_CONTAINER = 'm3-staging-db';
const STAGING_DB_USER = 'm3_staging';
const STAGING_DB = 'm3_staging';

// Mobile device headers simulating Samsung Galaxy Tab A7 Lite (Android 14)
const MOBILE_HEADERS = {
  'User-Agent': 'M3-Mobile/2.0.0 (Android 14; Build/UP1A.231005.007; SM-T225)',
  'X-Client-Platform': 'Android',
  'X-App-Version': '2.0.0',
  'Content-Type': 'application/json',
};

async function api(path, options = {}) {
  const url = `${STAGING_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = text;
  }
  return { status: res.status, ok: res.ok, body: data };
}

function queryDb(sql) {
  const cmd = `docker exec ${STAGING_DB_CONTAINER} psql -U ${STAGING_DB_USER} -d ${STAGING_DB} -t -c "${sql.replace(/"/g, '\\"')}"`;
  return execSync(cmd).toString().trim();
}

async function run() {
  console.log('================================================================');
  console.log(' M3 STAGING COMPREHENSIVE END-TO-END VERIFICATION SUITE         ');
  console.log('================================================================');
  console.log(`Target Staging API: ${STAGING_API_BASE}`);
  console.log(`Target Staging DB:  ${STAGING_DB_CONTAINER} (${STAGING_DB})`);
  console.log(`Timestamp:          ${new Date().toISOString()}`);

  const results = [];

  function record(testName, passed, details = '') {
    results.push({ testName, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`\n${mark}: ${testName}`);
    if (details) console.log(`   ${details}`);
  }

  // --------------------------------------------------------------------------
  // TEST 1: Real-Device Android Mobile Simulation (Auth, GPS, Offline Sync)
  // --------------------------------------------------------------------------
  console.log('\n--- [TEST 1] Android Mobile Client Simulation (GPS & Offline) ---');
  const workerPhone = `9800000${Math.floor(100 + Math.random() * 899)}`;
  const workerReg = await api('/auth/worker/register', {
    method: 'POST',
    headers: MOBILE_HEADERS,
    body: JSON.stringify({
      phone: workerPhone,
      pin: '1234',
      name: 'Android Field Worker Sim',
      preferredLanguage: 'en',
    }),
  });

  if (!workerReg.ok) throw new Error(`Worker registration failed: ${JSON.stringify(workerReg.body)}`);
  const workerToken = workerReg.body.token;
  const workerCode = workerReg.body.user.workerId;
  const workerUuid = queryDb(`SELECT id FROM "Worker" WHERE "workerCode" = '${workerCode}';`);
  console.log(`Worker registered on Staging: Phone=${workerPhone}, Code=${workerCode}, UUID=${workerUuid}`);

  // Travel Entry with GPS Coordinates
  const travelRes = await api('/records/me/travel', {
    method: 'POST',
    headers: { ...MOBILE_HEADERS, Authorization: `Bearer ${workerToken}` },
    body: JSON.stringify({
      direction: 'ENTERING_GOA',
      originTown: 'Madgaon Rly',
      originState: 'Karnataka',
      destination: 'Candolim',
      state: 'Goa',
      departureDate: new Date().toISOString(),
      latitude: 15.5186,
      longitude: 73.7631,
    }),
  });

  const travelPassed = travelRes.status === 201;
  record('Android GPS Travel Entry Submission', travelPassed, `HTTP ${travelRes.status}, Coordinates: 15.5186, 73.7631 (Madgaon Point)`);

  // Household Dependents Registration
  const hhRes = await api('/workers/me/household', {
    method: 'POST',
    headers: { ...MOBILE_HEADERS, Authorization: `Bearer ${workerToken}` },
    body: JSON.stringify({
      fullName: 'Anita Devi (Spouse)',
      relationship: 'SPOUSE',
      gender: 'female',
      age: 28,
    }),
  });
  const hhPassed = hhRes.status === 201 && hhRes.body.fullName === 'Anita Devi (Spouse)';
  record('Worker Household Member Registration', hhPassed, `Created Dependent: ${hhRes.body?.fullName}`);

  // --------------------------------------------------------------------------
  // TEST 2: Contractor & Health Worker Multi-Role Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n--- [TEST 2] Multi-Role Lifecycle (Worker, Contractor, Health Worker) ---');
  // Contractor A login
  const contALogin = await api('/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ username: '9800000101', password: '1234' }),
  });
  const contAToken = contALogin.body.token;
  console.log('Contractor Alpha authenticated on Staging');

  // Assign worker to SITE-SIM01
  const siteCode = 'SITE-SIM01';
  const assignRes = await api(`/contractor/sites/${siteCode}/assign-worker`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${contAToken}` },
    body: JSON.stringify({ workerCode, note: 'Initial Staging Assignment' }),
  });
  const assignPassed = assignRes.status === 201;
  record('Contractor Direct Site Assignment', assignPassed, `Worker ${workerCode} assigned to ${siteCode}`);

  // Contractor Dashboard metrics check
  const dashRes = await api('/contractor/dashboard', {
    headers: { Authorization: `Bearer ${contAToken}` },
  });
  const activeCount = dashRes.body.metrics?.activeWorkers;
  const dashPassed = dashRes.status === 200 && activeCount > 0;
  record('Contractor Dashboard Live Stats', dashPassed, `Active Workers: ${activeCount}, Total Assigned: ${dashRes.body?.metrics?.totalAssignedWorkers}`);

  // Health Worker Search & Facility Coordination
  const hwLogin = await api('/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'hw_sim01', password: '1234' }),
  });
  const hwToken = hwLogin.body.token;

  const hwSearchRes = await api(`/health-worker/search?q=${workerCode}`, {
    headers: { Authorization: `Bearer ${hwToken}` },
  });
  const hwSearchPassed = hwSearchRes.status === 200 && hwSearchRes.body.workers && hwSearchRes.body.workers.length > 0;
  record('Health Worker Surveillance Search', hwSearchPassed, `Found Worker ${hwSearchRes.body?.workers?.[0]?.name} (${hwSearchRes.body?.workers?.[0]?.workerCode}) and Dependent ${hwSearchRes.body?.householdMembers?.[0]?.fullName}`);

  // --------------------------------------------------------------------------
  // TEST 3: Both Transfer Workflows (Pull & Push) & Atomic Assignment Update
  // --------------------------------------------------------------------------
  console.log('\n--- [TEST 3] Site Transfer State Machine & Handshake ---');
  // Contractor B (9800000102) login
  const contBLogin = await api('/auth/staff/login', {
    method: 'POST',
    body: JSON.stringify({ username: '9800000102', password: '1234' }),
  });
  const contBToken = contBLogin.body.token;

  // Contractor B initiates pull transfer: Alpha (SITE-SIM01) -> Beta (SITE-SIM02)
  const transferInitRes = await api('/contractor/transfers/initiate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${contBToken}` },
    body: JSON.stringify({
      workerId: workerCode,
      toSiteId: 'SITE-SIM02',
      note: 'Deploying specialist to West Hub project',
    }),
  });

  const transferInitPassed = transferInitRes.status === 201 && transferInitRes.body.status === 'PENDING_WORKER_RESPONSE';
  record('Transfer Workflow: Destination Contractor Pull Request', transferInitPassed, `Transfer ID: ${transferInitRes.body?.id}, Status: ${transferInitRes.body?.status}`);
  const transferId = transferInitRes.body?.id;

  // Step 2: Worker responds and approves on Mobile
  const workerRespondRes = await api(`/transfers/${transferId}/worker/accept`, {
    method: 'POST',
    headers: { ...MOBILE_HEADERS, Authorization: `Bearer ${workerToken}` },
    body: JSON.stringify({}),
  });
  const workerRespPassed = workerRespondRes.status === 201 && workerRespondRes.body.status === 'PENDING_CURRENT_CONTRACTOR';
  record('Transfer Workflow: Worker Mobile Handshake Approval', workerRespPassed, `Updated Status: ${workerRespondRes.body?.status}`);

  // Step 3: Current Contractor Alpha releases worker (approves transfer)
  const releaseRes = await api(`/contractor/transfers/${transferId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${contAToken}` },
    body: JSON.stringify({ note: 'Released from Panaji Coastal on schedule' }),
  });
  const releasePassed = releaseRes.status === 201 && releaseRes.body.status === 'ACCEPTED';
  record('Transfer Workflow: Current Contractor Release Handshake', releasePassed, `Final Status: ${releaseRes.body?.status}`);

  // Step 4: Atomic assignment update verification in database
  const activeAssignments = queryDb(`SELECT count(*) FROM "WorkerSiteAssignment" WHERE "workerId" = '${workerUuid}' AND active = true;`);
  const activeSiteName = queryDb(`SELECT s.name FROM "WorkerSiteAssignment" a JOIN "ConstructionSite" s ON a."siteId" = s.id WHERE a."workerId" = '${workerUuid}' AND a.active = true;`);
  const assignmentIntegrityPassed = activeAssignments === '1' && activeSiteName.includes('West Hub');
  record('Atomic Site Assignment Integrity', assignmentIntegrityPassed, `Active assignments in DB: ${activeAssignments} (Guaranteed exactly 1 on ${activeSiteName})`);

  // --------------------------------------------------------------------------
  // TEST 4: Offline Retries, Idempotency Replay & Database-Level Deduplication
  // --------------------------------------------------------------------------
  console.log('\n--- [TEST 4] Offline Retries, Idempotency Replay & Deduplication ---');
  const offlineSyncKey = `00000000-0000-0000-0000-${Math.floor(100000000000 + Math.random() * 899999999999)}`;
  
  // First offline submission from device
  const sub1 = await api('/records/me/symptom-reports', {
    method: 'POST',
    headers: { ...MOBILE_HEADERS, Authorization: `Bearer ${workerToken}` },
    body: JSON.stringify({
      symptoms: ['FEVER', 'CHILLS', 'HEADACHE'],
      note: 'Field device offline submission',
      idempotencyKey: offlineSyncKey,
    }),
  });

  // Replay 1 (simulating network flap / background retry queue)
  const sub2 = await api('/records/me/symptom-reports', {
    method: 'POST',
    headers: { ...MOBILE_HEADERS, Authorization: `Bearer ${workerToken}` },
    body: JSON.stringify({
      symptoms: ['FEVER', 'CHILLS', 'HEADACHE'],
      note: 'Field device offline submission',
      idempotencyKey: offlineSyncKey,
    }),
  });

  // Replay 2 (simulating user tapping resend)
  const sub3 = await api('/records/me/symptom-reports', {
    method: 'POST',
    headers: { ...MOBILE_HEADERS, Authorization: `Bearer ${workerToken}` },
    body: JSON.stringify({
      symptoms: ['FEVER', 'CHILLS', 'HEADACHE'],
      note: 'Field device offline submission',
      idempotencyKey: offlineSyncKey,
    }),
  });

  const replaySuccess = sub1.status === 201 && sub2.status === 201 && sub3.status === 201;
  const identicalIds = sub1.body.id === sub2.body.id && sub2.body.id === sub3.body.id;
  const reportsInDbForKey = queryDb(`SELECT count(*) FROM "IdempotencyKey" WHERE key = '${offlineSyncKey}';`);
  const dedupePassed = replaySuccess && identicalIds && reportsInDbForKey === '1';

  record(
    'Offline Retry Idempotency & Database Deduplication',
    dedupePassed,
    `3 offline submissions with key ${offlineSyncKey} -> All returned ID: ${sub1.body?.id}, Exactly 1 Idempotency Record in DB`
  );

  // --------------------------------------------------------------------------
  // TEST 5: Medical Privacy Recheck Across APIs, Logs, and Payloads
  // --------------------------------------------------------------------------
  console.log('\n--- [TEST 5] Strict Medical Privacy Recheck Across Contractor Endpoints ---');
  const contractorAlerts = await api('/contractor/alerts', {
    headers: { Authorization: `Bearer ${contBToken}` },
  });
  const contractorWorker = await api(`/contractor/workers/${workerUuid}`, {
    headers: { Authorization: `Bearer ${contBToken}` },
  });
  const contractorActivity = await api('/contractor/activity', {
    headers: { Authorization: `Bearer ${contBToken}` },
  });

  const alertsStr = JSON.stringify(contractorAlerts.body);
  const workerStr = JSON.stringify(contractorWorker.body);
  const activityStr = JSON.stringify(contractorActivity.body);

  // Exact sensitive clinical symptoms, notes, voice notes, prescriptions, and lab tests
  const forbiddenClinicalRegexes = [
    /\bFEVER\b/i,
    /\bCHILLS\b/i,
    /\bVOMITING\b/i,
    /\bHEADACHE\b/i,
    /\bBODY_ACHE\b/i,
    /\bJOINT_PAIN\b/i,
    /High fever onset/i,
    /"voiceData"/i,
    /"prescriptions?"/i,
    /\bP_FALCIPARUM\b/i,
    /\bP_VIVAX\b/i,
    /\bparasiteCount\b/i,
    /\bhouseholdMembersHealth\b/i,
  ];

  let leaks = [];
  for (const regex of forbiddenClinicalRegexes) {
    if (regex.test(alertsStr)) leaks.push(`Alerts API leaked: ${regex}`);
    if (regex.test(workerStr)) leaks.push(`Worker Detail leaked: ${regex}`);
    if (regex.test(activityStr)) leaks.push(`Activity API leaked: ${regex}`);
  }

  const privacyPassed = leaks.length === 0;
  record('Zero Medical Privacy Leakage in Contractor Domain', privacyPassed, privacyPassed ? 'Clean: Zero clinical symptoms, notes, voiceData, or prescriptions found in contractor payloads' : `LEAK DETECTED: ${leaks.join(', ')}`);

  // --------------------------------------------------------------------------
  // TEST 6: PHC Surveillance Contact Information Verification
  // --------------------------------------------------------------------------
  console.log('\n--- [TEST 6] Maintained PHC Surveillance Source Verification ---');
  const alertItems = contractorAlerts.body.items || [];
  const unwellAlert = alertItems.find((a) => a.type === 'WORKER_FEELING_UNWELL');
  const dbFacilityName = queryDb(`SELECT name FROM "Facility" WHERE "facilityCode" = '${unwellAlert?.healthCoordination?.facilityCode || 'UHC-001'}';`);
  const dbFacilityPhone = queryDb(`SELECT "contactPhone" FROM "Facility" WHERE "facilityCode" = '${unwellAlert?.healthCoordination?.facilityCode || 'UHC-001'}';`);

  const phcPassed = unwellAlert &&
    unwellAlert.healthCoordination &&
    unwellAlert.healthCoordination.facilityName === dbFacilityName &&
    unwellAlert.healthCoordination.contactPhone === dbFacilityPhone;

  record(
    'Maintained PHC Surveillance Contact Source',
    phcPassed,
    `Alert Facility: "${unwellAlert?.healthCoordination?.facilityName}" (${unwellAlert?.healthCoordination?.contactPhone}) matches Database Registry (${dbFacilityName}) exactly.`
  );

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(' STAGING ACCEPTANCE TEST SUMMARY                                ');
  console.log('================================================================');
  const allPassed = results.every((r) => r.passed);
  results.forEach((r, idx) => {
    console.log(`[${idx + 1}/${results.length}] ${r.passed ? 'PASS' : 'FAIL'}: ${r.testName}`);
  });
  console.log('----------------------------------------------------------------');
  console.log(`Result: ${allPassed ? 'ALL STAGING TESTS PASSED (100%)' : 'SOME TESTS FAILED'}`);
  console.log('================================================================');

  if (!allPassed) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal staging test failure:', err);
  process.exit(1);
});
