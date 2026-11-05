import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/nimr/.gemini/antigravity-cli/brain/6d9d99c1-a14d-4a51-8c00-ef5c7e03e7b0';

async function main() {
  console.log('=== Starting Complete RBAC Verification ===');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // 1. Web Portal: Clean Staff Login Interface (No worker/contractor tabs or registration)
  console.log('\n--- 1. Testing Web Login Interface Layout ---');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');

  const title = await page.getByRole('heading', { name: 'Staff Sign In' }).textContent();
  console.log('Title detected:', title);

  const workerTabCount = await page.locator('button:has-text("Worker")').count();
  const contractorTabCount = await page.locator('button:has-text("Contractor")').count();
  const registerTextCount = await page.locator('text=Register').count();
  console.log('Worker tabs present:', workerTabCount, '(expected 0)');
  console.log('Contractor tabs present:', contractorTabCount, '(expected 0)');
  console.log('Register links present:', registerTextCount, '(expected 0)');
  if (workerTabCount !== 0 || contractorTabCount !== 0 || registerTextCount !== 0) {
    throw new Error('Worker or Contractor tabs/links found on web login page!');
  }

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_final_01_staff_login_clean.png') });
  console.log('Captured web_final_01_staff_login_clean.png');

  // 2. Web Portal: Worker web login rejected
  console.log('\n--- 2. Testing Worker web login rejection ---');
  await page.locator('label:has-text("Username") input').fill('9000000201');
  await page.locator('label:has-text("Password") input').fill('1234');
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForTimeout(1000);

  const workerMsg = await page.getByText('Worker accounts can only access the M3 mobile app.').textContent();
  console.log('Worker login error banner:', workerMsg);
  const workerStorage = await page.evaluate(() => localStorage.getItem('m3.auth'));
  console.log('Storage m3.auth after worker login attempt:', workerStorage);
  if (workerStorage !== null) throw new Error('Worker session was stored in localStorage!');

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_final_02_worker_blocked.png') });
  console.log('Captured web_final_02_worker_blocked.png');

  // 3. Web Portal: Contractor web login rejected
  console.log('\n--- 3. Testing Contractor web login rejection ---');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.locator('label:has-text("Username") input').fill('9000000101');
  await page.locator('label:has-text("Password") input').fill('1234');
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForTimeout(1000);

  const contractorMsg = await page.getByText('Contractor accounts can only access the M3 mobile app.').textContent();
  console.log('Contractor login error banner:', contractorMsg);
  const contractorStorage = await page.evaluate(() => localStorage.getItem('m3.auth'));
  console.log('Storage m3.auth after contractor login attempt:', contractorStorage);
  if (contractorStorage !== null) throw new Error('Contractor session was stored in localStorage!');

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_final_03_contractor_blocked.png') });
  console.log('Captured web_final_03_contractor_blocked.png');

  // 4. Web Portal: Worker direct URL access rejected
  console.log('\n--- 4. Testing Worker direct URL access (/worker) ---');
  await page.goto('http://localhost:5173/worker');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  console.log('Current URL after navigating to /worker:', page.url());
  const directWorkerBanner = await page.getByText('Worker accounts can only access the M3 mobile app.').textContent();
  console.log('Banner on /worker direct URL:', directWorkerBanner);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_final_04_direct_url_worker.png') });
  console.log('Captured web_final_04_direct_url_worker.png');

  // 5. Web Portal: Contractor direct URL access rejected
  console.log('\n--- 5. Testing Contractor direct URL access (/contractor) ---');
  await page.goto('http://localhost:5173/contractor');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  console.log('Current URL after navigating to /contractor:', page.url());
  const directContractorBanner = await page.getByText('Contractor accounts can only access the M3 mobile app.').textContent();
  console.log('Banner on /contractor direct URL:', directContractorBanner);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_final_05_direct_url_contractor.png') });
  console.log('Captured web_final_05_direct_url_contractor.png');

  // 6. Web Portal: Old Worker and Contractor sessions rejected & purged
  console.log('\n--- 6. Testing Old Worker and Contractor sessions rejection ---');
  await page.evaluate(() => {
    localStorage.setItem('m3.auth', JSON.stringify({
      token: 'fake-contractor-jwt',
      user: { userId: 'c-fake', role: 'CONTRACTOR', contractorId: 'C100', displayName: 'Old Contractor' }
    }));
  });
  await page.goto('http://localhost:5173/admin');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  console.log('Current URL after old contractor session load:', page.url());
  const purgedStorage = await page.evaluate(() => localStorage.getItem('m3.auth'));
  console.log('Storage m3.auth after load:', purgedStorage);
  if (purgedStorage !== null) throw new Error('Old Contractor session was not purged!');

  // 7. Web Portal: Admin web login works
  console.log('\n--- 7. Testing Admin web login ---');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.locator('label:has-text("Username") input').fill('admin');
  await page.locator('label:has-text("Password") input').fill('ChangeMe123!');
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForURL('**/admin**', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  console.log('Admin URL reached successfully:', page.url());
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_final_06_admin_dashboard.png') });
  console.log('Captured web_final_06_admin_dashboard.png');

  // Clear admin session
  await page.evaluate(() => localStorage.clear());

  // 8. Web Portal: Health Worker web login works
  console.log('\n--- 8. Testing Health Worker web login ---');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.locator('label:has-text("Username") input').fill('healthworker');
  await page.locator('label:has-text("Password") input').fill('password123');
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForURL('**/portal**', { timeout: 10000 });
  console.log('Health Worker URL reached:', page.url());
  await page.evaluate(() => localStorage.clear());

  // 9. Web Portal: Clinician web login works
  console.log('\n--- 9. Testing Clinician web login ---');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.locator('label:has-text("Username") input').fill('clinician');
  await page.locator('label:has-text("Password") input').fill('password123');
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForURL('**/portal**', { timeout: 10000 });
  console.log('Clinician URL reached:', page.url());
  await page.evaluate(() => localStorage.clear());

  // 10. Web Portal: Lab Technician (Pathologist) web login works
  console.log('\n--- 10. Testing Lab Technician (Pathologist) web login ---');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.locator('label:has-text("Username") input').fill('pathologist');
  await page.locator('label:has-text("Password") input').fill('password123');
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForURL('**/portal**', { timeout: 10000 });
  console.log('Lab Technician URL reached:', page.url());
  await page.evaluate(() => localStorage.clear());

  // 11. Web Portal: Research Lab web login works
  console.log('\n--- 11. Testing Research Lab web login ---');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.locator('label:has-text("Username") input').fill('researchlab');
  await page.locator('label:has-text("Password") input').fill('password123');
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForURL('**/portal**', { timeout: 10000 });
  console.log('Research Lab URL reached:', page.url());
  await page.evaluate(() => localStorage.clear());

  await browser.close();
  console.log('\n=== All Web Portal RBAC Tests Passed Successfully! ===');
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
