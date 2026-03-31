/**
 * Athletics Module Seed — creates sports, seasons, teams, and sample games.
 *
 * Usage: npm run db:seed:athletics
 */

import { prisma, getDefaultOrg, getAdminUser, getDefaultCampus, logSection } from './shared'
import type { SportSeasonType, TeamLevel } from '@prisma/client'

async function main() {
  const org = await getDefaultOrg()
  const admin = await getAdminUser(org.id)
  const campus = await getDefaultCampus(org.id)
  const orgId = org.id

  logSection('Creating sports')

  const sports: { name: string; abbreviation: string; color: string; icon: string; seasonType: SportSeasonType }[] = [
    { name: 'Football', abbreviation: 'FB', color: '#8B4513', icon: 'football', seasonType: 'FALL' },
    { name: 'Basketball', abbreviation: 'BB', color: '#FF6B00', icon: 'basketball', seasonType: 'WINTER' },
    { name: 'Soccer', abbreviation: 'SOC', color: '#228B22', icon: 'soccer', seasonType: 'FALL' },
    { name: 'Volleyball', abbreviation: 'VB', color: '#4169E1', icon: 'volleyball', seasonType: 'FALL' },
    { name: 'Baseball', abbreviation: 'BSB', color: '#DC143C', icon: 'baseball', seasonType: 'SPRING' },
    { name: 'Track & Field', abbreviation: 'TF', color: '#FFD700', icon: 'running', seasonType: 'SPRING' },
  ]

  const createdSports = []
  for (const s of sports) {
    const sport = await prisma.sport.upsert({
      where: { organizationId_name: { organizationId: orgId, name: s.name } },
      update: {},
      create: { organizationId: orgId, ...s, isActive: true },
    })
    createdSports.push(sport)
    console.log(`  Sport: ${sport.name}`)
  }

  logSection('Creating seasons')

  const now = new Date()
  const year = now.getFullYear()

  for (const sport of createdSports) {
    const seasonName = `${year}-${year + 1}`
    let season = await prisma.athleticSeason.findFirst({
      where: { organizationId: orgId, sportId: sport.id, name: seasonName },
    })
    if (!season) {
      season = await prisma.athleticSeason.create({
        data: {
          organizationId: orgId,
          sportId: sport.id,
          name: seasonName,
          startDate: new Date(`${year}-08-01`),
          endDate: new Date(`${year + 1}-06-01`),
          isCurrent: true,
        },
      })
    }
    console.log(`  Season: ${sport.name} ${season.name}`)

    logSection(`Creating ${sport.name} teams`)

    const levels: { label: string; value: TeamLevel }[] = [
      { label: 'Varsity', value: 'VARSITY' },
      { label: 'Junior Varsity', value: 'JUNIOR_VARSITY' },
    ]
    for (const lvl of levels) {
      const teamName = `${sport.name} ${lvl.label}`
      let team = await prisma.athleticTeam.findFirst({
        where: { organizationId: orgId, seasonId: season.id, name: teamName },
      })
      if (!team) {
        team = await prisma.athleticTeam.create({
          data: {
            organizationId: orgId,
            sportId: sport.id,
            seasonId: season.id,
            name: teamName,
            level: lvl.value,
            ...(campus ? { schoolId: campus.id } : {}),
            coachUserId: admin.id,
          },
        })
      }
      console.log(`    Team: ${team.name}`)
    }
  }

  logSection('Athletics seed complete')
}

main()
  .catch((e) => {
    console.error('Athletics seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
