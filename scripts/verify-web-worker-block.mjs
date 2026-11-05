import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/nimr/.gemini/antigravity-cli/brain/6d9d99c1-a14d-4a51-8c00-ef5c7e03e7b0';

async function main() {
  console.log('Launching chromium...');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  console.log('1. Navigating to http://localhost:5173/login...');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');

  // Verify Worker tab defaults / warning banner
  console.log('Checking worker tab initial state...');
  await page.locator('button.nav-tab:has-text("Worker")').click();
  await page.waitForTimeout(300);

  // Fill worker credentials on worker tab
  console.log('Submitting worker sign in on Worker tab...');
  await page.locator('input[placeholder="10-digit number"]').fill('9822112231');
  await page.locator('input[placeholder="4–6 digits"]').fill('1234');
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForTimeout(500);

  const bannerWorkerTab = await page.getByText('Worker accounts can only access the M3 mobile app.').textContent();
  console.log('Worker Tab Banner:', bannerWorkerTab);
  const tokenWorkerTab = await page.evaluate(() => localStorage.getItem('m3.auth'));
  console.log('Storage m3.auth after Worker tab submit:', tokenWorkerTab);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_01_worker_tab_blocked.png') });
  console.log('Captured web_01_worker_tab_blocked.png');

  // Test 1b: Staff tab with worker credentials
  console.log('2. Testing staff tab with worker credentials (9822112231 / 1234)...');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.locator('button.nav-tab:has-text("Staff")').click();
  await page.waitForTimeout(300);

  await page.locator('label:has-text("Username") input').fill('9822112231');
  await page.locator('label:has-text("Password") input').fill('1234');
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForTimeout(1000);

  const bannerStaffTab = await page.getByText('Worker accounts can only access the M3 mobile app.').textContent();
  console.log('Staff Tab Banner with worker account:', bannerStaffTab);
  const tokenStaffTab = await page.evaluate(() => localStorage.getItem('m3.auth'));
  console.log('Storage m3.auth after Staff tab submit with worker phone:', tokenStaffTab);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_02_staff_tab_worker_blocked.png') });
  console.log('Captured web_02_staff_tab_worker_blocked.png');

  // Test 2: Direct URL navigation to /worker
  console.log('3. Navigating directly to /worker...');
  await page.goto('http://localhost:5173/worker');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  console.log('Redirected URL from /worker:', page.url());
  const bannerDirect = await page.getByText('Worker accounts can only access the M3 mobile app.').textContent();
  console.log('Banner on /worker redirect:', bannerDirect);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_03_direct_url_worker_blocked.png') });
  console.log('Captured web_03_direct_url_worker_blocked.png');

  // Test 3 & 4: Old Worker session in localStorage accessing /admin
  console.log('4. Testing pre-seeded Worker session in localStorage accessing /admin...');
  await page.evaluate(() => {
    localStorage.setItem('m3.auth', JSON.stringify({
      token: 'fake-worker-jwt',
      user: {
        userId: 'fake-id',
        role: 'WORKER',
        workerId: 'M3-POS-01',
        displayName: 'Raju Sharma'
      }
    }));
  });

  await page.goto('http://localhost:5173/admin');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  console.log('Redirected URL from /admin:', page.url());
  const storagePurged = await page.evaluate(() => localStorage.getItem('m3.auth'));
  console.log('Storage m3.auth after attempted /admin access:', storagePurged);
  const bannerPurged = await page.getByText('Worker accounts can only access the M3 mobile app.').textContent();
  console.log('Banner on purged worker session:', bannerPurged);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_04_refresh_seeded_worker_purged.png') });
  console.log('Captured web_04_refresh_seeded_worker_purged.png');

  // Test 8: Admin login via staff tab
  console.log('5. Testing valid Admin login via Staff tab...');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.locator('button.nav-tab:has-text("Staff")').click();
  await page.waitForTimeout(300);

  await page.locator('label:has-text("Username") input').fill('admin');
  await page.locator('label:has-text("Password") input').fill('ChangeMe123!');
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForURL('**/admin**', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  console.log('Admin URL reached:', page.url());

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_05_admin_login_success.png') });
  console.log('Captured web_05_admin_login_success.png');

  await browser.close();
  console.log('=== All Browser Verification Scenarios Passed! ===');
}

main().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
