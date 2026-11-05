import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://m3:change-me-in-prod@localhost:5544/m3?schema=public';
const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

async function resetAndSeed() {
  console.log('====================================================');
  console.log('Starting M3 Database Reset & Synthetic Test Data Seed');
  console.log('Target Database:', DATABASE_URL);
  console.log('====================================================');

  // 1. Verify Admin Account
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN', username: 'admin' },
  });

  if (!adminUser) {
    throw new Error('FATAL: Existing Admin account (username: admin) not found in database! Aborting reset.');
  }

  console.log('Preserved Admin Account Found:');
  console.log('  ID:          ', adminUser.id);
  console.log('  Username:    ', adminUser.username);
  console.log('  Role:        ', adminUser.role);
  console.log('  Display Name:', adminUser.displayName);
  console.log('  PasswordHash:', adminUser.passwordHash.substring(0, 15) + '...');
  console.log('  Active:      ', adminUser.active);

  // 2. Perform Transactional Deletion of all demo and test records
  console.log('\nExecuting cascaded deletion of demo and test records...');
  await prisma.$transaction(async (tx) => {
    // Delete audit logs for non-admin actions
    await tx.auditLog.deleteMany({
      where: {
        OR: [
          { actorId: { not: adminUser.id } },
          { actorId: null },
        ],
      },
    });

    await tx.notification.deleteMany({});
    await tx.idempotencyKey.deleteMany({});
    await tx.workerPassToken.deleteMany({});
    await tx.travelReport.deleteMany({});
    await tx.travelRecord.deleteMany({});
    await tx.siteJoinRequest.deleteMany({});
    await tx.siteTransferRequest.deleteMany({});
    await tx.workerSiteAssignment.deleteMany({});
    await tx.prescription.deleteMany({});
    await tx.diagnosticResult.deleteMany({});
    await tx.malariaEpisode.deleteMany({});
    await tx.symptomReport.deleteMany({});
    await tx.followUp.deleteMany({});
    await tx.initialScreening.deleteMany({});
    await tx.contractorSite.deleteMany({});
    await tx.worker.deleteMany({});
    await tx.constructionSite.deleteMany({});
    await tx.contractor.deleteMany({});
    // Delete all users except Admin
    await tx.user.deleteMany({
      where: { id: { not: adminUser.id } },
    });
  });

  console.log('Deletion complete. Confirming Admin preservation...');
  const adminAfter = await prisma.user.findUnique({ where: { id: adminUser.id } });
  if (!adminAfter || adminAfter.passwordHash !== adminUser.passwordHash) {
    throw new Error('FATAL: Admin account was altered during deletion!');
  }
  console.log('Admin account verified untouched.');

  // 3. Find valid Goa Area
  const candolimArea = await prisma.locationNode.findFirst({
    where: { level: 'AREA', name: 'Candolim' },
  });
  const area = candolimArea || (await prisma.locationNode.findFirst({ where: { level: 'AREA' } }));
  if (!area) {
    throw new Error('No valid Area found in LocationNode reference data!');
  }
  console.log(`Using valid Goa Area: ${area.name} (id: ${area.id})`);

  // 4. Create Contractors
  console.log('\nCreating 2 Contractor accounts...');
  const pin1234Hash = await bcrypt.hash('1234', 10);

  // Contractor 1
  const contractor1Entity = await prisma.contractor.create({
    data: { name: 'Test Contractor One' },
  });
  const contractor1User = await prisma.user.create({
    data: {
      role: 'CONTRACTOR',
      displayName: 'Test Contractor One',
      phone: '9000000101',
      stakeholderCode: 'C000001',
      passwordHash: pin1234Hash,
      mustChangeCredential: true,
      active: true,
      contractorId: contractor1Entity.id,
    },
  });
  console.log('  Contractor 1 created: Test Contractor One (Phone: 9000000101, Code: C000001)');

  // Contractor 2
  const contractor2Entity = await prisma.contractor.create({
    data: { name: 'Test Contractor Two' },
  });
  const contractor2User = await prisma.user.create({
    data: {
      role: 'CONTRACTOR',
      displayName: 'Test Contractor Two',
      phone: '9000000102',
      stakeholderCode: 'C000002',
      passwordHash: pin1234Hash,
      mustChangeCredential: true,
      active: true,
      contractorId: contractor2Entity.id,
    },
  });
  console.log('  Contractor 2 created: Test Contractor Two (Phone: 9000000102, Code: C000002)');

  // 5. Create 1 Construction Site: SITE-TEST01
  console.log('\nCreating 1 Construction Site: SITE-TEST01...');
  const site = await prisma.constructionSite.create({
    data: {
      siteCode: 'SITE-TEST01',
      name: 'M3 Test Construction Site',
      areaId: area.id,
      contractorId: contractor1Entity.id, // Primary contractor
      active: true,
      address: 'Plot 101, Near Health Centre, Candolim Coastal Road, North Goa',
      landmark: 'Candolim Health Centre',
      contactPhone: '9000000100',
    },
  });

  // Assign both contractors to the site via ContractorSite
  await prisma.contractorSite.create({
    data: {
      contractorId: contractor1Entity.id,
      siteId: site.id,
      active: true,
    },
  });
  await prisma.contractorSite.create({
    data: {
      contractorId: contractor2Entity.id,
      siteId: site.id,
      active: true,
    },
  });
  console.log('  Site SITE-TEST01 created and linked to both Contractor 1 and Contractor 2.');

  // 6. Create Authorized Clinician (per Section 8.7)
  console.log('\nCreating Authorized Clinician (per Section 8.7)...');
  const clinicianUser = await prisma.user.create({
    data: {
      role: 'CLINICIAN',
      displayName: 'Dr. Test Clinician',
      phone: '9000000301',
      stakeholderCode: 'CL000001',
      passwordHash: pin1234Hash,
      mustChangeCredential: true,
      active: true,
    },
  });
  console.log('  Clinician created: Dr. Test Clinician (Phone: 9000000301, Code: CL000001)');

  // 7. Create 4 Synthetic Worker Accounts
  console.log('\nCreating 4 Synthetic Worker Accounts...');
  const workersData = [
    {
      code: 'M3-TEST01',
      name: 'Test Worker Positive One',
      phone: '9000000201',
      result: 'POSITIVE',
      episodeStatus: 'CONFIRMED',
    },
    {
      code: 'M3-TEST02',
      name: 'Test Worker Positive Two',
      phone: '9000000202',
      result: 'POSITIVE',
      episodeStatus: 'CONFIRMED',
    },
    {
      code: 'M3-TEST03',
      name: 'Test Worker Negative One',
      phone: '9000000203',
      result: 'NEGATIVE',
      episodeStatus: 'RESOLVED',
    },
    {
      code: 'M3-TEST04',
      name: 'Test Worker Negative Two',
      phone: '9000000204',
      result: 'NEGATIVE',
      episodeStatus: 'RESOLVED',
    },
  ];

  for (const item of workersData) {
    const workerEntity = await prisma.worker.create({
      data: {
        workerCode: item.code,
        name: item.name,
        phone: item.phone,
        preferredLanguage: 'en',
      },
    });

    const workerUser = await prisma.user.create({
      data: {
        role: 'WORKER',
        displayName: item.name,
        phone: item.phone,
        pinHash: pin1234Hash,
        workerId: workerEntity.id,
        active: true,
        mustChangeCredential: false,
      },
    });

    // Complete Initial Screening
    await prisma.initialScreening.create({
      data: {
        workerId: workerEntity.id,
        version: '1.0',
        status: 'COMPLETE',
        consentGiven: true,
        completedAt: new Date(),
        answers: {
          full_name: item.name,
          mobile_number: item.phone,
          age: 32,
          gender: 'male',
          synthetic_test_record: true,
          fever_today: item.result === 'POSITIVE' ? 'yes' : 'no',
        },
      },
    });

    // Active Worker Site Assignment on SITE-TEST01
    await prisma.workerSiteAssignment.create({
      data: {
        workerId: workerEntity.id,
        siteId: site.id,
        contractorId: null, // Shared across assigned contractors on this site
        active: true,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    // Diagnostic Record via Authorized Workflow
    const episode = await prisma.malariaEpisode.create({
      data: {
        workerId: workerEntity.id,
        status: item.episodeStatus,
        onsetDate: new Date(),
      },
    });

    await prisma.diagnosticResult.create({
      data: {
        episodeId: episode.id,
        testType: 'RDT',
        result: item.result,
        testDate: new Date(),
        createdById: clinicianUser.id,
      },
    });

    console.log(`  Worker created: ${item.name} (${item.code}, Phone: ${item.phone}) -> Result: ${item.result}`);
  }

  console.log('\n====================================================');
  console.log('Database Reset and Test Account Seed Complete!');
  console.log('====================================================');
}

resetAndSeed()
  .catch((e) => {
    console.error('Reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
