#!/usr/bin/env node
/**
 * Phase 1b re-seed — Linfield Christian School facilities.
 *
 * Seeds the new facility shape after drop + db:push:
 *   - 1 District  (default, isDefault: true)
 *   - 1 School    (Linfield Christian School, FAITH_BASED)
 *   - 1 Site      (31950 Pauba Rd, Temecula, CA 92592)
 *   - 3 Campuses  (Elementary / Middle / High — all @ the Site)
 *   - Pins every existing org user to the School (schoolId)
 *
 * Idempotent — safe to re-run. Upserts by natural keys.
 *
 * Usage:
 *   node scripts/seed-linfield-phase-1.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const LINFIELD_ORG_ID = process.env.LINFIELD_ORG_ID || 'cmnxogi8s0006mm9mrutfjs1v'

const DISTRICT = {
  name: 'Linfield Christian School District',
  slug: 'linfield-district',
  isDefault: true,
  address: '31950 Pauba Rd',
  city: 'Temecula',
  state: 'CA',
  zip: '92592',
  phone: '(951) 676-8111',
  email: 'info@linfield.com',
}

const SCHOOL = {
  name: 'Linfield Christian School',
  slug: 'linfield-christian-school',
  institutionType: 'FAITH_BASED',
  address: '31950 Pauba Rd, Temecula, CA 92592',
  color: '#1e40af',
}

const SITE = {
  label: 'Linfield Main Campus',
  address: '31950 Pauba Rd',
  city: 'Temecula',
  state: 'CA',
  zip: '92592',
}

const CAMPUSES = [
  { name: 'Elementary School', gradeLevel: 'ELEMENTARY',    campusKind: 'CAMPUS', color: '#22c55e', sortOrder: 0 },
  { name: 'Middle School',     gradeLevel: 'MIDDLE_SCHOOL', campusKind: 'CAMPUS', color: '#3b82f6', sortOrder: 1 },
  { name: 'High School',       gradeLevel: 'HIGH_SCHOOL',   campusKind: 'CAMPUS', color: '#ef4444', sortOrder: 2 },
]

async function orgExists() {
  const org = await prisma.organization.findUnique({ where: { id: LINFIELD_ORG_ID } })
  if (!org) {
    throw new Error(
      `Organization ${LINFIELD_ORG_ID} not found. Did you wipe the DB?\n` +
      `  Run your normal org bootstrap first, then re-run this seed.`
    )
  }
  return org
}

async function upsertDistrict() {
  const existing = await prisma.district.findFirst({
    where: { organizationId: LINFIELD_ORG_ID, name: DISTRICT.name },
  })
  if (existing) {
    return prisma.district.update({
      where: { id: existing.id },
      data: DISTRICT,
    })
  }
  return prisma.district.create({
    data: { organizationId: LINFIELD_ORG_ID, ...DISTRICT },
  })
}

async function upsertSchool(districtId) {
  const existing = await prisma.school.findFirst({
    where: { organizationId: LINFIELD_ORG_ID, name: SCHOOL.name },
  })
  const payload = { ...SCHOOL, districtId }
  if (existing) {
    return prisma.school.update({
      where: { id: existing.id },
      data: payload,
    })
  }
  return prisma.school.create({
    data: { organizationId: LINFIELD_ORG_ID, ...payload },
  })
}

async function upsertSite() {
  const existing = await prisma.site.findFirst({
    where: { organizationId: LINFIELD_ORG_ID, address: SITE.address },
  })
  if (existing) {
    return prisma.site.update({
      where: { id: existing.id },
      data: SITE,
    })
  }
  return prisma.site.create({
    data: { organizationId: LINFIELD_ORG_ID, ...SITE },
  })
}

async function upsertCampus(schoolId, siteId, c) {
  const existing = await prisma.campus.findFirst({
    where: {
      organizationId: LINFIELD_ORG_ID,
      schoolId,
      name: c.name,
    },
  })
  const payload = { ...c, schoolId, siteId }
  if (existing) {
    return prisma.campus.update({
      where: { id: existing.id },
      data: payload,
    })
  }
  return prisma.campus.create({
    data: { organizationId: LINFIELD_ORG_ID, ...payload },
  })
}

async function pinUsersToSchool(schoolId, districtId) {
  const res = await prisma.user.updateMany({
    where: {
      organizationId: LINFIELD_ORG_ID,
      schoolId: null,
      deletedAt: null,
    },
    data: { schoolId, districtId },
  })
  return res.count
}

async function main() {
  console.log('Phase 1b seed — Linfield Christian School\n')

  await orgExists()
  console.log(`  Organization       OK  (${LINFIELD_ORG_ID})`)

  const district = await upsertDistrict()
  console.log(`  District           OK  ${district.id}  "${district.name}"`)

  const school = await upsertSchool(district.id)
  console.log(`  School             OK  ${school.id}  "${school.name}"  (${school.institutionType})`)

  const site = await upsertSite()
  console.log(`  Site               OK  ${site.id}  "${site.address}, ${site.city}, ${site.state} ${site.zip}"`)

  console.log(`  Campuses:`)
  for (const c of CAMPUSES) {
    const campus = await upsertCampus(school.id, site.id, c)
    console.log(`    - ${campus.name.padEnd(20)} ${campus.gradeLevel.padEnd(14)} ${campus.id}`)
  }

  const pinnedCount = await pinUsersToSchool(school.id, district.id)
  console.log(`\n  Users pinned to school: ${pinnedCount}`)

  console.log('\nDone. Now verify in Prisma Studio:')
  console.log('  npm run db:studio')
}

main()
  .catch((err) => {
    console.error('\nSeed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
