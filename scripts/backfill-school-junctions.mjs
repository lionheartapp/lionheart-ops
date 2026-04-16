/**
 * Backfill Script: Populate BuildingSchool + AreaSchool junction tables
 *
 * Migrates from the old single-school model (Building.schoolId + schoolDivision enum)
 * to the new M:N junction model (BuildingSchool, AreaSchool).
 *
 * Rules:
 *  - Building with schoolId set → create a single BuildingSchool row
 *  - Building with schoolId null + schoolDivision != 'GLOBAL' → look up a School in the
 *    same campus matching the gradeLevel enum, link to it. If not found, leave empty (shared).
 *  - Building with schoolDivision == 'GLOBAL' → leave junction empty (shared with all schools).
 *  - Area has no schoolId or schoolDivision today. If buildingId is set, inherit from that
 *    building's new junction. If buildingId is null (outdoor), leave empty (shared).
 *
 * Safe to run multiple times — uses upserts.
 *
 * Usage:
 *   node scripts/backfill-school-junctions.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DIVISION_TO_GRADE_LEVEL = {
  ELEMENTARY: 'ELEMENTARY',
  MIDDLE_SCHOOL: 'MIDDLE_SCHOOL',
  HIGH_SCHOOL: 'HIGH_SCHOOL',
}

async function main() {
  console.log('🔗 Backfill School Junctions — Starting...\n')

  const buildings = await prisma.building.findMany({
    select: {
      id: true,
      organizationId: true,
      campusId: true,
      schoolId: true,
      schoolDivision: true,
      name: true,
    },
  })

  console.log(`Found ${buildings.length} building(s)\n`)

  let buildingLinks = 0
  let buildingsShared = 0
  let buildingsSkipped = 0

  for (const b of buildings) {
    let targetSchoolId = b.schoolId

    // If no explicit schoolId but has a non-GLOBAL division, try to find matching school in same campus
    if (!targetSchoolId && b.schoolDivision && b.schoolDivision !== 'GLOBAL') {
      const gradeLevel = DIVISION_TO_GRADE_LEVEL[b.schoolDivision]
      if (gradeLevel) {
        const match = await prisma.school.findFirst({
          where: {
            organizationId: b.organizationId,
            campusId: b.campusId,
            gradeLevel,
            deletedAt: null,
          },
          select: { id: true },
        })
        if (match) targetSchoolId = match.id
      }
    }

    if (!targetSchoolId) {
      // GLOBAL or no match → shared, leave junction empty
      buildingsShared++
      continue
    }

    try {
      await prisma.buildingSchool.upsert({
        where: { buildingId_schoolId: { buildingId: b.id, schoolId: targetSchoolId } },
        update: {},
        create: { buildingId: b.id, schoolId: targetSchoolId },
      })
      buildingLinks++
    } catch (err) {
      console.warn(`  ⚠️  Skipped ${b.name} (${b.id}): ${err.message}`)
      buildingsSkipped++
    }
  }

  console.log(`  ✓ Created ${buildingLinks} building→school links`)
  console.log(`  · ${buildingsShared} buildings left as shared (no specific school)`)
  if (buildingsSkipped) console.log(`  ⚠️  ${buildingsSkipped} buildings skipped due to errors`)

  // Areas: inherit from their parent building's new junction
  const areas = await prisma.area.findMany({
    select: { id: true, buildingId: true, name: true },
  })

  console.log(`\nFound ${areas.length} area(s)\n`)

  let areaLinks = 0
  let areasShared = 0

  for (const a of areas) {
    if (!a.buildingId) {
      // Outdoor space — leave empty (shared) for now
      areasShared++
      continue
    }

    const parentLinks = await prisma.buildingSchool.findMany({
      where: { buildingId: a.buildingId },
      select: { schoolId: true },
    })

    if (parentLinks.length === 0) {
      areasShared++
      continue
    }

    for (const link of parentLinks) {
      await prisma.areaSchool.upsert({
        where: { areaId_schoolId: { areaId: a.id, schoolId: link.schoolId } },
        update: {},
        create: { areaId: a.id, schoolId: link.schoolId },
      })
      areaLinks++
    }
  }

  console.log(`  ✓ Created ${areaLinks} area→school links`)
  console.log(`  · ${areasShared} areas left as shared`)

  console.log('\n✅ Backfill complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
