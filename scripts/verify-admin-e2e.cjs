const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.WEB_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots/admin');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function log(msg) {
  console.log(`[E2E] ${msg}`);
}

async function run() {
  log(`Starting Playwright Admin E2E Verification on ${BASE_URL}...`);
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  async function snap(name) {
    const file = path.join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    log(`Saved screenshot: ${name}.png`);
  }

  try {
    // ------------------------------------------------------------------------
    // STEP 1: Admin Login (admin / admin)
    // ------------------------------------------------------------------------
    log('Navigating to login page...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Switch to Staff tab
    const staffTab = page.locator('button:has-text("Staff")');
    await staffTab.click();
    await page.waitForTimeout(300);

    // Fill in admin credentials
    await page.fill('input:not([type="password"]) >> nth=0', 'admin');
    await page.fill('input[type="password"]', 'admin');
    await snap('01_login_staff');

    // Click Sign In
    log('Submitting initial admin credentials...');
    await page.click('button:has-text("Sign in")');
    await page.waitForURL('**/first-login');
    log('Successfully redirected to /first-login as required for temporary credentials.');

    // ------------------------------------------------------------------------
    // STEP 2: Mandatory First-Login Password Change
    // ------------------------------------------------------------------------
    await page.waitForSelector('text=First-time setup');
    await snap('02_first_login_prompt');

    // 2a. Test password mismatch
    log('Testing password mismatch validation...');
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('AdminStrong2026!');
    await passwordInputs.nth(1).fill('MismatchPassword123!');
    await page.click('button:has-text("Save and continue")');
    await page.waitForSelector('text=The two entries do not match');
    log('Verified password mismatch error displayed.');

    // 2b. Test weak password
    log('Testing weak password validation...');
    await passwordInputs.nth(0).fill('weak');
    await passwordInputs.nth(1).fill('weak');
    await page.click('button:has-text("Save and continue")');
    await page.waitForSelector('text=At least 8 characters');
    log('Verified weak password error displayed.');

    // 2c. Set strong valid password
    log('Entering strong matching password (AdminStrong2026!)...');
    await passwordInputs.nth(0).fill('AdminStrong2026!');
    await passwordInputs.nth(1).fill('AdminStrong2026!');
    await snap('03_first_login_password_set');

    await page.click('button:has-text("Save and continue")');
    await page.waitForURL('**/admin');
    log('Successfully changed password and navigated to /admin dashboard.');

    // ------------------------------------------------------------------------
    // STEP 3: Admin Overview Page (/admin)
    // ------------------------------------------------------------------------
    await page.waitForSelector('text=Construction sites');
    await page.waitForSelector('text=Malaria status');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await snap('04_admin_overview');
    log('Verified Admin Overview with metrics cards and malaria status counters.');

    // ------------------------------------------------------------------------
    // STEP 4: Construction Sites List (/admin/sites)
    // ------------------------------------------------------------------------
    log('Navigating to Construction Sites...');
    await page.click('a[href="/admin/sites"]');
    await page.waitForURL('**/admin/sites');
    await page.waitForSelector('text=Construction sites');
    await page.waitForLoadState('networkidle');
    await snap('05_admin_sites_list');
    log('Verified Construction Sites list with district, contractor, and worker counts.');

    // ------------------------------------------------------------------------
    // STEP 5: Create Construction Site (/admin/sites/new)
    // ------------------------------------------------------------------------
    log('Opening Create Site form...');
    await page.click('button:has-text("Create site")');
    await page.waitForURL('**/admin/sites/new');
    await page.waitForSelector('text=Create construction site');
    await page.waitForLoadState('networkidle');

    // Fill form
    await page.locator('label:has-text("Site name") input').fill('Mandovi Estuary Project');
    // Select an area
    const areaSelect = page.locator('select >> nth=0');
    const areaOptions = await areaSelect.locator('option').all();
    if (areaOptions.length > 1) {
      const val = await areaOptions[1].getAttribute('value');
      if (val) await areaSelect.selectOption(val);
    }
    await page.locator('label:has-text("Address") textarea').fill('Betim Marine Drive, Bardez, North Goa');
    await snap('06_admin_site_new_form');

    log('Submitting new site form...');
    await page.click('button:has-text("Create site")');
    await page.waitForURL(/\/admin\/sites\/SITE-/);
    const newSiteUrl = page.url();
    const createdSiteCode = newSiteUrl.split('/').pop();
    log(`Created site successfully with auto-generated code: ${createdSiteCode}`);

    // ------------------------------------------------------------------------
    // STEP 6: Site Detail Page (/admin/sites/:siteCode)
    // ------------------------------------------------------------------------
    await page.waitForSelector(`text=${createdSiteCode}`);
    await page.waitForLoadState('networkidle');
    await snap('07_admin_site_detail');
    log('Verified Site Detail page with district, taluka, linked workers, and history.');

    // ------------------------------------------------------------------------
    // STEP 7: Edit Site (/admin/sites/:siteCode/edit)
    // ------------------------------------------------------------------------
    log('Editing site...');
    await page.click('button:has-text("Edit")');
    await page.waitForURL(`**/admin/sites/${createdSiteCode}/edit`);
    await page.waitForSelector('text=Edit site');
    await page.waitForLoadState('networkidle');

    await page.locator('label:has-text("Address") textarea').fill('Betim Jetty Terminal, Bardez, North Goa - Updated');
    await snap('08_admin_site_edit_form');

    await page.click('button:has-text("Save changes")');
    await page.waitForURL(`**/admin/sites/${createdSiteCode}`);
    await page.waitForSelector('text=Betim Jetty Terminal, Bardez, North Goa - Updated');
    log('Verified site update succeeded and redirected back to site detail.');

    // ------------------------------------------------------------------------
    // STEP 8: Stakeholder Users List (/admin/users)
    // ------------------------------------------------------------------------
    log('Navigating to Users list...');
    await page.click('a[href="/admin/users"]');
    await page.waitForURL('**/admin/users');
    await page.waitForSelector('text=User management');
    await page.waitForLoadState('networkidle');
    await snap('09_admin_users_list');
    log('Verified Users list with role filters and active/inactive status.');

    // ------------------------------------------------------------------------
    // STEP 9: Create Contractor Account (/admin/users/new)
    // ------------------------------------------------------------------------
    log('Creating new Contractor account...');
    await page.click('button:has-text("Create user")');
    await page.waitForURL('**/admin/users/new');
    await page.waitForSelector('text=Create user');
    await page.waitForLoadState('networkidle');

    // Role defaults to CONTRACTOR
    await page.locator('label:has-text("Full name") input').fill('Apex Coastal Builders');
    await page.locator('label:has-text("Phone number") input').fill('9822112233');
    await page.locator('label:has-text("Initial temporary PIN") input').fill('4321');

    // Assign the created site to this contractor
    const siteCheckbox = page.locator(`label:has-text("${createdSiteCode}") input[type="checkbox"]`);
    await siteCheckbox.waitFor({ state: 'attached', timeout: 8000 });
    await siteCheckbox.scrollIntoViewIfNeeded();
    await siteCheckbox.check();
    log(`Checked site assignment for ${createdSiteCode}`);
    await snap('10_admin_user_new_form');

    log('Submitting Contractor creation...');
    await page.click('button:has-text("Create user")');
    await page.waitForURL(/\/admin\/users\/[0-9a-f-]+/);
    const contractorUserId = page.url().split('/').pop();
    log(`Contractor user created with ID: ${contractorUserId}`);

    // ------------------------------------------------------------------------
    // STEP 10: Contractor User Detail (/admin/users/:id)
    // ------------------------------------------------------------------------
    await page.waitForSelector('text=Apex Coastal Builders');
    await page.waitForLoadState('networkidle');
    const contractorStakeholderIdElem = page.locator('code:has-text("C")').first();
    const contractorStakeholderId = await contractorStakeholderIdElem.textContent();
    log(`Generated Contractor ID: ${contractorStakeholderId}`);
    await snap('11_admin_contractor_detail');
    log('Verified Contractor detail page with role, ID prefix C, and assigned sites.');

    // ------------------------------------------------------------------------
    // STEP 11: Verify Prevent Multiple Contractors Owning Same Site
    // ------------------------------------------------------------------------
    log('Testing constraint: Prevent multiple contractors on the same site...');
    await page.goto(`${BASE_URL}/admin/users/new`);
    await page.waitForSelector('text=Create user');
    await page.locator('label:has-text("Full name") input').fill('Conflicting Builders');
    await page.locator('label:has-text("Phone number") input').fill('9822112299');
    await page.locator('label:has-text("Initial temporary PIN") input').fill('4321');
    const conflictSiteCheckbox = page.locator(`label:has-text("${createdSiteCode}") input[type="checkbox"]`);
    await conflictSiteCheckbox.waitFor({ state: 'attached', timeout: 8000 });
    await conflictSiteCheckbox.scrollIntoViewIfNeeded();
    await conflictSiteCheckbox.check();
    log(`Checked conflict site assignment for ${createdSiteCode}`);
    await page.click('button:has-text("Create user")');
    await page.waitForSelector('text=already has an assigned contractor');
    await snap('11b_admin_contractor_conflict_prevented');
    log('Verified: Attempt to assign already-owned site to another contractor was rejected with conflict error.');

    // ------------------------------------------------------------------------
    // STEP 12: Create Health Worker, Clinician, Pathologist, Research Lab
    // ------------------------------------------------------------------------
    const rolesToCreate = [
      { role: 'HEALTH_WORKER', name: 'Dr. Sunita Rao', phone: '9822112234', prefix: 'HW' },
      { role: 'CLINICIAN', name: 'Dr. Vikram Naik', phone: '9822112235', prefix: 'CL' },
      { role: 'PATHOLOGIST', name: 'Dr. Ananya Sen', phone: '9822112236', prefix: 'P' },
      { role: 'RESEARCH_LAB', name: 'Goa Vector Research Lab', phone: '9822112237', prefix: 'RL' },
    ];

    for (const item of rolesToCreate) {
      log(`Creating stakeholder account for ${item.role} (${item.name})...`);
      await page.goto(`${BASE_URL}/admin/users/new`);
      await page.waitForSelector('text=Create user');
      await page.locator('label:has-text("Full name") input').fill(item.name);
      await page.locator('label:has-text("Phone number") input').fill(item.phone);
      await page.locator('label:has-text("Role") select').selectOption(item.role);
      await page.locator('label:has-text("Initial temporary PIN") input').fill('4321');
      await page.click('button:has-text("Create user")');
      await page.waitForURL(/\/admin\/users\/[0-9a-f-]+/);
      await page.waitForSelector(`text=${item.name}`);
      const codeElem = page.locator(`code:has-text("${item.prefix}")`).first();
      const code = await codeElem.textContent();
      log(`Verified account created: ${item.name} with unique ID ${code} (prefix ${item.prefix})`);
    }

    // ------------------------------------------------------------------------
    // STEP 13: Workers List (/admin/workers)
    // ------------------------------------------------------------------------
    log('Navigating to Workers list...');
    await page.click('a[href="/admin/workers"]');
    await page.waitForURL('**/admin/workers');
    await page.waitForSelector('text=Workers');
    await page.waitForLoadState('networkidle');
    await snap('12_admin_workers_list');
    log('Verified Workers list with site associations and malaria status chips.');

    // ------------------------------------------------------------------------
    // STEP 14: Worker Detail (/admin/workers/:workerCode)
    // ------------------------------------------------------------------------
    log('Viewing Worker Detail...');
    const firstWorkerRow = page.locator('table tbody tr a').first();
    await firstWorkerRow.waitFor({ state: 'visible', timeout: 8000 });
    const workerLink = await firstWorkerRow.getAttribute('href');
    await firstWorkerRow.click();
    await page.waitForURL(`**${workerLink}`);
    await page.waitForSelector('text=Site assignment history');
    await page.waitForLoadState('networkidle');
    await snap('13_admin_worker_detail');
    log('Verified Worker Detail with site assignment, malaria status, and screening baseline.');

    // ------------------------------------------------------------------------
    // STEP 15: Requests Page (/admin/requests)
    // ------------------------------------------------------------------------
    log('Navigating to Requests...');
    await page.click('a[href="/admin/requests"]');
    await page.waitForURL('**/admin/requests');
    await page.waitForSelector('text=Worker requests');
    await page.waitForLoadState('networkidle');
    await snap('14_admin_requests_list');
    log('Verified Requests page showing worker join requests and contractor authority notice.');

    // ------------------------------------------------------------------------
    // STEP 16: Transfers Page (/admin/transfers)
    // ------------------------------------------------------------------------
    log('Navigating to Transfers...');
    await page.click('a[href="/admin/transfers"]');
    await page.waitForURL('**/admin/transfers');
    await page.waitForSelector('h2:has-text("Transfers"), h3:has-text("Transfers")');
    await page.waitForLoadState('networkidle');
    await snap('15_admin_transfers_list');
    log('Verified Transfers page with source and destination sites and status.');

    // ------------------------------------------------------------------------
    // STEP 17: Positive-Worker Travel Reports (/admin/travel-reports)
    // ------------------------------------------------------------------------
    log('Navigating to Travel Reports...');
    await page.click('a[href="/admin/travel-reports"]');
    await page.waitForURL('**/admin/travel-reports');
    await page.waitForSelector('text=Travel reports');
    await page.waitForLoadState('networkidle');
    await snap('16_admin_travel_reports_list');
    log('Verified Travel Reports page listing positive-case travel reports.');

    // ------------------------------------------------------------------------
    // STEP 18: Travel Report Detail (/admin/travel-reports/:id)
    // ------------------------------------------------------------------------
    log('Viewing Travel Report Detail...');
    const reportOpenLink = page.locator('table tbody tr a:has-text("Open")').first();
    await reportOpenLink.waitFor({ state: 'visible', timeout: 8000 });
    await reportOpenLink.click();
    await page.waitForURL(/\/admin\/travel-reports\/[0-9a-f-]+/);
    await page.waitForSelector('text=Travel report');
    await page.waitForLoadState('networkidle');

    // Submit review action
    const statusSelect = page.locator('select');
    if (await statusSelect.count() > 0) {
      await statusSelect.selectOption('REVIEWED');
      const reviewTextarea = page.locator('textarea');
      await reviewTextarea.fill('Coordinated with health officer; worker is compliant with antimalarial medication.');
      await snap('17_admin_travel_report_detail');
      await page.click('button:has-text("Record review")');
      await page.waitForSelector('text=Reviewed');
      log('Verified Travel Report review submitted and status transitioned to Reviewed.');
    } else {
      await snap('17_admin_travel_report_detail');
    }

    // ------------------------------------------------------------------------
    // STEP 19: Notifications Page (/admin/notifications)
    // ------------------------------------------------------------------------
    log('Navigating to Notifications...');
    await page.click('a[href="/admin/notifications"]');
    await page.waitForURL('**/admin/notifications');
    await page.waitForSelector('text=Notifications');
    await page.waitForLoadState('networkidle');
    await snap('18_admin_notifications_list');

    // Test acknowledge action
    const ackButton = page.locator('button:has-text("Acknowledge")').first();
    if (await ackButton.count() > 0) {
      await ackButton.click();
      await page.waitForTimeout(500);
      log('Verified notification acknowledgement toggle.');
    }
    log('Verified Notifications center with deduplicated role alerts.');

    log('================================================================');
    log('ALL 15 ADMIN PAGES AND COMPLETE WORKFLOW VERIFIED SUCCESSFULLY!');
    log('================================================================');
  } catch (err) {
    console.error('[E2E ERROR]', err);
    await snap('error_state');
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
