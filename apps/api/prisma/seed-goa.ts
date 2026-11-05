/**
 * Seed Goa Geographical Hierarchy
 *
 * Populates official State -> District -> Taluka -> Area hierarchy into LocationNode.
 * Idempotent: will not duplicate or overwrite existing UUIDs.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { GOA_DISTRICTS, GOA_GEOGRAPHY_METADATA } from '../src/admin/goa-geography.data';

const prisma = new PrismaClient();

export async function seedGoaHierarchy() {
  console.log(`Seeding Goa geography from authoritative source:`);
  console.log(`Source: ${GOA_GEOGRAPHY_METADATA.sourceDocument}`);

  // 1. State: Goa
  let state = await prisma.locationNode.findFirst({
    where: { level: 'STATE', name: 'Goa' },
  });
  if (!state) {
    state = await prisma.locationNode.create({
      data: { level: 'STATE', name: 'Goa', parentId: null },
    });
  }

  let districtsCount = 0;
  let talukasCount = 0;
  let areasCount = 0;

  for (const d of GOA_DISTRICTS) {
    let district = await prisma.locationNode.findFirst({
      where: { level: 'DISTRICT', name: d.name, parentId: state.id },
    });
    if (!district) {
      district = await prisma.locationNode.create({
        data: { level: 'DISTRICT', name: d.name, parentId: state.id },
      });
    }
    districtsCount += 1;

    for (const t of d.talukas) {
      let taluka = await prisma.locationNode.findFirst({
        where: { level: 'TALUKA', name: t.name, parentId: district.id },
      });
      if (!taluka) {
        // Also check if taluka exists under any district (in case of reassignment like Kushavati)
        const existingTaluka = await prisma.locationNode.findFirst({
          where: { level: 'TALUKA', name: t.name },
        });
        if (existingTaluka) {
          taluka = await prisma.locationNode.update({
            where: { id: existingTaluka.id },
            data: { parentId: district.id },
          });
        } else {
          taluka = await prisma.locationNode.create({
            data: { level: 'TALUKA', name: t.name, parentId: district.id },
          });
        }
      }
      talukasCount += 1;

      for (const areaName of t.villagesAndTowns) {
        let area = await prisma.locationNode.findFirst({
          where: { level: 'AREA', name: areaName, parentId: taluka.id },
        });
        if (!area) {
          // Check if area already exists under any taluka to preserve UUID
          const existingArea = await prisma.locationNode.findFirst({
            where: { level: 'AREA', name: areaName },
          });
          if (existingArea) {
            area = await prisma.locationNode.update({
              where: { id: existingArea.id },
              data: { parentId: taluka.id },
            });
          } else {
            area = await prisma.locationNode.create({
              data: { level: 'AREA', name: areaName, parentId: taluka.id },
            });
          }
        }
        areasCount += 1;
      }
    }
  }

  console.log(`Seeded Goa hierarchy: 1 State, ${districtsCount} Districts, ${talukasCount} Talukas, ${areasCount} Areas/Villages/Towns.`);
}

if (require.main === module) {
  seedGoaHierarchy()
    .catch((e) => {
      console.error('Failed to seed Goa hierarchy:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
