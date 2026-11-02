import { chromium } from 'playwright';
import path from 'path';

const SCREENSHOT_DIR = '/home/nimr/.gemini/antigravity-cli/brain/6d9d99c1-a14d-4a51-8c00-ef5c7e03e7b0/screenshots';

async function main() {
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
  await page.click('button:has-text("Staff")');

  // Fill credentials
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'AdminPassword123!');
  await page.click('button:has-text("Sign in as staff")');

  // Wait for navigation to /admin
  await page.waitForURL('**/admin**');
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
  await page.waitForTimeout(500);

  // Fill in site creation form
  // Select District: Kushavati
  console.log('Selecting District Kushavati...');
  await page.selectOption('select:has(option:has-text("Kushavati"))', { label: 'Kushavati' });
  await page.waitForTimeout(500);

  // Select Taluka: Quepem
  console.log('Selecting Taluka Quepem...');
  await page.selectOption('select:has(option:has-text("Quepem"))', { label: 'Quepem' });
  await page.waitForTimeout(500);

  // Select Village / Town: Curchorem
  console.log('Selecting Area Curchorem...');
  await page.selectOption('select:has(option:has-text("Curchorem"))', { label: 'Curchorem' });
  await page.waitForTimeout(500);

  // Fill Name, Address, Landmark, Contact Phone
  await page.fill('input[placeholder*="Housing" i], input:near(:text("Site Name"))', 'Kushavati Smart Infrastructure Hub');
  await page.fill('input:near(:text("Detailed Address"))', 'Plot 12, Industrial Estate, Curchorem');
  await page.fill('input:near(:text("Landmark"))', 'Near Quepem Rural Hospital');
  await page.fill('input:near(:text("Site Contact Phone"))', '9800000099');

  console.log('Capturing web_02_site_creation_goa_hierarchy.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'web_02_site_creation_goa_hierarchy.png'), fullPage: true });

  // 5. User Creation Form & Modal
  console.log('Navigating to /admin/users/new...');
  await page.goto('http://localhost:5173/admin/users/new');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Select Role: Contractor
  await page.selectOption('select:near(:text("System Role"))', 'CONTRACTOR');
  await page.fill('input:near(:text("Full Name"))', 'Anand Shirodkar');
  await page.fill('input:near(:text("Registered Mobile Number"))', '9822123456');

  // Submit to generate credentials
  console.log('Submitting user form to trigger credential modal...');
  await page.click('button:has-text("Create User & Generate Credentials")');
  await page.waitForSelector('text=Account Created Successfully', { timeout: 5000 });
  await page.waitForTimeout(500);

  console.log('Capturing web_03_contractor_creation_modal.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'web_03_contractor_creation_modal.png'), fullPage: true });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch(err => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
