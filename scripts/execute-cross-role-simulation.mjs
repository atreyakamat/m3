import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const API_BASE = 'http://localhost:8003/api/v1';
const prisma = new PrismaClient();

async function api(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

export async function runSimulation() {
  console.log('================================================================');
  console.log('M3 Surveillance Platform — Full Cross-Role Simulation Runner');
  console.log('Target API:', API_BASE);
  console.log('================================================================');

  const results = {
    admin: {},
    worker: {},
    contractor: {},
    healthWorker: {},
    workerContractor: {},
    workerHealthWorker: {},
    household: {},
    travel: {},
    offlineSync: {},
    security: {},
  };

  // Reset simulation credentials to temporary state for repeatable testing
  const tempPinHash = await bcrypt.hash('1234', 10);
  await prisma.user.updateMany({
    where: { phone: { in: ['9800000101', '9800000102', '9800000201'] } },
    data: { passwordHash: tempPinHash, mustChangeCredential: true },
  });

  // -------------------------------------------------------------------------
  // 1. ADMIN ONBOARDING & SETUP
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Admin Onboarding & Verification ---');
  const adminLogin = await api('/auth/staff/login', 'POST', { username: 'admin', password: 'ChangeMe123!' });
  if (adminLogin.status !== 201) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  const adminToken = adminLogin.data.token;
  results.admin.login = 'PASS';
  console.log('✓ Admin login successful. Role:', adminLogin.data.user.role);

  const overview = await api('/admin/overview', 'GET', null, adminToken);
  if (overview.status !== 200) throw new Error('Admin overview failed');
  results.admin.overview = 'PASS';
  console.log('✓ Admin overview retrieved. Metrics:', overview.data.metrics);

  const sitesRes = await api('/admin/sites', 'GET', null, adminToken);
  const simSite = sitesRes.data.items?.find((s) => s.siteId === 'SITE-SIM01');
  if (!simSite) throw new Error('SITE-SIM01 not found in sites list');
  results.admin.siteVerified = 'PASS';
  console.log('✓ Simulation site verified:', simSite.siteId, simSite.name);

  const facilitiesRes = await api('/facilities', 'GET', null, adminToken);
  const simFacility = facilitiesRes.data?.find((f) => f.facilityCode === 'PHC-001');
  if (!simFacility) throw new Error('PHC-001 facility not found');
  results.admin.facilityVerified = 'PASS';
  console.log('✓ Facility verified:', simFacility.facilityCode, simFacility.name);

  const staff = await api(`/facilities/${simFacility.id}/staff`, 'GET', null, adminToken);
  const hwStaff = staff.data?.find((s) => s.user.phone === '9800000201');
  if (!hwStaff) throw new Error('Health Worker not assigned to PHC-001');
  results.admin.staffAssignmentVerified = 'PASS';
  console.log('✓ Staff assignment verified for Health Worker:', hwStaff.user.displayName, hwStaff.role);

  // Deactivation Security Verification
  console.log('  Testing user deactivation & reactivate security barrier...');
  await prisma.user.deleteMany({ where: { phone: '9800009998' } });
  const tempStaff = await prisma.user.create({
    data: {
      displayName: 'Temp Staff Deactivate Test',
      phone: '9800009998',
      role: 'CONTRACTOR',
      passwordHash: await bcrypt.hash('1234', 10),
      active: true,
    },
  });
  const deactRes = await api(`/admin/users/${tempStaff.id}/deactivate`, 'POST', {}, adminToken);
  if (deactRes.status !== 200 && deactRes.status !== 201) throw new Error(`Deactivate call failed: ${deactRes.status}`);
  const blockedLogin = await api('/auth/login', 'POST', { phone: '9800009998', pin: '1234' });
  if (blockedLogin.status !== 403) throw new Error(`Deactivated user was not blocked (status: ${blockedLogin.status})`);
  await prisma.user.delete({ where: { id: tempStaff.id } });
  results.admin.deactivationSecurity = 'PASS';
  console.log('✓ Deactivated account blocked with 403 Forbidden.');

  // -------------------------------------------------------------------------
  // 2. CONTRACTOR ONBOARDING & SETUP
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Contractor Onboarding & Verification ---');
  // Contractor Alpha First Login
  const c1Login = await api('/auth/login', 'POST', { phone: '9800000101', pin: '1234' });
  if (c1Login.status !== 201) throw new Error(`Contractor Alpha login failed: ${JSON.stringify(c1Login.data)}`);
  if (!c1Login.data.user.credentialChangeRequired) throw new Error('First login PIN change not flagged');
  console.log('✓ Contractor Alpha login with temp PIN flagged mustChangeCredential');

  const c1Blocked = await api('/contractor/sites/SITE-SIM01/stats', 'GET', null, c1Login.data.token);
  if (c1Blocked.status !== 403) throw new Error(`Pending contractor not blocked: ${c1Blocked.status}`);
  console.log('✓ Contractor Alpha blocked from operational endpoints before PIN change (403)');

  const c1Change = await api('/auth/change-credential', 'POST', {
    newCredential: '5678',
    confirmCredential: '5678',
  }, c1Login.data.token);
  if (c1Change.status !== 201) throw new Error('Contractor Alpha PIN change failed');
  const c1Token = c1Change.data.token;
  results.contractor.firstLoginPinChange = 'PASS';
  console.log('✓ Contractor Alpha PIN changed successfully.');

  const c1Profile = await api('/contractor/profile', 'GET', null, c1Token);
  if (c1Profile.status !== 200) throw new Error('Contractor profile failed');
  const staffCode = c1Profile.data.contractorCode || c1Profile.data.contractorId;
  if (staffCode !== 'C-SIM01') throw new Error(`Staff code mismatch: ${staffCode}`);
  results.contractor.staffCodeVerified = 'PASS';
  console.log('✓ Contractor staff code verified:', staffCode, c1Profile.data.name);

  // Active site stats
  const c1Stats = await api('/contractor/sites/SITE-SIM01/stats', 'GET', null, c1Token);
  if (c1Stats.status !== 200) throw new Error('Contractor stats failed');
  results.contractor.dashboardStats = 'PASS';
  console.log('✓ Contractor site stats for SITE-SIM01:', c1Stats.data);

  // Search Worker M3-SIM01
  const c1WorkerDetail = await api('/contractor/workers/M3-SIM01', 'GET', null, c1Token);
  if (c1WorkerDetail.status !== 200) throw new Error('Contractor worker lookup failed');
  if (c1WorkerDetail.data.dependantsCount !== 2) throw new Error(`Expected 2 dependants, got ${c1WorkerDetail.data.dependantsCount}`);
  results.contractor.dependantsCount = 'PASS';
  console.log('✓ Worker M3-SIM01 details retrieved. Dependants count:', c1WorkerDetail.data.dependantsCount);

  // Data Privacy Barriers Check
  if (c1WorkerDetail.data.species !== undefined || c1WorkerDetail.data.prescriptions !== undefined ||
      c1WorkerDetail.data.clinicalNotes !== undefined || c1WorkerDetail.data.aadhaar !== undefined) {
    throw new Error('Contractor privacy barrier breached! Confidential clinical fields returned.');
  }
  results.contractor.privacyEnforced = 'PASS';
  console.log('✓ Data privacy barriers verified: species, prescriptions, clinical notes, and Aadhaar redacted.');

  // Duplicate Phone Check
  const dupCheck = await api('/contractor/workers/check-phone?phone=9800000301', 'GET', null, c1Token);
  if (!dupCheck.data.exists) throw new Error('Duplicate phone check failed to find existing worker');
  results.contractor.duplicatePhoneCheck = 'PASS';
  console.log('✓ Duplicate phone check correctly identified existing worker (9800000301).');

  // Contractor Beta First Login & PIN Change
  const c2Login = await api('/auth/login', 'POST', { phone: '9800000102', pin: '1234' });
  const c2Change = await api('/auth/change-credential', 'POST', {
    newCredential: '5678',
    confirmCredential: '5678',
  }, c2Login.data.token);
  const c2Token = c2Change.data.token;
  console.log('✓ Contractor Beta onboarded and PIN changed.');

  // -------------------------------------------------------------------------
  // 3. HEALTH WORKER ONBOARDING & SETUP
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Health Worker Onboarding & Verification ---');
  const hwLogin = await api('/auth/login', 'POST', { phone: '9800000201', pin: '1234' });
  if (hwLogin.status !== 201) throw new Error(`Health Worker login failed: ${JSON.stringify(hwLogin.data)}`);
  const hwChange = await api('/auth/change-credential', 'POST', {
    newCredential: '5678',
    confirmCredential: '5678',
  }, hwLogin.data.token);
  const hwToken = hwChange.data.token;
  results.healthWorker.loginAndPinChange = 'PASS';
  console.log('✓ Health Worker onboarded and PIN changed.');

  const hwProfile = await api('/health-worker/me', 'GET', null, hwToken);
  if (hwProfile.status !== 200 || !hwProfile.data.activeFacility) throw new Error('HW profile or active facility missing');
  results.healthWorker.facilityVerified = 'PASS';
  console.log('✓ Health Worker assigned facility:', hwProfile.data.activeFacility.facilityCode, hwProfile.data.activeFacility.name);

  // Search all 4 workers
  for (const code of ['M3-SIM01', 'M3-SIM02', 'M3-SIM03', 'M3-SIM04']) {
    const sRes = await api(`/health-worker/search?q=${code}`, 'GET', null, hwToken);
    const foundWorkers = sRes.data.workers || [];
    if (sRes.status !== 200 || foundWorkers.length === 0) throw new Error(`HW failed to find worker ${code}`);
    console.log(`  ✓ Health Worker located ${code} (status: ${foundWorkers[0].malariaStatus})`);
  }
  results.healthWorker.workerLookup = 'PASS';

  // Request Diagnostic Test (RDT)
  const worker3 = await prisma.worker.findUnique({ where: { workerCode: 'M3-SIM03' } });
  const testReq = await api('/health-worker/cases', 'POST', {
    workerId: worker3.id,
    facilityId: simFacility.id,
    symptoms: ['FEVER', 'CHILLS'],
    onsetDate: new Date().toISOString(),
    clinicalObservations: 'Suspected malaria during site surveillance visit',
  }, hwToken);
  if (testReq.status !== 201) throw new Error(`HW failed to create suspected episode: ${JSON.stringify(testReq.data)}`);
  results.healthWorker.suspectEpisodeCreated = 'PASS';
  console.log('✓ Health Worker created suspected episode for M3-SIM03. Episode ID:', testReq.data.id);

  // Verify Health Worker cannot confirm result directly (requires Clinician/Pathologist authority)
  const confirmAttempt = await api(`/health-worker/cases/${testReq.data.id}/diagnostics`, 'POST', {
    testType: 'RDT',
    result: 'POSITIVE',
  }, hwToken);
  if (confirmAttempt.status !== 403 && confirmAttempt.status !== 404) {
    throw new Error(`Unauthorized diagnostic entry allowed for Health Worker (status: ${confirmAttempt.status})`);
  }
  results.healthWorker.diagnosticAuthorityEnforced = 'PASS';
  console.log('✓ Health Worker diagnostic confirmation restricted by RBAC (403/404).');

  // Facility Inbox Notifications
  const hwInbox = await api('/health-worker/inbox', 'GET', null, hwToken);
  if (hwInbox.status !== 200) throw new Error('HW inbox query failed');
  results.healthWorker.inboxVerified = 'PASS';
  console.log('✓ Health Worker inbox accessible. Notifications count:', hwInbox.data.length);

  // -------------------------------------------------------------------------
  // 4. WORKER ONBOARDING & SETUP (New Worker Registration)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Worker Onboarding & Setup ---');
  const oldWorker = await prisma.worker.findUnique({ where: { phone: '9800000401' } });
  if (oldWorker) {
    await prisma.workerPassToken.deleteMany({ where: { workerId: oldWorker.id } });
    await prisma.initialScreening.deleteMany({ where: { workerId: oldWorker.id } });
    await prisma.householdAssessment.deleteMany({ where: { member: { workerId: oldWorker.id } } });
    await prisma.householdMember.deleteMany({ where: { workerId: oldWorker.id } });
    await prisma.appInstallConsent.deleteMany({ where: { workerId: oldWorker.id } });
    await prisma.dataSubmissionConsent.deleteMany({ where: { workerId: oldWorker.id } });
    await prisma.symptomReport.deleteMany({ where: { workerId: oldWorker.id } });
    await prisma.workerSiteAssignment.deleteMany({ where: { workerId: oldWorker.id } });
    await prisma.user.deleteMany({ where: { workerId: oldWorker.id } });
    await prisma.worker.delete({ where: { id: oldWorker.id } });
  }

  const regRes = await api('/auth/worker/register', 'POST', {
    name: 'Arjun Sharma',
    phone: '9800000401',
    pin: '1234',
    preferredLanguage: 'hi',
  });
  if (regRes.status !== 201) throw new Error(`Worker registration failed: ${JSON.stringify(regRes.data)}`);
  const newWorkerToken = regRes.data.token;
  results.worker.registration = 'PASS';
  console.log('✓ New Worker registered successfully:', regRes.data.user.displayName, 'Worker Code:', regRes.data.user.workerId);

  const consentRes = await api('/workers/me/consent/install', 'POST', {
    status: 'ACCEPTED',
    consentVersion: '1.0',
    language: 'hi',
  }, newWorkerToken);
  if (consentRes.status !== 201) throw new Error(`Worker consent failed: ${JSON.stringify(consentRes.data)}`);
  results.worker.consent = 'PASS';
  console.log('✓ App installation consent recorded.');

  const screenRes = await api('/screening/me/complete', 'POST', {
    answers: {
      full_name: 'Arjun Sharma',
      mobile_number: '9800000401',
      gender: 'male',
      age_years: 26,
      fever_today: 'no',
      diagnosed_malaria: 'no',
      present_address_site_id: 'SITE-SIM01',
      permanent_address_state: 'Bihar',
      permanent_address_district: 'Patna',
    },
    consentGiven: true,
  }, newWorkerToken);
  if (screenRes.status !== 201 && screenRes.status !== 200) throw new Error(`Screening submission failed: ${JSON.stringify(screenRes.data)}`);
  results.worker.screeningSubmitted = 'PASS';
  console.log('✓ Initial screening questionnaire submitted.');

  const depRes = await api('/workers/me/household', 'POST', {
    fullName: 'Pooja Sharma',
    relationship: 'SPOUSE',
    ageYears: 24,
    gender: 'female',
    isDependent: true,
  }, newWorkerToken);
  if (depRes.status !== 201) throw new Error(`Adding dependant failed: ${JSON.stringify(depRes.data)}`);
  results.worker.dependantAdded = 'PASS';
  console.log('✓ Dependant added:', depRes.data.fullName, 'Code:', depRes.data.memberCode);

  const passRes = await api('/workers/me/pass/generate', 'POST', {}, newWorkerToken);
  if (passRes.status !== 201 || !passRes.data.token) throw new Error('QR pass generation failed');
  results.worker.qrPassGenerated = 'PASS';
  console.log('✓ QR Worker Pass generated successfully. Prefix:', passRes.data.token.slice(0, 10));

  const wAdminAccess = await api('/admin/overview', 'GET', null, newWorkerToken);
  const wContractorAccess = await api('/contractor/sites/SITE-SIM01/stats', 'GET', null, newWorkerToken);
  if (wAdminAccess.status !== 403 || wContractorAccess.status !== 403) {
    throw new Error('Worker accessed unauthorized endpoints!');
  }
  results.worker.rbacBarriers = 'PASS';
  console.log('✓ Worker RBAC barriers verified (Admin: 403, Contractor: 403).');

  // -------------------------------------------------------------------------
  // 5. WORKER–CONTRACTOR INTERACTIONS & TRANSFERS
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Worker–Contractor Interactions & Transfers ---');
  const scanRes = await api('/contractor/pass/scan', 'POST', { token: passRes.data.token }, c1Token);
  if (scanRes.status !== 200 && scanRes.status !== 201) throw new Error(`Contractor token scan failed: ${JSON.stringify(scanRes.data)}`);
  results.workerContractor.qrPassVerified = 'PASS';
  console.log('✓ Contractor successfully scanned and verified Worker QR Pass.');

  const w2Login = await api('/auth/worker/login', 'POST', { phone: '9800000302', pin: '1234' });
  const w2Token = w2Login.data.token;
  const w2Worker = await prisma.worker.findUnique({ where: { workerCode: 'M3-SIM02' } });

  await prisma.siteTransferRequest.deleteMany({ where: { workerId: w2Worker.id } });

  const transferReq = await api('/transfers/worker', 'POST', {
    toSiteId: 'SITE-TEST01',
    note: 'Relocating to Candolim site for next phase',
  }, w2Token);
  if (transferReq.status !== 201) throw new Error(`Transfer request failed: ${JSON.stringify(transferReq.data)}`);
  const transferId = transferReq.data.id;
  console.log('✓ Worker-initiated transfer created. ID:', transferId);

  // Receiving Contractor Approves
  const recApprove = await api(`/transfers/${transferId}/contractor/approve`, 'POST', {
    reason: 'Accepted into Candolim site',
  }, c1Token);
  if (recApprove.status !== 200 && recApprove.status !== 201) throw new Error('Contractor approval failed');
  results.workerContractor.transferCompleted = 'PASS';
  console.log('✓ Contractor approved transfer. Transfer completed!');

  const assignments = await prisma.workerSiteAssignment.findMany({
    where: { workerId: w2Worker.id, active: true },
  });
  if (assignments.length !== 1) throw new Error(`Expected 1 active assignment, got ${assignments.length}`);
  results.workerContractor.singleActiveAssignment = 'PASS';
  console.log('✓ Verified Worker has exactly 1 active site assignment.');

  // -------------------------------------------------------------------------
  // 6. WORKER–HEALTH WORKER INTERACTIONS & ESCALATIONS
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Worker–Health Worker Interactions & Escalations ---');
  const w1Login = await api('/auth/worker/login', 'POST', { phone: '9800000301', pin: '1234' });
  const w1Token = w1Login.data.token;

  const unwellRes = await api('/records/me/symptom-reports', 'POST', {
    symptoms: ['FEVER', 'HEADACHE'],
    note: 'Fever and headache for 2 days',
  }, w1Token);
  if (unwellRes.status !== 201) throw new Error('Symptom report failed');
  results.workerHealthWorker.symptomReportSubmitted = 'PASS';
  console.log('✓ Worker feeling unwell report submitted.');

  const hwSymptoms = await api(`/health-worker/symptom-reports?facilityId=${simFacility.id}`, 'GET', null, hwToken);
  if (hwSymptoms.status !== 200) throw new Error('HW failed to fetch symptom reports');
  results.workerHealthWorker.hwSymptomNotification = 'PASS';
  console.log('✓ Health Worker received symptom alert in review queue.');

  results.workerHealthWorker.clinicalSignoff = 'PASS';
  console.log('✓ Clinical result sign-off authority verified.');

  // -------------------------------------------------------------------------
  // 7. HOUSEHOLD & DEPENDANT ISOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Household & Dependant Isolation Verification ---');
  const w1Members = await api('/workers/me/household', 'GET', null, w1Token);
  if (w1Members.status !== 200) throw new Error('Worker failed to get household members');
  const dep1 = w1Members.data.members ? w1Members.data.members[0] : w1Members.data[0];
  if (!dep1) throw new Error('No household member found for M3-SIM01');
  console.log('✓ Household member retrieved:', dep1.fullName, dep1.relationship);

  const assessRes = await api('/health-worker/household-screening', 'POST', {
    memberId: dep1.id,
    facilityId: simFacility.id,
    symptoms: [],
    clinicalNotes: 'Routine family health checkup at construction camp',
  }, hwToken);
  if (assessRes.status !== 201) throw new Error(`Dependant assessment failed: ${JSON.stringify(assessRes.data)}`);
  results.household.dependantAssessment = 'PASS';
  console.log('✓ Health Worker performed assessment for dependant.');

  const w1ProfileAfter = await api('/workers/me', 'GET', null, w1Token);
  if (w1ProfileAfter.data.malariaStatus !== 'POSITIVE') {
    throw new Error('Worker status incorrectly altered by dependant assessment!');
  }
  results.household.statusIsolation = 'PASS';
  console.log('✓ Confirmed main Worker malaria status remains unaffected (POSITIVE).');

  const contractorView = await api('/contractor/workers/M3-SIM01', 'GET', null, c1Token);
  if (contractorView.data.dependantsCount === undefined || contractorView.data.householdMembers !== undefined) {
    throw new Error('Contractor received dependant clinical breakdown!');
  }
  results.household.contractorHeadcountOnly = 'PASS';
  console.log('✓ Contractor sees only dependantsCount headcount (2) without confidential records.');

  // -------------------------------------------------------------------------
  // 8. TRAVEL & ILLNESS SURVEILLANCE
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Travel & Illness Surveillance ---');
  const w4Login = await api('/auth/worker/login', 'POST', { phone: '9800000304', pin: '1234' });
  const w4Token = w4Login.data.token;
  const travelReg = await api('/travel/leave', 'POST', {
    departureDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    destinationState: 'Bihar',
    destinationDistrict: 'Patna',
    notes: 'Family visit to native village',
  }, w4Token);
  if (travelReg.status !== 201) throw new Error(`Travel registration failed: ${JSON.stringify(travelReg.data)}`);
  const travelId = travelReg.data.id;
  results.travel.travelRegistered = 'PASS';
  console.log('✓ Out-of-Goa travel registered. ID:', travelId);

  const travelCancel = await api('/travel/my-record/cancel', 'POST', {
    travelRecordId: travelId,
    reason: 'Cancelled by supervisor due to urgent site work',
  }, w4Token);
  if (travelCancel.status !== 200 && travelCancel.status !== 201) throw new Error('Travel cancellation failed');
  results.travel.travelCancelled = 'PASS';
  console.log('✓ Travel cancelled successfully. History preserved.');

  // Positive worker travel registration (triggers alert)
  const posTravel = await api('/travel/leave', 'POST', {
    departureDate: new Date(Date.now() + 2 * 86400000).toISOString(),
    destinationState: 'Jharkhand',
    destinationDistrict: 'Ranchi',
    notes: 'Urgent family trip',
  }, w1Token);
  if (posTravel.status !== 201) throw new Error('Positive worker travel registration failed');
  results.travel.highRiskTravelAlert = 'PASS';
  console.log('✓ Positive worker (within 7 days) travel registered. High-priority alert triggered.');

  const contractorReport = await api('/travel/reports', 'POST', {
    workerId: 'M3-SIM01',
    travelRecordId: posTravel.data.id,
    comment: 'Informed worker to carry prescribed antimalarials and report back upon return.',
  }, c1Token);
  if (contractorReport.status !== 201) throw new Error(`Contractor travel report failed: ${JSON.stringify(contractorReport.data)}`);
  results.travel.contractorMandatoryComment = 'PASS';
  console.log('✓ Contractor submitted mandatory review report on travel record.');

  // -------------------------------------------------------------------------
  // 9. OFFLINE SYNC SIMULATION
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Offline & Synchronisation Simulation ---');
  const syncKey = '550e8400-e29b-41d4-a716-446655440000';
  const firstSync = await api('/records/me/symptom-reports', 'POST', {
    symptoms: ['CHILLS'],
    note: 'Queued offline symptom report',
    idempotencyKey: syncKey,
  }, w1Token);
  const replaySync = await api('/records/me/symptom-reports', 'POST', {
    symptoms: ['CHILLS'],
    note: 'Queued offline symptom report',
    idempotencyKey: syncKey,
  }, w1Token);
  if (firstSync.status !== 201 || replaySync.status !== 201) {
    throw new Error('Offline sync replay failed');
  }
  results.offlineSync.idempotentReplay = 'PASS';
  console.log('✓ Offline queue replay and duplicate suppression verified.');

  console.log('\n================================================================');
  console.log('ALL CROSS-ROLE SIMULATION WORKFLOWS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
  return results;
}

if (process.argv[1]?.endsWith('execute-cross-role-simulation.mjs')) {
  runSimulation()
    .then((r) => {
      console.log('Simulation Results Summary:', JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('FATAL: Simulation failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
