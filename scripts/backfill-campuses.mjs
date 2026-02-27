/**
 * Backfill Script: Create default Campus records for existing organizations
 *
 * This script:
 * 1. Finds all organizations that don't yet have a Campus
 * 2. Creates a "Main Campus" (HEADQUARTERS) for each, using the org's address/coords
 * 3. Sets campusId on all existing Schools, Buildings, and Areas for that org
 *
 * Safe to run multiple times — skips orgs that already have a campus.
 *
 * Usage:
 *   node scripts/backfill-campuses.mjs           # uses DATABASE_URL from .env.local or .env
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🏫 Backfill Campuses — Starting...\n')

  // Find all organizations
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      physicalAddress: true,
      latitude: true,
      longitude: true,
    },
  })

  console.log(`Found ${orgs.length} organization(s)\n`)

  let created = 0
  let skipped = 0

  for (const org of orgs) {
    // Check if org already has a campus
    const existingCampus = await prisma.campus.findFirst({
      where: { organizationId: org.id },
      select: { id: true, name: true },
    })

    if (existingCampus) {
      console.log(`  ⏭  ${org.name} — already has campus "${existingCampus.name}", skipping`)
      skipped++
      continue
    }

    // Create default HQ campus
    const campus = await prisma.campus.create({
      data: {
        organizationId: org.id,
        name: 'Main Campus',
        address: org.physicalAddress ?? null,
        latitude: org.latitude ?? null,
        longitude: org.longitude ?? null,
        campusType: 'HEADQUARTERS',
        isActive: true,
        sortOrder: 0,
      },
      select: { id: true },
    })

    // Backfill campusId on Schools
    const schoolResult = await prisma.school.updateMany({
      where: { organizationId: org.id, campusId: null },
      data: { campusId: campus.id },
    })

    // Backfill campusId on Buildings
    const buildingResult = await prisma.building.updateMany({
      where: { organizationId: org.id, campusId: null },
      data: { campusId: campus.id },
    })

    // Backfill campusId on Areas
    const areaResult = await prisma.area.updateMany({
      where: { organizationId: org.id, campusId: null },
      data: { campusId: campus.id },
    })

    console.log(
      `  ✅ ${org.name} — created "Main Campus" ` +
      `(${schoolResult.count} schools, ${buildingResult.count} buildings, ${areaResult.count} areas backfilled)`
    )
    created++
  }

  console.log(`\n✅ Done! Created ${created} campus(es), skipped ${skipped}.\n`)
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
