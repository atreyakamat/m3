import { chromium } from 'playwright';
import path from 'path';

const SCREENSHOT_DIR = '/home/nimr/.gemini/antigravity-cli/brain/6d9d99c1-a14d-4a51-8c00-ef5c7e03e7b0/screenshots';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 }
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
  await page.locator('label:has-text("Password") input').fill('AdminPassword123!');
  await page.locator('button:has-text("Sign in")').click();

  // Wait for navigation to /admin
  console.log('Waiting for admin dashboard URL...');
  await page.waitForURL('**/admin**', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // 1. Admin Overview
  console.log('Capturing web_01_admin_overview.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'web_01_admin_overview.png'), fullPage: true });

  // 2. Demo Data Page
  console.log('Navigating to /admin/demo-data...');
  await page.goto('http://localhost:5173/admin/demo-data');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  console.log('Capturing web_04_demo_data_management.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'web_04_demo_data_management.png'), fullPage: true });

  // 3. Site Detail Page for SITE-DEMO01
  console.log('Navigating to /admin/sites/SITE-DEMO01...');
  await page.goto('http://localhost:5173/admin/sites/SITE-DEMO01');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  console.log('Capturing web_05_site_detail_hierarchy.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'web_05_site_detail_hierarchy.png'), fullPage: true });

  // 4. Site Creation Form with Goa Cascading Hierarchy
  console.log('Navigating to /admin/sites/new...');
  await page.goto('http://localhost:5173/admin/sites/new');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  // Fill in site name
  await page.locator('label:has-text("Site name") input').fill('Kushavati Regional Infrastructure Park');

  // Select District: Kushavati
  console.log('Selecting District Kushavati...');
  await page.locator('label:has-text("District *") select').selectOption({ label: 'Kushavati' });
  await page.waitForTimeout(400);

  // Select Taluka: Quepem
  console.log('Selecting Taluka Quepem...');
  await page.locator('label:has-text("Taluka *") select').selectOption({ label: 'Quepem' });
  await page.waitForTimeout(400);

  // Select Village / Town: Curchorem
  console.log('Selecting Area Curchorem...');
  await page.locator('label:has-text("Village / Town (Area) *") select').selectOption({ label: 'Curchorem' });
  await page.waitForTimeout(400);

  // Fill Landmark, Address, Contact Phone
  await page.locator('label:has-text("Landmark") input').fill('Opposite Quepem Community Health Centre');
  await page.locator('label:has-text("Detailed address") textarea').fill('Survey No. 42/1A, Quepem-Curchorem Highway');
  await page.locator('label:has-text("Site contact phone") input').fill('9800000099');

  console.log('Capturing web_02_site_creation_goa_hierarchy.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'web_02_site_creation_goa_hierarchy.png'), fullPage: true });

  // 5. User Creation Form & Modal
  console.log('Navigating to /admin/users/new...');
  await page.goto('http://localhost:5173/admin/users/new');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  // Select Role: Contractor
  console.log('Selecting CONTRACTOR role...');
  await page.locator('label:has-text("Role *") select').selectOption('CONTRACTOR');
  await page.locator('label:has-text("Full name *") input').fill('Anand Shirodkar');
  // Use a unique mobile number to avoid collisions
  const testPhone = '9822' + Math.floor(100000 + Math.random() * 900000);
  await page.locator('label:has-text("Phone number *") input').fill(testPhone);

  // Click Auto-generate PIN
  console.log('Clicking Auto-generate PIN...');
  await page.locator('button:has-text("Auto-generate PIN")').click();
  await page.waitForTimeout(300);

  // Submit to generate credentials
  console.log('Submitting user form to trigger credential modal...');
  await page.locator('button:has-text("Create user")').click();
  await page.waitForSelector('text=Account Created Successfully', { timeout: 8000 });
  await page.waitForTimeout(600);

  console.log('Capturing web_03_contractor_creation_modal.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'web_03_contractor_creation_modal.png'), fullPage: true });

  await browser.close();
  console.log('All web screenshots captured successfully!');
}

main().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
