import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://m3:change-me-in-prod@localhost:5544/m3?schema=public';
const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

export async function seedSimulationDataset() {
  console.log('Seeding dedicated simulation dataset on:', DATABASE_URL);

  const pinHash = await bcrypt.hash('1234', 10);

  // 1. Ensure Panaji or Candolim location area
  const area = (await prisma.locationNode.findFirst({ where: { level: 'AREA', name: 'Panaji' } }))
    || (await prisma.locationNode.findFirst({ where: { level: 'AREA', name: 'Candolim' } }))
    || (await prisma.locationNode.findFirst({ where: { level: 'AREA' } }));

  if (!area) throw new Error('No valid LocationNode area found!');

  // 2. Ensure facility PHC-001 exists
  let facility = await prisma.facility.findUnique({ where: { facilityCode: 'PHC-001' } });
  if (!facility) {
    facility = await prisma.facility.create({
      data: {
        facilityCode: 'PHC-001',
        name: 'Candolim Primary Health Centre',
        type: 'PHC',
        state: 'Goa',
        district: 'North Goa',
        taluka: 'Bardez',
        address: 'Near Candolim Panchayat, Main Road, Candolim, Goa 403515',
        latitude: 15.5185,
        longitude: 73.7682,
        contactPhone: '0832-2489021',
        contactEmail: 'phc.candolim@health.goa.gov.in',
        active: true,
      },
    });
  }

  // 3. Create or update Construction Site: SITE-SIM01
  let site = await prisma.constructionSite.findUnique({ where: { siteCode: 'SITE-SIM01' } });
  if (!site) {
    site = await prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-SIM01',
        name: 'M3 Simulation Construction Site - Panaji Coastal',
        areaId: area.id,
        address: 'Plot 42, Mandovi Bay Promenade, Panaji, North Goa 403001',
        landmark: 'Near Mandovi River Viewpoint',
        contactPhone: '9800000001',
        active: true,
      },
    });
  }
  console.log('Simulation Site ready:', site.siteCode, site.name);

  // 4. Create or update Contractors: C-SIM01 & C-SIM02
  const contractorsData = [
    { name: 'Simulation Contractor Alpha', code: 'C-SIM01', phone: '9800000101' },
    { name: 'Simulation Contractor Beta', code: 'C-SIM02', phone: '9800000102' },
  ];

  const contractorEntities = [];
  for (const c of contractorsData) {
    let contractor = await prisma.contractor.findFirst({ where: { name: c.name } });
    if (!contractor) {
      contractor = await prisma.contractor.create({ data: { name: c.name } });
    }

    let user = await prisma.user.findFirst({ where: { phone: c.phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          role: 'CONTRACTOR',
          displayName: c.name,
          phone: c.phone,
          stakeholderCode: c.code,
          passwordHash: pinHash,
          mustChangeCredential: true,
          active: true,
          contractorId: contractor.id,
        },
      });
    }

    // Assign to SITE-SIM01
    const existingAssign = await prisma.contractorSite.findFirst({
      where: { contractorId: contractor.id, siteId: site.id },
    });
    if (!existingAssign) {
      await prisma.contractorSite.create({
        data: {
          contractorId: contractor.id,
          siteId: site.id,
          active: true,
        },
      });
    }

    contractorEntities.push({ contractor, user });
    console.log(`Contractor ready: ${c.code} (${c.name}, phone: ${c.phone})`);
  }

  // 5. Create or update Health Worker: HW-SIM01
  let hwUser = await prisma.user.findFirst({ where: { phone: '9800000201' } });
  if (!hwUser) {
    hwUser = await prisma.user.create({
      data: {
        role: 'HEALTH_WORKER',
        displayName: 'Simulation Health Worker',
        username: 'hw_sim01',
        phone: '9800000201',
        stakeholderCode: 'HW-SIM01',
        passwordHash: pinHash,
        mustChangeCredential: true,
        active: true,
      },
    });
  }

  const existingHwAssign = await prisma.facilityStaffAssignment.findFirst({
    where: { userId: hwUser.id, facilityId: facility.id },
  });
  if (!existingHwAssign) {
    await prisma.facilityStaffAssignment.create({
      data: {
        facilityId: facility.id,
        userId: hwUser.id,
        role: 'HEALTH_WORKER',
        active: true,
      },
    });
  }
  console.log(`Health Worker ready: HW-SIM01 (phone: 9800000201, assigned to ${facility.facilityCode})`);

  // Authorised medical staff for diagnostic sign-off
  const clinician = await prisma.user.findFirst({ where: { role: 'CLINICIAN' } });
  const pathologist = await prisma.user.findFirst({ where: { role: 'PATHOLOGIST' } });

  // 6. Create 4 Simulation Workers
  // Worker 1: M3-SIM01 - POSITIVE, 2 dependants
  let w1 = await prisma.worker.findUnique({ where: { workerCode: 'M3-SIM01' } });
  if (!w1) {
    w1 = await prisma.worker.create({
      data: {
        workerCode: 'M3-SIM01',
        name: 'Ramesh Kumar',
        phone: '9800000301',
        preferredLanguage: 'hi',
      },
    });
  }
  let u1 = await prisma.user.findFirst({ where: { workerId: w1.id } });
  if (!u1) {
    u1 = await prisma.user.create({
      data: {
        role: 'WORKER',
        displayName: w1.name,
        phone: w1.phone,
        pinHash,
        active: true,
        workerId: w1.id,
      },
    });
  }
  // Assignment to SITE-SIM01 and Contractor Alpha
  await prisma.workerSiteAssignment.deleteMany({ where: { workerId: w1.id } });
  await prisma.workerSiteAssignment.create({
    data: {
      workerId: w1.id,
      siteId: site.id,
      contractorId: contractorEntities[0].contractor.id,
      active: true,
      status: 'ACTIVE',
    },
  });
  // Screening
  await prisma.initialScreening.deleteMany({ where: { workerId: w1.id } });
  await prisma.initialScreening.create({
    data: {
      workerId: w1.id,
      status: 'COMPLETE',
      version: 'worker-screening-2026-10-31',
      consentGiven: true,
      facilityId: facility.id,
      screenedById: hwUser.id,
      answers: {
        full_name: 'Ramesh Kumar',
        mobile_number: '9800000301',
        gender: 'male',
        age_years: 32,
        fever_today: 'yes',
        diagnosed_malaria: 'yes',
        present_address_site_id: 'SITE-SIM01',
        present_address_district: 'North Goa',
      },
      completedAt: new Date(),
    },
  });
  // Episode & Positive Diagnostic Result
  await prisma.diagnosticResult.deleteMany({ where: { episode: { workerId: w1.id } } });
  await prisma.malariaEpisode.deleteMany({ where: { workerId: w1.id } });
  const ep1 = await prisma.malariaEpisode.create({
    data: {
      workerId: w1.id,
      status: 'CONFIRMED',
      onsetDate: new Date(Date.now() - 3 * 86400000),
    },
  });
  await prisma.diagnosticResult.create({
    data: {
      episodeId: ep1.id,
      testType: 'RDT',
      result: 'POSITIVE',
      species: 'P_VIVAX',
      testDate: new Date(),
      createdById: clinician?.id || null,
    },
  });
  // 2 Dependants
  await prisma.householdMember.deleteMany({ where: { workerId: w1.id } });
  await prisma.householdMember.create({
    data: {
      memberCode: 'M3-HH-SIM01-01',
      workerId: w1.id,
      fullName: 'Sita Kumar',
      relationship: 'SPOUSE',
      ageOrDob: '29',
      gender: 'female',
      isDependent: true,
      livesInSameRoom: true,
      active: true,
    },
  });
  await prisma.householdMember.create({
    data: {
      memberCode: 'M3-HH-SIM01-02',
      workerId: w1.id,
      fullName: 'Aarav Kumar',
      relationship: 'CHILD',
      ageOrDob: '6',
      gender: 'male',
      isDependent: true,
      livesInSameRoom: true,
      active: true,
    },
  });
  console.log('Worker M3-SIM01 ready: POSITIVE, 2 dependants');

  // Worker 2: M3-SIM02 - NEGATIVE, 1 dependant
  let w2 = await prisma.worker.findUnique({ where: { workerCode: 'M3-SIM02' } });
  if (!w2) {
    w2 = await prisma.worker.create({
      data: {
        workerCode: 'M3-SIM02',
        name: 'Suresh Patel',
        phone: '9800000302',
        preferredLanguage: 'gu',
      },
    });
  }
  let u2 = await prisma.user.findFirst({ where: { workerId: w2.id } });
  if (!u2) {
    u2 = await prisma.user.create({
      data: {
        role: 'WORKER',
        displayName: w2.name,
        phone: w2.phone,
        pinHash,
        active: true,
        workerId: w2.id,
      },
    });
  }
  await prisma.workerSiteAssignment.deleteMany({ where: { workerId: w2.id } });
  await prisma.workerSiteAssignment.create({
    data: {
      workerId: w2.id,
      siteId: site.id,
      contractorId: contractorEntities[0].contractor.id,
      active: true,
      status: 'ACTIVE',
    },
  });
  await prisma.initialScreening.deleteMany({ where: { workerId: w2.id } });
  await prisma.initialScreening.create({
    data: {
      workerId: w2.id,
      status: 'COMPLETE',
      version: 'worker-screening-2026-10-31',
      consentGiven: true,
      facilityId: facility.id,
      screenedById: hwUser.id,
      answers: {
        full_name: 'Suresh Patel',
        mobile_number: '9800000302',
        gender: 'male',
        age_years: 28,
        fever_today: 'no',
        diagnosed_malaria: 'no',
      },
      completedAt: new Date(),
    },
  });
  await prisma.diagnosticResult.deleteMany({ where: { episode: { workerId: w2.id } } });
  await prisma.malariaEpisode.deleteMany({ where: { workerId: w2.id } });
  const ep2 = await prisma.malariaEpisode.create({
    data: {
      workerId: w2.id,
      status: 'RESOLVED',
      onsetDate: new Date(Date.now() - 5 * 86400000),
    },
  });
  await prisma.diagnosticResult.create({
    data: {
      episodeId: ep2.id,
      testType: 'RDT',
      result: 'NEGATIVE',
      testDate: new Date(),
      createdById: pathologist?.id || null,
    },
  });
  await prisma.householdMember.deleteMany({ where: { workerId: w2.id } });
  await prisma.householdMember.create({
    data: {
      memberCode: 'M3-HH-SIM02-01',
      workerId: w2.id,
      fullName: 'Geeta Patel',
      relationship: 'SPOUSE',
      ageOrDob: '26',
      gender: 'female',
      isDependent: true,
      livesInSameRoom: true,
      active: true,
    },
  });
  console.log('Worker M3-SIM02 ready: NEGATIVE, 1 dependant');

  // Worker 3: M3-SIM03 - PENDING / AWAITING RESULT, 0 dependants
  let w3 = await prisma.worker.findUnique({ where: { workerCode: 'M3-SIM03' } });
  if (!w3) {
    w3 = await prisma.worker.create({
      data: {
        workerCode: 'M3-SIM03',
        name: 'Vijay Singh',
        phone: '9800000303',
        preferredLanguage: 'hi',
      },
    });
  }
  let u3 = await prisma.user.findFirst({ where: { workerId: w3.id } });
  if (!u3) {
    u3 = await prisma.user.create({
      data: {
        role: 'WORKER',
        displayName: w3.name,
        phone: w3.phone,
        pinHash,
        active: true,
        workerId: w3.id,
      },
    });
  }
  await prisma.workerSiteAssignment.deleteMany({ where: { workerId: w3.id } });
  await prisma.workerSiteAssignment.create({
    data: {
      workerId: w3.id,
      siteId: site.id,
      contractorId: contractorEntities[1].contractor.id,
      active: true,
      status: 'ACTIVE',
    },
  });
  await prisma.initialScreening.deleteMany({ where: { workerId: w3.id } });
  await prisma.initialScreening.create({
    data: {
      workerId: w3.id,
      status: 'COMPLETE',
      version: 'worker-screening-2026-10-31',
      consentGiven: true,
      facilityId: facility.id,
      screenedById: hwUser.id,
      answers: {
        full_name: 'Vijay Singh',
        mobile_number: '9800000303',
        gender: 'male',
        age_years: 25,
        fever_today: 'yes',
      },
      completedAt: new Date(),
    },
  });
  // Suspected episode without diagnostics -> derives AWAITING
  await prisma.diagnosticResult.deleteMany({ where: { episode: { workerId: w3.id } } });
  await prisma.malariaEpisode.deleteMany({ where: { workerId: w3.id } });
  await prisma.malariaEpisode.create({
    data: {
      workerId: w3.id,
      status: 'SUSPECTED',
      onsetDate: new Date(),
    },
  });
  await prisma.householdMember.deleteMany({ where: { workerId: w3.id } });
  console.log('Worker M3-SIM03 ready: PENDING / AWAITING RESULT, 0 dependants');

  // Worker 4: M3-SIM04 - NO RESULT / UNSCREENED, upcoming travel
  let w4 = await prisma.worker.findUnique({ where: { workerCode: 'M3-SIM04' } });
  if (!w4) {
    w4 = await prisma.worker.create({
      data: {
        workerCode: 'M3-SIM04',
        name: 'Manoj Das',
        phone: '9800000304',
        preferredLanguage: 'bn',
      },
    });
  }
  let u4 = await prisma.user.findFirst({ where: { workerId: w4.id } });
  if (!u4) {
    u4 = await prisma.user.create({
      data: {
        role: 'WORKER',
        displayName: w4.name,
        phone: w4.phone,
        pinHash,
        active: true,
        workerId: w4.id,
      },
    });
  }
  await prisma.workerSiteAssignment.deleteMany({ where: { workerId: w4.id } });
  await prisma.workerSiteAssignment.create({
    data: {
      workerId: w4.id,
      siteId: site.id,
      contractorId: contractorEntities[1].contractor.id,
      active: true,
      status: 'ACTIVE',
    },
  });
  // No screening & no episode -> derives NO_RESULT
  await prisma.initialScreening.deleteMany({ where: { workerId: w4.id } });
  await prisma.diagnosticResult.deleteMany({ where: { episode: { workerId: w4.id } } });
  await prisma.malariaEpisode.deleteMany({ where: { workerId: w4.id } });
  await prisma.householdMember.deleteMany({ where: { workerId: w4.id } });

  // Upcoming travel record
  await prisma.travelRecord.deleteMany({ where: { workerId: w4.id } });
  const departureDate = new Date(Date.now() + 3 * 86400000);
  const returnDate = new Date(Date.now() + 20 * 86400000);
  await prisma.travelRecord.create({
    data: {
      workerId: w4.id,
      planningTravel: true,
      departureDate,
      returnDate,
      destination: 'Patna, Bihar',
      state: 'Bihar',
      district: 'Patna',
      purpose: 'Family Festival',
      direction: 'LEAVING_GOA',
      status: 'SUBMITTED',
      hadFeverOrMalaria: false,
    },
  });
  console.log('Worker M3-SIM04 ready: NO_RESULT / UNSCREENED, upcoming travel');

  console.log('\n======================================================');
  console.log('Simulation Dataset Successfully Seeded!');
  console.log('Site:         SITE-SIM01');
  console.log('Contractor A: C-SIM01 (phone: 9800000101, PIN: 1234)');
  console.log('Contractor B: C-SIM02 (phone: 9800000102, PIN: 1234)');
  console.log('Health Worker:HW-SIM01 (phone: 9800000201, PIN: 1234, facility: PHC-001)');
  console.log('Worker 1:     M3-SIM01 (POSITIVE, 2 dependants)');
  console.log('Worker 2:     M3-SIM02 (NEGATIVE, 1 dependant)');
  console.log('Worker 3:     M3-SIM03 (AWAITING, 0 dependants)');
  console.log('Worker 4:     M3-SIM04 (NO_RESULT, upcoming travel)');
  console.log('======================================================');
}

if (process.argv[1]?.endsWith('seed-simulation-dataset.mjs')) {
  seedSimulationDataset()
    .catch((err) => {
      console.error('Failed to seed simulation dataset:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
