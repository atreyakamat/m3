import { chromium } from 'playwright';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const ARTIFACT_DIR = '/home/nimr/.gemini/antigravity-cli/brain/b02929b0-9a8d-4a93-be0d-629d006fee85/screenshots';
const prisma = new PrismaClient();

async function seedData() {
  console.log('Seeding demo facilities and records for UI visual verification...');

  // 1. Candolim PHC
  const candolim = await prisma.facility.upsert({
    where: { facilityCode: 'PHC-001' },
    update: {},
    create: {
      facilityCode: 'PHC-001',
      name: 'Candolim Primary Health Centre',
      type: 'PHC',
      state: 'Goa',
      district: 'North Goa',
      taluka: 'Bardez',
      address: 'Near Candolim Panchayat, Main Road, Candolim, Goa 403515',
      contactPhone: '0832-2489021',
      contactEmail: 'phc.candolim@health.goa.gov.in',
      latitude: 15.5185,
      longitude: 73.7682,
      active: true,
    },
  });

  // 2. Panaji UHC
  const panaji = await prisma.facility.upsert({
    where: { facilityCode: 'UHC-001' },
    update: {},
    create: {
      facilityCode: 'UHC-001',
      name: 'Panaji Urban Health Centre',
      type: 'UHC',
      state: 'Goa',
      district: 'North Goa',
      taluka: 'Tiswadi',
      address: 'Near Municipal Market, Panaji, Goa 403001',
      contactPhone: '0832-2225432',
      contactEmail: 'uhc.panaji@health.goa.gov.in',
      latitude: 15.4989,
      longitude: 73.8278,
      active: true,
    },
  });

  // 3. Staff assignments for Candolim PHC
  const hwUser = await prisma.user.findFirst({ where: { role: 'HEALTH_WORKER' } });
  const clinicianUser = await prisma.user.findFirst({ where: { role: 'CLINICIAN' } });

  if (hwUser) {
    const existingHwAssign = await prisma.facilityStaffAssignment.findFirst({
      where: { facilityId: candolim.id, userId: hwUser.id, active: true },
    });
    if (!existingHwAssign) {
      await prisma.facilityStaffAssignment.create({
        data: {
          facilityId: candolim.id,
          userId: hwUser.id,
          role: 'HEALTH_WORKER',
          active: true,
          startDate: new Date(),
        },
      });
    }
  }

  if (clinicianUser) {
    const existingClAssign = await prisma.facilityStaffAssignment.findFirst({
      where: { facilityId: candolim.id, userId: clinicianUser.id, active: true },
    });
    if (!existingClAssign) {
      await prisma.facilityStaffAssignment.create({
        data: {
          facilityId: candolim.id,
          userId: clinicianUser.id,
          role: 'CLINICIAN',
          active: true,
          startDate: new Date(),
        },
      });
    }
  }

  // 4. Sample facility notification in Candolim PHC inbox
  const existingNotif = await prisma.notification.findFirst({
    where: { audienceFacilityId: candolim.id },
  });
  if (!existingNotif) {
    await prisma.notification.create({
      data: {
        audienceFacility: { connect: { id: candolim.id } },
        title: 'Confirmed Positive Malaria Case Alert',
        body: 'Worker M3-TEST01 confirmed positive for Plasmodium Vivax. Immediate facility review and follow-up required.',
        dedupeKey: 'PHC-001-DEMO-ALERT-01',
        type: 'POSITIVE_RESULT',
      },
    });
  }

  // 5. Sample profile correction request
  const worker = await prisma.worker.findFirst();
  if (worker) {
    const existingReq = await prisma.profileCorrectionRequest.findFirst({
      where: { workerId: worker.id, status: 'SUBMITTED' },
    });
    if (!existingReq) {
      await prisma.profileCorrectionRequest.create({
        data: {
          workerId: worker.id,
          fieldName: 'permanentAddressPincode',
          currentValue: '761000',
          proposedValue: '761001',
          reason: 'Worker updated permanent village postal code after family relocation.',
          status: 'SUBMITTED',
        },
      });
    }
  }

  return { candolim, panaji };
}

async function main() {
  const { candolim } = await seedData();

  console.log('Launching browser...');
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });

  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/login...');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');

  console.log('Logging in as Admin...');
  await page.locator('label:has-text("Username") input').fill('admin');
  await page.locator('label:has-text("Password") input').fill('ChangeMe123!');
  await page.locator('button:has-text("Sign in")').click();

  await page.waitForURL('**/admin**', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // 1. Facilities List
  console.log('Navigating to /admin/facilities...');
  await page.goto('http://localhost:5173/admin/facilities');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  console.log('Capturing web_07_facilities_list.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_07_facilities_list.png'), fullPage: true });

  // 2. Facility Detail Page
  console.log(`Navigating to /admin/facilities/${candolim.id}...`);
  await page.goto(`http://localhost:5173/admin/facilities/${candolim.id}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  console.log('Capturing web_08_facility_detail_staff.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_08_facility_detail_staff.png'), fullPage: true });

  // 3. Profile Corrections List
  console.log('Navigating to /admin/corrections...');
  await page.goto('http://localhost:5173/admin/corrections');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  console.log('Capturing web_09_profile_corrections_review.png...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_09_profile_corrections_review.png'), fullPage: true });

  // 4. Click Review Modal
  const reviewBtn = page.locator('button:has-text("Review")').first();
  if (await reviewBtn.count() > 0) {
    console.log('Opening Profile Correction Review modal...');
    await reviewBtn.click();
    await page.waitForTimeout(500);
    console.log('Capturing web_10_profile_correction_modal.png...');
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'web_10_profile_correction_modal.png') });
  }

  await browser.close();
  await prisma.$disconnect();
  console.log('All screenshots captured successfully!');
}

main().catch(err => {
  console.error('Fatal error in screenshot script:', err);
  process.exit(1);
});
