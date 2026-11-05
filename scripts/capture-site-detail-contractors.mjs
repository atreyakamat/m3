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
    viewport: { width: 1440, height: 1100 },
  });

  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/login...');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');

  // Click Staff tab
  console.log('Clicking Staff tab...');
  await page.locator('button:has-text("Staff")').click();
  await page.waitForTimeout(500);

  // Fill credentials
  console.log('Filling staff credentials...');
  await page.locator('label:has-text("Username") input').fill('admin');
  await page.locator('label:has-text("Password") input').fill('ChangeMe123!');
  await page.locator('button:has-text("Sign in")').click();

  console.log('Waiting for admin dashboard URL...');
  await page.waitForURL('**/admin**', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Navigate to SITE-82WUJS
  console.log('Navigating to /admin/sites/SITE-82WUJS...');
  await page.goto('http://localhost:5173/admin/sites/SITE-82WUJS');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Capture screenshot of site detail with contractors table and assignment history
  const targetPath = path.join(ARTIFACT_DIR, 'web_site_detail_contractors.png');
  console.log(`Capturing ${targetPath}...`);
  await page.screenshot({ path: targetPath, fullPage: true });

  console.log('Screenshot captured successfully!');
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
