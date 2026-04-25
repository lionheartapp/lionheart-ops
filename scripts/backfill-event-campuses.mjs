/**
 * Backfill Script: Set campusId on EventProjects by matching locationText
 *
 * Matches EventProjects that have locationText but no campusId by:
 * 1. Checking if locationText contains a campus name (substring match)
 * 2. Checking if locationText contains a building name, then using that building's campusId
 *
 * Safe to run multiple times — only updates records where campusId is null.
 *
 * Usage:
 *   node scripts/backfill-event-campuses.mjs           # uses DATABASE_URL from .env.local or .env
 *   node scripts/backfill-event-campuses.mjs --dry-run  # preview changes without writing
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const isDryRun = process.argv.includes('--dry-run')

async function main() {
  console.log(`🎯 Backfill EventProject campusId — ${isDryRun ? 'DRY RUN' : 'LIVE'}\n`)

  // 1. Fetch all campuses
  const campuses = await prisma.campus.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, organizationId: true },
  })
  console.log(`  Found ${campuses.length} campuses`)

  // 2. Fetch all buildings with their campusId
  const buildings = await prisma.building.findMany({
    where: { deletedAt: null, campusId: { not: null } },
    select: { id: true, name: true, campusId: true, organizationId: true },
  })
  console.log(`  Found ${buildings.length} buildings with campusId`)

  // 3. Fetch all rooms with building info for room-name matching
  const rooms = await prisma.room.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      displayName: true,
      roomNumber: true,
      building: { select: { id: true, campusId: true } },
    },
  })
  console.log(`  Found ${rooms.length} rooms`)

  // 4. Find EventProjects with no campusId but with locationText
  const events = await prisma.eventProject.findMany({
    where: {
      campusId: null,
      locationText: { not: null },
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      locationText: true,
      buildingId: true,
      roomId: true,
      organizationId: true,
    },
  })
  console.log(`  Found ${events.length} events with locationText but no campusId\n`)

  if (events.length === 0) {
    console.log('✅ Nothing to backfill — all events already have campusId set')
    return
  }

  let matched = 0
  let unmatched = 0

  for (const event of events) {
    const loc = (event.locationText || '').toLowerCase()
    let resolvedCampusId = null
    let matchSource = ''

    // Strategy 1: If event has a buildingId, use that building's campusId
    if (event.buildingId) {
      const building = buildings.find(b => b.id === event.buildingId)
      if (building?.campusId) {
        resolvedCampusId = building.campusId
        matchSource = `buildingId → ${building.name}`
      }
    }

    // Strategy 2: If event has a roomId, use the room's building's campusId
    if (!resolvedCampusId && event.roomId) {
      const room = rooms.find(r => r.id === event.roomId)
      if (room?.building?.campusId) {
        resolvedCampusId = room.building.campusId
        matchSource = `roomId → ${room.displayName || room.roomNumber}`
      }
    }

    // Strategy 3: Match locationText against campus names
    if (!resolvedCampusId) {
      const orgCampuses = campuses.filter(c => c.organizationId === event.organizationId)
      for (const campus of orgCampuses) {
        if (loc.includes(campus.name.toLowerCase())) {
          resolvedCampusId = campus.id
          matchSource = `locationText contains "${campus.name}"`
          break
        }
      }
    }

    // Strategy 4: Match locationText against building names → building's campusId
    if (!resolvedCampusId) {
      const orgBuildings = buildings.filter(b => b.organizationId === event.organizationId)
      for (const building of orgBuildings) {
        if (loc.includes(building.name.toLowerCase())) {
          resolvedCampusId = building.campusId
          matchSource = `locationText contains building "${building.name}"`
          break
        }
      }
    }

    if (resolvedCampusId) {
      const campusName = campuses.find(c => c.id === resolvedCampusId)?.name || resolvedCampusId
      console.log(`  ✅ "${event.title}" → ${campusName} (${matchSource})`)

      if (!isDryRun) {
        await prisma.eventProject.update({
          where: { id: event.id },
          data: { campusId: resolvedCampusId },
        })
      }
      matched++
    } else {
      console.log(`  ⚠️  "${event.title}" — no match for "${event.locationText}"`)
      unmatched++
    }
  }

  console.log(`\n${isDryRun ? '🔍 DRY RUN' : '✅ Done'}: ${matched} matched, ${unmatched} unmatched out of ${events.length} events`)
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
