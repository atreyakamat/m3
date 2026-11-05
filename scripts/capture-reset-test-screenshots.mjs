import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/home/nimr/.gemini/antigravity-cli/brain/6d9d99c1-a14d-4a51-8c00-ef5c7e03e7b0';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });

  const page = await context.newPage();

  // 1. Clean Staff Login Page with Admin credentials
  console.log('1. Navigating to login...');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.locator('label:has-text("Username") input').fill('admin');
  await page.locator('label:has-text("Password") input').fill('ChangeMe123!');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reset_01_admin_login.png') });
  console.log('✔ reset_01_admin_login.png captured.');

  // Click Sign in
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForURL('**/admin**', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // 2. Admin Overview Dashboard
  console.log('2. Capturing Admin Dashboard...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reset_02_admin_dashboard.png'), fullPage: true });
  console.log('✔ reset_02_admin_dashboard.png captured.');

  // 3. Admin Site Detail SITE-TEST01
  console.log('3. Navigating to /admin/sites/SITE-TEST01...');
  await page.goto('http://localhost:5173/admin/sites/SITE-TEST01');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reset_03_admin_site_detail.png'), fullPage: true });
  console.log('✔ reset_03_admin_site_detail.png captured.');

  // 4. Admin Workers List
  console.log('4. Navigating to /admin/workers...');
  await page.goto('http://localhost:5173/admin/workers');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reset_04_admin_workers_list.png'), fullPage: true });
  console.log('✔ reset_04_admin_workers_list.png captured.');

  // 5. Test Worker Login Rejection on Web
  console.log('5. Testing Worker Login Rejection...');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.locator('label:has-text("Username") input').fill('9000000201');
  await page.locator('label:has-text("Password") input').fill('1234');
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reset_05_worker_web_blocked.png') });
  console.log('✔ reset_05_worker_web_blocked.png captured.');

  // 6. Test Contractor Login Rejection on Web
  console.log('6. Testing Contractor Login Rejection...');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.locator('label:has-text("Username") input').fill('9000000101');
  await page.locator('label:has-text("Password") input').fill('1234');
  await page.locator('button:has-text("Sign in")').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'reset_06_contractor_web_blocked.png') });
  console.log('✔ reset_06_contractor_web_blocked.png captured.');

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch((e) => {
  console.error('Screenshot capture failed:', e);
  process.exit(1);
});
