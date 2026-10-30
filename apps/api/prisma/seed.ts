/**
 * Seed data for local development and demos only (never production paths).
 * Location hierarchy follows worker_architecture.md §3.4. The district label
 * "Kushavati" is kept exactly as supplied and flagged for master-data review.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { QUESTIONNAIRE_VERSION } from '@m3/shared';

const prisma = new PrismaClient();

async function location(level: any, name: string, parentId: string | null) {
  const existing = await prisma.locationNode.findFirst({ where: { level, name, parentId } });
  if (existing) return existing;
  return prisma.locationNode.create({ data: { level, name, parentId } });
}

async function site(siteCode: string, name: string, areaId: string, contractorId: string | null) {
  return prisma.constructionSite.upsert({
    where: { siteCode },
    update: { name, areaId, contractorId },
    create: { siteCode, name, areaId, contractorId, active: true },
  });
}

async function contractor(id: string, name: string, username: string) {
  const c = await prisma.contractor.upsert({ where: { id }, update: { name }, create: { id, name } });
  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { username },
    update: { contractorId: c.id, displayName: name },
    create: { role: 'CONTRACTOR', username, displayName: name, passwordHash, contractorId: c.id },
  });
  return c;
}

async function staff(role: any, username: string, displayName: string) {
  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { username },
    update: { role, displayName },
    create: { role, username, displayName, passwordHash },
  });
}

async function main() {
  // --- Location hierarchy (State -> District -> Taluka -> Area) ---
  const goa = await location('STATE', 'Goa', null);
  const northGoa = await location('DISTRICT', 'North Goa', goa.id);
  const southGoa = await location('DISTRICT', 'South Goa', goa.id);
  const kushavati = await location('DISTRICT', 'Kushavati', goa.id); // flagged for review

  const bardez = await location('TALUKA', 'Bardez', northGoa.id);
  const tiswadi = await location('TALUKA', 'Tiswadi', northGoa.id);
  const salcete = await location('TALUKA', 'Salcete', southGoa.id);
  const mormugao = await location('TALUKA', 'Mormugao', southGoa.id);
  const quepem = await location('TALUKA', 'Quepem', kushavati.id);

  const candolim = await location('AREA', 'Candolim', bardez.id);
  const panaji = await location('AREA', 'Panaji', tiswadi.id);
  const margao = await location('AREA', 'Margao', salcete.id);
  const vasco = await location('AREA', 'Vasco', mormugao.id);
  const curchorem = await location('AREA', 'Curchorem', quepem.id);

  // --- Contractors (two, so both-side transfer approvals can be demoed) ---
  const contractorNorth = await contractor('11111111-1111-1111-1111-111111111111', 'North Goa Builders', 'contractor.north');
  const contractorSouth = await contractor('22222222-2222-2222-2222-222222222222', 'South Goa Infra', 'contractor.south');

  // --- Construction sites ---
  const siteCandolim = await site('SITE-CNDLM1', 'Candolim Tower Project', candolim.id, contractorNorth.id);
  await site('SITE-PANJI1', 'Panaji Riverfront', panaji.id, contractorNorth.id);
  await site('SITE-MARGO1', 'Margao Metro Depot', margao.id, contractorSouth.id);
  await site('SITE-VASCO1', 'Vasco Port Expansion', vasco.id, contractorSouth.id);
  await site('SITE-CURCH1', 'Curchorem Bridge Works', curchorem.id, contractorSouth.id);

  // --- Placeholder-role staff accounts ---
  await staff('HEALTH_WORKER', 'healthworker', 'Demo Health Worker');
  await staff('CLINICIAN', 'clinician', 'Demo Clinician');
  await staff('PATHOLOGIST', 'pathologist', 'Demo Pathologist');
  await staff('RESEARCH_LAB', 'researchlab', 'Demo Research Lab');
  await staff('ADMIN', 'admin', 'Demo Admin');

  // --- Demo worker (phone 9000000001 / PIN 1234) assigned to Candolim ---
  const pinHash = await bcrypt.hash('1234', 10);
  const worker = await prisma.worker.upsert({
    where: { phone: '9000000001' },
    update: {},
    create: {
      workerCode: 'M3-DEMO01',
      name: 'Asha Demo',
      phone: '9000000001',
      preferredLanguage: 'hi',
      user: { create: { role: 'WORKER', displayName: 'Asha Demo', phone: '9000000001', pinHash } },
    },
  });

  const hasAssignment = await prisma.workerSiteAssignment.findFirst({ where: { workerId: worker.id, active: true } });
  if (!hasAssignment) {
    await prisma.workerSiteAssignment.create({ data: { workerId: worker.id, siteId: siteCandolim.id, active: true } });
  }

  await prisma.initialScreening.upsert({
    where: { workerId: worker.id },
    update: {},
    create: {
      workerId: worker.id,
      status: 'COMPLETE',
      version: QUESTIONNAIRE_VERSION,
      consentGiven: true,
      completedAt: new Date(),
      answers: { full_name: 'Asha Demo', gender: 'female', mobile_number: '9000000001', fever_today: 'no' },
    },
  });

  console.log('Seed complete: locations, 2 contractors, 5 sites, staff accounts, demo worker (9000000001 / PIN 1234).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
