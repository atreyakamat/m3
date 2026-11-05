const API_BASE = 'http://localhost:8003/api/v1';

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function get(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function run() {
  console.log('=== Starting Mobile & Backend Security RBAC Tests ===\n');

  // 1. Mobile App Tests: Permitted Mobile Logins
  console.log('--- 1. Worker Mobile Login ---');
  const workerLogin = await post('/auth/login', { phone: '9000000201', pin: '1234' });
  console.log('Worker login status:', workerLogin.status, 'role:', workerLogin.data?.user?.role);
  if (workerLogin.status !== 201 || workerLogin.data?.user?.role !== 'WORKER') {
    throw new Error('Worker mobile login failed');
  }

  console.log('\n--- 2. Worker Mobile Registration ---');
  const tempPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
  const workerReg = await post('/auth/worker/register', {
    name: 'New Mobile Worker',
    phone: tempPhone,
    pin: '1234',
    preferredLanguage: 'en',
  });
  console.log('Worker registration status:', workerReg.status, 'workerCode:', workerReg.data?.user?.workerId);
  if (workerReg.status !== 201 || workerReg.data?.user?.role !== 'WORKER') {
    throw new Error('Worker registration failed');
  }

  console.log('\n--- 3. Contractor Mobile Login ---');
  const contractorLogin = await post('/auth/login', { phone: '9000000101', pin: '1234' });
  console.log('Contractor login status:', contractorLogin.status, 'role:', contractorLogin.data?.user?.role);
  if (contractorLogin.status !== 201 || contractorLogin.data?.user?.role !== 'CONTRACTOR') {
    throw new Error('Contractor mobile login failed');
  }

  console.log('\n--- 4. Health Worker Mobile Login ---');
  const hwLogin = await post('/auth/login', { phone: '9000000401', pin: 'password123' });
  console.log('Health Worker login status:', hwLogin.status, 'role:', hwLogin.data?.user?.role);
  if (hwLogin.status !== 201 || hwLogin.data?.user?.role !== 'HEALTH_WORKER') {
    throw new Error('Health Worker mobile login failed');
  }

  console.log('\n--- 5. Clinician Mobile Login ---');
  const clinLogin = await post('/auth/login', { phone: '9000000402', pin: 'password123' });
  console.log('Clinician login status:', clinLogin.status, 'role:', clinLogin.data?.user?.role);
  if (clinLogin.status !== 201 || clinLogin.data?.user?.role !== 'CLINICIAN') {
    throw new Error('Clinician mobile login failed');
  }

  console.log('\n--- 6. Lab Technician (Pathologist) Mobile Login ---');
  const labLogin = await post('/auth/login', { phone: '9000000403', pin: 'password123' });
  console.log('Lab Tech login status:', labLogin.status, 'role:', labLogin.data?.user?.role);
  if (labLogin.status !== 201 || labLogin.data?.user?.role !== 'PATHOLOGIST') {
    throw new Error('Lab Tech mobile login failed');
  }

  console.log('\n--- 7. Research Lab Mobile Login ---');
  const rlLogin = await post('/auth/login', { phone: '9000000404', pin: 'password123' });
  console.log('Research Lab login status:', rlLogin.status, 'role:', rlLogin.data?.user?.role);
  if (rlLogin.status !== 201 || rlLogin.data?.user?.role !== 'RESEARCH_LAB') {
    throw new Error('Research Lab mobile login failed');
  }

  console.log('\n--- 8. Admin Mobile Login REJECTED ---');
  const adminMobile = await post('/auth/login', { phone: 'admin', pin: 'admin' });
  console.log('Admin mobile login status:', adminMobile.status, 'message:', adminMobile.data?.message);
  if (adminMobile.status !== 403 || !adminMobile.data?.message?.includes('Admin accounts can only access the M3 web portal')) {
    throw new Error('Admin mobile login was not rejected with 403 Forbidden!');
  }

  console.log('\n--- 9. Worker Mobile Pass Generation & Sync ---');
  const passGen = await post('/workers/me/pass/generate', {}, workerLogin.data.token);
  console.log('Pass generation status:', passGen.status, 'tokenPrefix:', passGen.data?.token?.slice(0, 8));
  if (passGen.status !== 201) throw new Error('Worker pass generation failed');

  const passStatus = await get('/workers/me/pass/status', workerLogin.data.token);
  console.log('Pass status inquiry status:', passStatus.status, 'workerCode:', passStatus.data?.workerCode);
  if (passStatus.status !== 200) throw new Error('Worker pass status failed');

  const workerMe = await get('/workers/me', workerLogin.data.token);
  console.log('Worker profile status:', workerMe.status, 'malariaStatus:', workerMe.data?.malariaStatus);
  if (workerMe.status !== 200) throw new Error('Worker profile failed');

  console.log('\n--- 10. Contractor Mobile Functions (Scanning & Transfers) ---');
  const contractorScan = await post('/contractor/pass/scan', { token: passGen.data.token }, contractorLogin.data.token);
  console.log('Contractor pass scan status:', contractorScan.status, 'workerName:', contractorScan.data?.name);
  if (contractorScan.status !== 201) throw new Error('Contractor pass scan failed');

  const contractorProfile = await get('/contractor/profile', contractorLogin.data.token);
  console.log('Contractor profile status:', contractorProfile.status, 'assigned sites:', contractorProfile.data?.sites?.length);
  if (contractorProfile.status !== 200) throw new Error('Contractor profile failed');

  // 2. Backend Security Enforcement Tests
  console.log('\n--- 11. Backend Security: Worker Web Login Blocked ---');
  const workerWeb = await post('/auth/staff/login', { username: '9000000201', password: '1234' });
  console.log('Worker web login status:', workerWeb.status, 'message:', workerWeb.data?.message);
  if (workerWeb.status !== 403 || !workerWeb.data?.message?.includes('Worker accounts can only access the M3 mobile app')) {
    throw new Error('Worker web login was not rejected with 403 Forbidden!');
  }

  console.log('\n--- 12. Backend Security: Contractor Web Login Blocked ---');
  const contractorWeb = await post('/auth/staff/login', { username: '9000000101', password: '1234' });
  console.log('Contractor web login status:', contractorWeb.status, 'message:', contractorWeb.data?.message);
  if (contractorWeb.status !== 403 || !contractorWeb.data?.message?.includes('Contractor accounts can only access the M3 mobile app')) {
    throw new Error('Contractor web login was not rejected with 403 Forbidden!');
  }

  console.log('\n--- 13. Backend Security: Prohibited API Endpoints ---');
  // Worker token calling Admin overview
  const workerAdminAccess = await get('/admin/overview', workerLogin.data.token);
  console.log('Worker calling /admin/overview:', workerAdminAccess.status, '(expected 403)');
  if (workerAdminAccess.status !== 403) throw new Error('Worker token accessed admin API!');

  // Contractor token calling Admin overview
  const contractorAdminAccess = await get('/admin/overview', contractorLogin.data.token);
  console.log('Contractor calling /admin/overview:', contractorAdminAccess.status, '(expected 403)');
  if (contractorAdminAccess.status !== 403) throw new Error('Contractor token accessed admin API!');

  // Admin web login to obtain valid Admin token
  const adminWeb = await post('/auth/staff/login', { username: 'admin', password: 'ChangeMe123!' });
  console.log('Admin web login status:', adminWeb.status, 'role:', adminWeb.data?.user?.role);
  if (adminWeb.status !== 201 || adminWeb.data?.user?.role !== 'ADMIN') throw new Error('Admin web login failed');

  // Admin token calling Worker-only endpoint (/workers/me)
  const adminWorkerAccess = await get('/workers/me', adminWeb.data.token);
  console.log('Admin calling /workers/me:', adminWorkerAccess.status, '(expected 403)');
  if (adminWorkerAccess.status !== 403) throw new Error('Admin token accessed worker API!');

  console.log('\n=== All Mobile and Backend Security Tests Passed Successfully! ===');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
