/**
 * Athletics Module Seed — creates sports, seasons, teams, and sample games.
 *
 * Usage: npm run db:seed:athletics
 */

import { prisma, getDefaultOrg, getAdminUser, getDefaultCampus, logSection } from './shared'

async function main() {
  const org = await getDefaultOrg()
  const admin = await getAdminUser(org.id)
  const campus = await getDefaultCampus(org.id)
  const orgId = org.id

  logSection('Creating sports')

  const sports = [
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
    const season = await prisma.athleticSeason.upsert({
      where: {
        sportId_name: { sportId: sport.id, name: `${year}-${year + 1}` },
      },
      update: {},
      create: {
        organizationId: orgId,
        sportId: sport.id,
        name: `${year}-${year + 1}`,
        startDate: new Date(`${year}-08-01`),
        endDate: new Date(`${year + 1}-06-01`),
        isActive: true,
      },
    })
    console.log(`  Season: ${sport.name} ${season.name}`)

    logSection(`Creating ${sport.name} teams`)

    const levels = ['Varsity', 'Junior Varsity']
    for (const level of levels) {
      const teamName = `${sport.name} ${level}`
      const team = await prisma.athleticTeam.upsert({
        where: {
          seasonId_name: { seasonId: season.id, name: teamName },
        },
        update: {},
        create: {
          organizationId: orgId,
          sportId: sport.id,
          seasonId: season.id,
          name: teamName,
          level,
          ...(campus ? { campusId: campus.id } : {}),
          headCoachId: admin.id,
          isActive: true,
        },
      })
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
