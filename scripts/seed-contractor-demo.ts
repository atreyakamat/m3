import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding contractor demo data...');

  const tempPinHash = await bcrypt.hash('4321', 10);
  const workerPinHash = await bcrypt.hash('1234', 10);

  // 1. Ensure Contractor record
  let contractor = await prisma.contractor.findFirst({
    where: { name: 'Apex Coastal Builders' },
  });
  if (!contractor) {
    contractor = await prisma.contractor.create({
      data: { name: 'Apex Coastal Builders' },
    });
  }

  // 2. Ensure Area
  let area = await prisma.locationNode.findFirst({ where: { name: 'Bardez' } });
  if (!area) {
    const state = await prisma.locationNode.create({ data: { level: 'STATE', name: 'Goa' } });
    const district = await prisma.locationNode.create({ data: { level: 'DISTRICT', name: 'North Goa', parentId: state.id } });
    area = await prisma.locationNode.create({ data: { level: 'TALUKA', name: 'Bardez', parentId: district.id } });
  }

  // 3. Ensure two sites assigned to this contractor
  let site1 = await prisma.constructionSite.findUnique({ where: { siteCode: 'SITE-82WUJS' } });
  if (!site1) {
    site1 = await prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-82WUJS',
        name: 'Mandovi Estuary Project',
        areaId: area.id,
        contractorId: contractor.id,
        address: 'Betim Jetty Terminal, Bardez, North Goa',
      },
    });
  } else {
    site1 = await prisma.constructionSite.update({
      where: { siteCode: 'SITE-82WUJS' },
      data: { contractorId: contractor.id },
    });
  }

  let site2 = await prisma.constructionSite.findUnique({ where: { siteCode: 'SITE-MRMR01' } });
  if (!site2) {
    site2 = await prisma.constructionSite.create({
      data: {
        siteCode: 'SITE-MRMR01',
        name: 'Miramar Seaside Complex',
        areaId: area.id,
        contractorId: contractor.id,
        address: 'Miramar Circle, Panaji, North Goa',
      },
    });
  } else {
    site2 = await prisma.constructionSite.update({
      where: { siteCode: 'SITE-MRMR01' },
      data: { contractorId: contractor.id },
    });
  }

  // 4. Update or create Contractor User with temporary PIN 4321
  let user = await prisma.user.findFirst({
    where: { OR: [{ phone: '9822112233' }, { stakeholderCode: 'C000001' }] },
  });
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        phone: '9822112233',
        stakeholderCode: 'C000001',
        displayName: 'Apex Coastal Builders',
        passwordHash: tempPinHash,
        mustChangeCredential: true,
        contractorId: contractor.id,
        role: 'CONTRACTOR',
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        phone: '9822112233',
        stakeholderCode: 'C000001',
        displayName: 'Apex Coastal Builders',
        passwordHash: tempPinHash,
        mustChangeCredential: true,
        contractorId: contractor.id,
        role: 'CONTRACTOR',
      },
    });
  }

  // Helper to ensure worker
  async function ensureWorker(code: string, name: string, phone: string, age: number, gender: string) {
    let w = await prisma.worker.findFirst({ where: { OR: [{ workerCode: code }, { phone }] } });
    if (!w) {
      w = await prisma.worker.create({
        data: {
          workerCode: code,
          name,
          phone,
          preferredLanguage: 'en',
        },
      });
    } else {
      w = await prisma.worker.update({
        where: { id: w.id },
        data: { name, phone },
      });
    }

    let u = await prisma.user.findFirst({ where: { phone } });
    if (!u) {
      await prisma.user.create({
        data: {
          phone,
          displayName: name,
          pinHash: workerPinHash,
          role: 'WORKER',
          workerId: w.id,
        },
      });
    }

    let scr = await prisma.initialScreening.findUnique({ where: { workerId: w.id } });
    if (!scr) {
      await prisma.initialScreening.create({
        data: {
          workerId: w.id,
          version: '1.0',
          status: 'COMPLETE',
          consentGiven: true,
          answers: { age, gender, state_of_origin: 'Bihar' },
          completedAt: new Date(),
        },
      });
    }
    return w;
  }

  // 5. Workers at SITE-82WUJS
  const wPos = await ensureWorker('M3-POS-01', 'Raju Sharma (Positive)', '9822112231', 32, 'MALE');
  const wNeg = await ensureWorker('M3-NEG-01', 'Amit Kumar (Negative)', '9822112232', 28, 'MALE');
  const wAwt = await ensureWorker('M3-AWT-01', 'Sunil Yadav (Awaiting)', '9822112234', 35, 'MALE');
  const wReg = await ensureWorker('M3-REG-01', 'Deepak Verma (No Result)', '9822112235', 24, 'MALE');

  // Assign them to SITE-82WUJS
  for (const w of [wPos, wNeg, wAwt, wReg]) {
    await prisma.workerSiteAssignment.deleteMany({ where: { workerId: w.id } });
    await prisma.workerSiteAssignment.create({
      data: { workerId: w.id, siteId: site1.id, active: true },
    });
  }

  // Malaria episodes & diagnostics
  // Raju: POSITIVE
  let epPos = await prisma.malariaEpisode.findFirst({ where: { workerId: wPos.id } });
  if (!epPos) {
    epPos = await prisma.malariaEpisode.create({
      data: { workerId: wPos.id, status: 'CONFIRMED' },
    });
  }
  await prisma.diagnosticResult.deleteMany({ where: { episodeId: epPos.id } });
  await prisma.diagnosticResult.create({
    data: {
      episodeId: epPos.id,
      testType: 'RDT',
      result: 'POSITIVE',
      testDate: new Date(),
    },
  });

  // Amit: NEGATIVE
  let epNeg = await prisma.malariaEpisode.findFirst({ where: { workerId: wNeg.id } });
  if (!epNeg) {
    epNeg = await prisma.malariaEpisode.create({
      data: { workerId: wNeg.id, status: 'RESOLVED' },
    });
  }
  await prisma.diagnosticResult.deleteMany({ where: { episodeId: epNeg.id } });
  await prisma.diagnosticResult.create({
    data: {
      episodeId: epNeg.id,
      testType: 'RDT',
      result: 'NEGATIVE',
      testDate: new Date(),
    },
  });

  // Sunil: AWAITING
  let epAwt = await prisma.malariaEpisode.findFirst({ where: { workerId: wAwt.id } });
  if (!epAwt) {
    await prisma.malariaEpisode.create({
      data: { workerId: wAwt.id, status: 'SUSPECTED' },
    });
  }

  // 6. Travel for Raju (Positive) in 4 days -> 7-day Alert!
  const departureDate = new Date(Date.now() + 4 * 24 * 3600 * 1000);
  const returnDate = new Date(Date.now() + 18 * 24 * 3600 * 1000);
  await prisma.travelRecord.deleteMany({ where: { workerId: wPos.id } });
  const travelRec = await prisma.travelRecord.create({
    data: {
      workerId: wPos.id,
      departureDate,
      returnDate,
      destination: 'Patna Junction',
      state: 'Bihar',
      status: 'PLANNED',
    },
  });

  // 7. Site Join Request from worker TEST-M3-JOIN-01
  const wJoin = await ensureWorker('M3-JOIN-01', 'Vikram Singh (Join Req)', '9822112236', 30, 'MALE');
  await prisma.siteJoinRequest.deleteMany({ where: { workerId: wJoin.id } });
  await prisma.siteJoinRequest.create({
    data: {
      workerId: wJoin.id,
      siteId: site1.id,
      status: 'PENDING',
    },
  });

  // 8. Site Transfer Request from SITE-82WUJS to SITE-MRMR01
  await prisma.siteTransferRequest.deleteMany({ where: { workerId: wNeg.id } });
  const tr = await prisma.siteTransferRequest.create({
    data: {
      workerId: wNeg.id,
      fromSiteId: site1.id,
      toSiteId: site2.id,
      initiatorType: 'CONTRACTOR',
      initiatorId: user.id,
      fromContractorDecision: 'PENDING',
      toContractorDecision: 'PENDING',
      workerDecision: 'APPROVED',
      status: 'PENDING_CURRENT_CONTRACTOR',
      note: 'Relocation to Miramar site for scaffolding',
    },
  });

  // 9. Contractor Notifications
  await prisma.notification.deleteMany({ where: { audienceUserId: user.id } });
  await prisma.notification.create({
    data: {
      audienceRole: 'CONTRACTOR',
      audienceUserId: user.id,
      type: 'TRAVEL_ALERT',
      title: 'High-Risk Travel Alert: Positive Worker',
      body: 'Worker Raju Sharma tested positive for Malaria and has scheduled travel to Bihar departing in 4 days.',
      entityType: 'TRAVEL_RECORD',
      entityId: travelRec.id,
      dedupeKey: `DEMO_TRAVEL_ALERT:${travelRec.id}`,
    },
  });
  await prisma.notification.create({
    data: {
      audienceRole: 'CONTRACTOR',
      audienceUserId: user.id,
      type: 'JOIN_REQUEST',
      title: 'New Site Join Request',
      body: 'Worker Vikram Singh requested to join Mandovi Estuary Project.',
      entityType: 'JOIN_REQUEST',
      entityId: wJoin.id,
      dedupeKey: `DEMO_JOIN_REQ:${wJoin.id}`,
    },
  });
  await prisma.notification.create({
    data: {
      audienceRole: 'CONTRACTOR',
      audienceUserId: user.id,
      type: 'TRANSFER_REQUEST',
      title: 'Site Transfer Pending Approval',
      body: 'Transfer request for Amit Kumar to Miramar Seaside Complex requires your review.',
      entityType: 'TRANSFER',
      entityId: tr.id,
      dedupeKey: `DEMO_TRANSFER:${tr.id}`,
    },
  });

  console.log('Contractor demo seed complete!');
}

main().finally(() => prisma.$disconnect());
