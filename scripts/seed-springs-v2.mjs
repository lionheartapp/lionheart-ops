/**
 * Seed Springs Charter Schools — v2 with accurate school entities + campuses.
 * Run: DATABASE_URL="postgresql://mkerley@localhost:5432/lionheart_local?host=/tmp" node scripts/seed-springs-v2.mjs
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

config({ path: '.env.local' })
config()

const prisma = new PrismaClient()
const uid = () => crypto.randomUUID()

function daysFromNow(n) {
  const d = new Date(); d.setDate(d.getDate() + n); return d
}
function setTime(date, h, m = 0) {
  const d = new Date(date); d.setHours(h, m, 0, 0); return d
}

const COLORS = [
  '#3B82F6', '#10B981', '#6366F1', '#F97316', '#EC4899',
  '#14B8A6', '#8B5CF6', '#EF4444', '#F59E0B', '#06B6D4',
  '#84CC16', '#E11D48', '#0EA5E9', '#A855F7', '#FB923C',
  '#22D3EE', '#4ADE80', '#F472B6', '#818CF8', '#FBBF24', '#2DD4BF',
]

async function main() {
  console.log('\n--- Seeding Springs Charter Schools v2 ---\n')

  const org = await prisma.organization.findUnique({ where: { slug: 'demo' } })
  if (!org) { console.error('No "demo" org.'); process.exit(1) }
  const orgId = org.id

  await prisma.organization.update({ where: { id: orgId }, data: { name: 'Springs Charter Schools' } })
  console.log('Org: Springs Charter Schools')

  const admin = await prisma.user.findFirst({ where: { organizationId: orgId, email: 'admin@demo.com' } })
  if (!admin) { console.error('No admin user.'); process.exit(1) }

  const roles = await prisma.role.findMany({ where: { organizationId: orgId } })
  const roleMap = Object.fromEntries(roles.map(r => [r.slug, r]))
  const teams = await prisma.team.findMany({ where: { organizationId: orgId } })
  const teamMap = Object.fromEntries(teams.map(t => [t.slug, t]))

  // ── Cleanup old data ──────────────────────────────────────────────────

  console.log('Cleaning old data...')

  // Soft-delete all existing schools, campuses, calendars, calendar events
  await prisma.school.updateMany({ where: { organizationId: orgId, deletedAt: null }, data: { deletedAt: new Date() } })
  await prisma.campus.updateMany({ where: { organizationId: orgId, deletedAt: null }, data: { deletedAt: new Date() } })

  // ── 1. School Entities ────────────────────────────────────────────────

  console.log('Creating school entities...')

  const schoolDefs = [
    { name: 'River Springs Charter School', institutionType: 'CHARTER', color: '#3B82F6', address: '27740 Jefferson Avenue, Temecula, CA 92590', principalName: 'Dr. Kathleen Hermsmeyer' },
    { name: 'Empire Springs Charter School', institutionType: 'CHARTER', color: '#6366F1', address: 'San Bernardino County, CA' },
    { name: 'Harbor Springs Charter School', institutionType: 'CHARTER', color: '#EC4899', address: 'San Diego County, CA' },
    { name: 'Citrus Springs Charter School', institutionType: 'CHARTER', color: '#F97316', address: 'Orange County, CA' },
    { name: 'Inland Empire Springs Charter School', institutionType: 'CHARTER', color: '#14B8A6', address: 'San Bernardino County, CA' },
    { name: 'Pacific Springs Charter School', institutionType: 'CHARTER', color: '#8B5CF6', address: 'Statewide, CA' },
    { name: 'Vista Springs Charter School', institutionType: 'CHARTER', color: '#06B6D4', address: 'Statewide, CA' },
  ]

  const schoolIds = {}
  for (let i = 0; i < schoolDefs.length; i++) {
    const s = schoolDefs[i]
    let school = await prisma.school.findFirst({ where: { organizationId: orgId, name: s.name } })
    if (school) {
      await prisma.school.update({ where: { id: school.id }, data: { ...s, deletedAt: null, sortOrder: i } })
    } else {
      school = await prisma.school.create({ data: { organizationId: orgId, id: uid(), ...s, sortOrder: i } })
    }
    schoolIds[s.name] = school.id
    console.log(`  ${school.name}`)
  }

  // ── 2. Campuses ───────────────────────────────────────────────────────

  console.log('Creating campuses...')

  const campusDefs = [
    // Admin HQ
    { name: 'Administrative Headquarters', address: '27740 Jefferson Avenue, Temecula, CA 92590', campusKind: 'HEADQUARTERS', primarySchool: 'River Springs Charter School' },
    // River Springs campuses
    { name: 'Arbor Campus', address: '17241 Van Buren Blvd, Riverside, CA 92504', primarySchool: 'River Springs Charter School' },
    { name: 'Bear River Campus', address: '26800 Cherry Hills Blvd, Menifee, CA 92586', primarySchool: 'River Springs Charter School' },
    { name: 'Del Rio Campus', address: '305 E. Nuevo Rd, Perris, CA 92571', primarySchool: 'River Springs Charter School' },
    { name: 'Enterprise Learning Campus', address: '27463 Enterprise Circle West, Temecula, CA 92590', primarySchool: 'River Springs Charter School' },
    { name: 'Flabob Airport Prep Academy', address: '4130 Mennes Ave, Riverside, CA 92509', primarySchool: 'River Springs Charter School' },
    { name: 'Hemet Learning Campus', address: '45252 Florida Ave, Hemet, CA 92544', primarySchool: 'River Springs Charter School' },
    { name: 'Hemet Quest Campus', address: '105 N. Girard St, Hemet, CA 92544', primarySchool: 'River Springs Charter School' },
    { name: 'iShine Campus', address: '32225 Mission Trail, Lake Elsinore, CA 92530', primarySchool: 'River Springs Charter School' },
    { name: 'Magnolia Campus', address: '36500 Magnolia St, Murrieta, CA 92562', primarySchool: 'River Springs Charter School' },
    { name: 'Murrieta Campus', address: '39455 Murrieta Hot Springs Rd, Murrieta, CA 92563', primarySchool: 'River Springs Charter School' },
    { name: 'Palm Academy Campus', address: '81840 Avenue 46, Indio, CA 92201', primarySchool: 'River Springs Charter School' },
    { name: 'Pathfinder Campus', address: '4260 Tequesquite Ave, Riverside, CA 92501', primarySchool: 'River Springs Charter School' },
    { name: 'Renaissance Valley Campus', address: '1000 S. San Jacinto Ave, San Jacinto, CA 92583', primarySchool: 'River Springs Charter School' },
    { name: 'Riverside Campus', address: '3050 Chicago Ave, Riverside, CA 92507', primarySchool: 'River Springs Charter School' },
    { name: 'Temecula Campus', address: '43040 Margarita Rd, Temecula, CA 92592', primarySchool: 'River Springs Charter School' },
    // Empire Springs
    { name: 'Cherry Valley Campus', address: '10257 Beaumont Ave, Cherry Valley, CA 92223', primarySchool: 'Empire Springs Charter School' },
    { name: 'Rancho Cucamonga Campus', address: '8968 Archibald Ave, Rancho Cucamonga, CA 91730', primarySchool: 'Empire Springs Charter School' },
    // Harbor Springs
    { name: 'Otay Ranch Academy for the Arts', address: '1680 Santa Cora Ave, Chula Vista, CA 91913', primarySchool: 'Harbor Springs Charter School' },
    { name: 'Vista Campus', address: '2000 S. Santa Fe Ave, Vista, CA 92083', primarySchool: 'Harbor Springs Charter School' },
    // Citrus Springs
    { name: 'Santa Ana Campus', address: '2121 N. Grand Ave, Santa Ana, CA 92705', primarySchool: 'Citrus Springs Charter School' },
  ]

  const campusIds = {}
  for (let i = 0; i < campusDefs.length; i++) {
    const c = campusDefs[i]
    const { primarySchool, ...fields } = c
    let campus = await prisma.campus.findFirst({ where: { organizationId: orgId, name: c.name } })
    if (campus) {
      await prisma.campus.update({ where: { id: campus.id }, data: { ...fields, schoolId: schoolIds[primarySchool], deletedAt: null, sortOrder: i } })
    } else {
      campus = await prisma.campus.create({
        data: { organizationId: orgId, id: uid(), ...fields, schoolId: schoolIds[primarySchool], color: COLORS[i % COLORS.length], sortOrder: i },
      })
    }
    campusIds[c.name] = campus.id
    console.log(`  ${c.name} → ${primarySchool}`)
  }

  // ── 3. Buildings ──────────────────────────────────────────────────────

  console.log('Creating buildings...')

  const buildingDefs = [
    { name: 'Main Office Building', campusId: campusIds['Administrative Headquarters'], buildingType: 'ADMINISTRATION' },
    { name: 'IT & Operations Center', campusId: campusIds['Administrative Headquarters'], buildingType: 'SUPPORT_SERVICES' },
    { name: 'Temecula Classroom Building', campusId: campusIds['Temecula Campus'], buildingType: 'GENERAL' },
    { name: 'Temecula Gymnasium', campusId: campusIds['Temecula Campus'], buildingType: 'ATHLETICS' },
    { name: 'Enterprise Main Hall', campusId: campusIds['Enterprise Learning Campus'], buildingType: 'GENERAL' },
    { name: 'Enterprise Media Lab', campusId: campusIds['Enterprise Learning Campus'], buildingType: 'GENERAL' },
    { name: 'Murrieta Classroom Building', campusId: campusIds['Murrieta Campus'], buildingType: 'GENERAL' },
    { name: 'Murrieta Multi-Purpose Room', campusId: campusIds['Murrieta Campus'], buildingType: 'GENERAL' },
    { name: 'Performing Arts Theater', campusId: campusIds['Otay Ranch Academy for the Arts'], buildingType: 'ARTS_CULTURE' },
    { name: 'Visual Arts Studio', campusId: campusIds['Otay Ranch Academy for the Arts'], buildingType: 'ARTS_CULTURE' },
    { name: 'Otay Ranch Classroom Building', campusId: campusIds['Otay Ranch Academy for the Arts'], buildingType: 'GENERAL' },
    { name: 'Aviation Hangar', campusId: campusIds['Flabob Airport Prep Academy'], buildingType: 'GENERAL' },
    { name: 'Flabob STEM Lab', campusId: campusIds['Flabob Airport Prep Academy'], buildingType: 'GENERAL' },
    { name: 'Palm Academy Main Building', campusId: campusIds['Palm Academy Campus'], buildingType: 'GENERAL' },
    { name: 'Bear River Classroom Building', campusId: campusIds['Bear River Campus'], buildingType: 'GENERAL' },
    { name: 'Riverside Main Building', campusId: campusIds['Riverside Campus'], buildingType: 'GENERAL' },
    { name: 'Cherry Valley Main Building', campusId: campusIds['Cherry Valley Campus'], buildingType: 'GENERAL' },
    { name: 'Rancho Cucamonga Main Building', campusId: campusIds['Rancho Cucamonga Campus'], buildingType: 'GENERAL' },
    { name: 'Santa Ana Main Building', campusId: campusIds['Santa Ana Campus'], buildingType: 'GENERAL' },
  ]

  for (const b of buildingDefs) {
    const existing = await prisma.building.findFirst({ where: { organizationId: orgId, name: b.name } })
    if (!existing) {
      await prisma.building.create({ data: { organizationId: orgId, id: uid(), ...b } })
    }
  }
  console.log(`  ${buildingDefs.length} buildings`)

  // ── 4. Users ──────────────────────────────────────────────────────────

  console.log('Creating users...')

  const passwordHash = await bcrypt.hash('test123', 10)

  const userDefs = [
    { email: 'khermsmeyer@demo.com', firstName: 'Kathleen', lastName: 'Hermsmeyer', jobTitle: 'Executive Director', roleSlug: 'super-admin' },
    { email: 'jmendez@demo.com', firstName: 'Julia', lastName: 'Mendez', jobTitle: 'Director of Operations', roleSlug: 'admin' },
    { email: 'rthompson@demo.com', firstName: 'Robert', lastName: 'Thompson', jobTitle: 'Director of Curriculum', roleSlug: 'admin' },
    { email: 'bchen@demo.com', firstName: 'Brian', lastName: 'Chen', jobTitle: 'IT Director', roleSlug: 'admin' },
    { email: 'anelson@demo.com', firstName: 'Alex', lastName: 'Nelson', jobTitle: 'Systems Administrator', roleSlug: 'member' },
    { email: 'lmartinez@demo.com', firstName: 'Lisa', lastName: 'Martinez', jobTitle: 'Facilities Director', roleSlug: 'admin' },
    { email: 'dgarcia@demo.com', firstName: 'David', lastName: 'Garcia', jobTitle: 'Maintenance Lead', roleSlug: 'member' },
    { email: 'kpatel@demo.com', firstName: 'Kevin', lastName: 'Patel', jobTitle: 'A/V & Events Coordinator', roleSlug: 'member' },
    { email: 'slee@demo.com', firstName: 'Samantha', lastName: 'Lee', jobTitle: 'Temecula Campus Director', roleSlug: 'admin' },
    { email: 'mrivera@demo.com', firstName: 'Marco', lastName: 'Rivera', jobTitle: 'Murrieta Campus Director', roleSlug: 'admin' },
    { email: 'jpark@demo.com', firstName: 'Jennifer', lastName: 'Park', jobTitle: 'Otay Ranch Academy Director', roleSlug: 'admin' },
    { email: 'twalker@demo.com', firstName: 'Terrence', lastName: 'Walker', jobTitle: 'Flabob Prep Director', roleSlug: 'admin' },
    { email: 'cfoster@demo.com', firstName: 'Christina', lastName: 'Foster', jobTitle: 'Palm Academy Director', roleSlug: 'admin' },
    { email: 'mlee@demo.com', firstName: 'Michael', lastName: 'Lee', jobTitle: 'Math Teacher - Temecula', roleSlug: 'member' },
    { email: 'rwilson@demo.com', firstName: 'Rachel', lastName: 'Wilson', jobTitle: 'Science Teacher - Enterprise', roleSlug: 'member' },
    { email: 'akim@demo.com', firstName: 'Amy', lastName: 'Kim', jobTitle: 'Office Manager - HQ', roleSlug: 'member' },
    { email: 'tbrooks@demo.com', firstName: 'Tyler', lastName: 'Brooks', jobTitle: 'Security Coordinator', roleSlug: 'member' },
  ]

  const userIds = { [admin.email]: admin.id }
  for (const u of userDefs) {
    const user = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: orgId, email: u.email } },
      update: { firstName: u.firstName, lastName: u.lastName, roleId: roleMap[u.roleSlug].id, jobTitle: u.jobTitle },
      create: {
        organizationId: orgId, id: uid(), email: u.email,
        name: `${u.firstName} ${u.lastName}`, firstName: u.firstName, lastName: u.lastName,
        passwordHash, roleId: roleMap[u.roleSlug].id, status: 'ACTIVE',
        employmentType: 'FULL_TIME', jobTitle: u.jobTitle, emailVerified: true,
      },
    })
    userIds[u.email] = user.id
  }
  console.log(`  ${userDefs.length} users`)

  // Team assignments
  for (const ta of [
    { email: 'bchen@demo.com', team: 'it-support' },
    { email: 'anelson@demo.com', team: 'it-support' },
    { email: 'lmartinez@demo.com', team: 'maintenance' },
    { email: 'dgarcia@demo.com', team: 'maintenance' },
    { email: 'kpatel@demo.com', team: 'av-production' },
    { email: 'tbrooks@demo.com', team: 'security' },
    { email: 'akim@demo.com', team: 'administration' },
    { email: 'admin@demo.com', team: 'administration' },
  ]) {
    if (teamMap[ta.team] && userIds[ta.email]) {
      await prisma.userTeam.upsert({
        where: { userId_teamId: { userId: userIds[ta.email], teamId: teamMap[ta.team].id } },
        update: {}, create: { userId: userIds[ta.email], teamId: teamMap[ta.team].id },
      })
    }
  }

  // ── 5. Categories ─────────────────────────────────────────────────────

  console.log('Creating categories...')
  const catDefs = [
    { name: 'Assembly', color: '#3B82F6' }, { name: 'Staff Meeting', color: '#8B5CF6' },
    { name: 'Parent Event', color: '#EC4899' }, { name: 'Field Trip', color: '#F97316' },
    { name: 'Professional Development', color: '#14B8A6' }, { name: 'Student Performance', color: '#EAB308' },
    { name: 'Testing', color: '#EF4444' }, { name: 'Fundraiser', color: '#10B981' },
    { name: 'Board Meeting', color: '#6366F1' }, { name: 'Athletics', color: '#F97316' },
    { name: 'Enrollment', color: '#06B6D4' }, { name: 'Community Outreach', color: '#A855F7' },
  ]
  const categoryIds = {}
  for (const c of catDefs) {
    const cat = await prisma.calendarCategory.upsert({
      where: { organizationId_name: { organizationId: orgId, name: c.name } },
      update: { color: c.color }, create: { organizationId: orgId, id: uid(), ...c },
    })
    categoryIds[c.name] = cat.id
  }

  // ── 6. Calendars ──────────────────────────────────────────────────────

  console.log('Creating calendars...')

  // Soft-delete old calendars first
  await prisma.calendar.updateMany({ where: { organizationId: orgId, deletedAt: null }, data: { deletedAt: new Date() } })

  const calDefs = [
    { name: 'District-Wide Calendar', calendarType: 'ACADEMIC', color: '#3B82F6', visibility: 'ORG_WIDE', isDefault: true },
    { name: 'Temecula Campus Calendar', calendarType: 'ACADEMIC', color: '#10B981', campusId: campusIds['Temecula Campus'] },
    { name: 'Enterprise Campus Calendar', calendarType: 'ACADEMIC', color: '#6366F1', campusId: campusIds['Enterprise Learning Campus'] },
    { name: 'Otay Ranch Academy Calendar', calendarType: 'ACADEMIC', color: '#EC4899', campusId: campusIds['Otay Ranch Academy for the Arts'] },
    { name: 'Flabob Prep Calendar', calendarType: 'ACADEMIC', color: '#F97316', campusId: campusIds['Flabob Airport Prep Academy'] },
    { name: 'Murrieta Campus Calendar', calendarType: 'ACADEMIC', color: '#8B5CF6', campusId: campusIds['Murrieta Campus'] },
    { name: 'Palm Academy Calendar', calendarType: 'ACADEMIC', color: '#F59E0B', campusId: campusIds['Palm Academy Campus'] },
    { name: 'Staff & PD Calendar', calendarType: 'STAFF', color: '#374151' },
    { name: 'Board & Governance', calendarType: 'GENERAL', color: '#1F2937' },
    { name: 'Community & Enrollment', calendarType: 'PARENT_FACING', color: '#06B6D4', visibility: 'PUBLIC' },
  ]

  const calendarIds = {}
  for (const c of calDefs) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
    let cal = await prisma.calendar.findFirst({ where: { organizationId: orgId, slug } })
    if (cal) {
      await prisma.calendar.update({ where: { id: cal.id }, data: { ...c, slug, deletedAt: null } })
    } else {
      cal = await prisma.calendar.create({
        data: { organizationId: orgId, id: uid(), slug, createdById: admin.id, isActive: true, visibility: 'ORG_WIDE', ...c },
      })
    }
    calendarIds[c.name] = cal.id
  }
  console.log(`  ${calDefs.length} calendars`)

  // ── 7. Calendar Events ────────────────────────────────────────────────

  console.log('Creating calendar events...')

  const events = [
    // District
    { title: 'Board of Directors Meeting', cal: 'Board & Governance', cat: 'Board Meeting', days: -8, h: 17, eh: 19, desc: 'Monthly board meeting at Administrative HQ. Public comment at 5:30 PM.', loc: 'Administrative Headquarters' },
    { title: 'All-Staff Professional Development', cal: 'Staff & PD Calendar', cat: 'Professional Development', days: -3, h: 8, eh: 15, desc: 'District-wide PD day: personalized learning strategies across all campuses.', loc: 'Virtual + Temecula Campus', allDay: true },
    { title: 'CAASPP Testing Window', cal: 'District-Wide Calendar', cat: 'Testing', days: -1, h: 8, eh: 15, desc: 'State standardized testing begins. Modified schedules at all campuses.', loc: 'All Campuses', allDay: true },
    { title: 'District Leadership Meeting', cal: 'Staff & PD Calendar', cat: 'Staff Meeting', days: 2, h: 9, eh: 11, desc: 'Monthly campus directors meeting with executive team.', loc: 'Administrative Headquarters' },
    { title: 'Open Enrollment Night - Inland Empire', cal: 'Community & Enrollment', cat: 'Enrollment', days: 5, h: 18, eh: 20, desc: 'Information night for prospective families in the IE region. Presentations about all Springs programs.', loc: 'Rancho Cucamonga Campus' },
    { title: 'Charter Renewal Work Session', cal: 'Board & Governance', cat: 'Board Meeting', days: 12, h: 14, eh: 17, desc: 'Work session for River Springs charter renewal with RCOE.', loc: 'Administrative Headquarters' },
    { title: 'Summer Program Registration Opens', cal: 'District-Wide Calendar', cat: 'Enrollment', days: 14, h: 8, eh: 9, desc: 'Online registration for summer enrichment, credit recovery, and STEM camps.', loc: 'Online' },
    { title: 'Board Finance Committee', cal: 'Board & Governance', cat: 'Board Meeting', days: 18, h: 16, eh: 18, desc: 'Quarterly budget review and fiscal year planning.', loc: 'Administrative Headquarters' },
    { title: 'Last Day of School', cal: 'District-Wide Calendar', cat: 'Assembly', days: 38, h: 8, eh: 12, desc: 'Last day of 2025-2026 school year. Early release at noon, all campuses.', loc: 'All Campuses', allDay: true },
    // Temecula
    { title: 'Temecula Spring Showcase', cal: 'Temecula Campus Calendar', cat: 'Student Performance', days: 3, h: 18, eh: 20, desc: 'Student project presentations and performances for families.', loc: 'Temecula Classroom Building' },
    { title: 'Parent-Teacher Conferences - Temecula', cal: 'Temecula Campus Calendar', cat: 'Parent Event', days: 8, h: 13, eh: 19, desc: 'Spring conferences. Sign up through the parent portal.', loc: 'Temecula Campus' },
    { title: 'Temecula Field Day', cal: 'Temecula Campus Calendar', cat: 'Athletics', days: 21, h: 9, eh: 14, desc: 'Annual outdoor field day.', loc: 'Temecula Gymnasium', allDay: true },
    // Otay Ranch
    { title: 'Spring Arts Festival', cal: 'Otay Ranch Academy Calendar', cat: 'Student Performance', days: 4, h: 17, eh: 21, desc: 'Annual festival featuring student visual art, dance, theater, and music.', loc: 'Performing Arts Theater' },
    { title: 'Senior Art Gallery Opening', cal: 'Otay Ranch Academy Calendar', cat: 'Student Performance', days: 15, h: 18, eh: 20, desc: 'Senior capstone art exhibition.', loc: 'Visual Arts Studio' },
    { title: 'Otay Ranch Graduation', cal: 'Otay Ranch Academy Calendar', cat: 'Assembly', days: 35, h: 17, eh: 19, desc: 'Harbor Springs / Otay Ranch commencement ceremony.', loc: 'Performing Arts Theater' },
    // Flabob
    { title: 'Aviation Discovery Day', cal: 'Flabob Prep Calendar', cat: 'Community Outreach', days: 6, h: 9, eh: 14, desc: 'Open house: flight simulator demos, hangar tours, STEM activities.', loc: 'Aviation Hangar', allDay: true },
    { title: 'Young Eagles Flight Rally', cal: 'Flabob Prep Calendar', cat: 'Field Trip', days: 13, h: 8, eh: 15, desc: 'EAA Young Eagles rally — introductory flights with licensed pilots.', loc: 'Flabob Airport', allDay: true },
    // Enterprise
    { title: 'Enterprise Science Fair', cal: 'Enterprise Campus Calendar', cat: 'Student Performance', days: 7, h: 9, eh: 14, desc: 'Student science projects. Judging 9-12, public viewing 12-2.', loc: 'Enterprise Main Hall' },
    { title: 'Media Production Showcase', cal: 'Enterprise Campus Calendar', cat: 'Student Performance', days: 16, h: 18, eh: 20, desc: 'Student films, podcasts, and digital media projects.', loc: 'Enterprise Media Lab' },
    // Murrieta
    { title: 'Murrieta Family Game Night', cal: 'Murrieta Campus Calendar', cat: 'Parent Event', days: 9, h: 18, eh: 20, desc: 'Board games, trivia, and food trucks.', loc: 'Murrieta Multi-Purpose Room' },
    { title: 'Murrieta Promotion Ceremony', cal: 'Murrieta Campus Calendar', cat: 'Assembly', days: 34, h: 10, eh: 12, desc: '8th grade promotion ceremony.', loc: 'Murrieta Multi-Purpose Room' },
    // Palm Academy
    { title: 'Palm Academy Open House', cal: 'Palm Academy Calendar', cat: 'Enrollment', days: 10, h: 17, eh: 19, desc: 'Campus tours and program overview for Coachella Valley families.', loc: 'Palm Academy Main Building' },
    // Community
    { title: 'Community Resource Fair', cal: 'Community & Enrollment', cat: 'Community Outreach', days: 11, h: 10, eh: 14, desc: 'Free community event with health screenings and enrollment assistance.', loc: 'Temecula Campus', allDay: true },
    { title: 'Spring Fundraiser Gala', cal: 'Community & Enrollment', cat: 'Fundraiser', days: 17, h: 18, eh: 21, desc: 'Annual fundraiser supporting arts and scholarships across all campuses.', loc: 'Enterprise Main Hall' },
    // Staff
    { title: 'AI in Education Workshop', cal: 'Staff & PD Calendar', cat: 'Professional Development', days: 19, h: 8, eh: 12, desc: 'Half-day workshop on integrating AI tools responsibly.', loc: 'Virtual' },
    { title: 'Staff End-of-Year Celebration', cal: 'Staff & PD Calendar', cat: 'Staff Meeting', days: 39, h: 11, eh: 14, desc: 'Year-end appreciation luncheon.', loc: 'Enterprise Main Hall' },
  ]

  let evtCount = 0
  for (const e of events) {
    const calId = calendarIds[e.cal]; if (!calId) continue
    const catId = e.cat ? categoryIds[e.cat] : null
    const start = setTime(daysFromNow(e.days), e.h)
    const end = setTime(daysFromNow(e.days), e.eh)
    const existing = await prisma.calendarEvent.findFirst({ where: { organizationId: orgId, calendarId: calId, title: e.title } })
    if (!existing) {
      await prisma.calendarEvent.create({
        data: { id: uid(), organizationId: orgId, calendarId: calId, title: e.title, description: e.desc, startTime: start, endTime: end, locationText: e.loc, categoryId: catId, isAllDay: e.allDay || false, calendarStatus: 'CONFIRMED', createdById: admin.id },
      })
      evtCount++
    }
  }
  console.log(`  ${evtCount} events`)

  // ── 8. Event Projects ─────────────────────────────────────────────────

  console.log('Creating event projects...')
  const projDefs = [
    { title: 'Spring Fundraiser Gala', status: 'CONFIRMED', days: 17, desc: 'Annual fundraiser.', loc: 'Enterprise Main Hall', av: true, fac: true, cust: true, sec: true },
    { title: 'Spring Arts Festival', status: 'CONFIRMED', days: 4, desc: 'Multi-discipline arts festival.', loc: 'Performing Arts Theater', av: true, fac: true },
    { title: 'Otay Ranch Graduation Ceremony', status: 'IN_PROGRESS', days: 35, desc: 'Commencement ceremony.', loc: 'Performing Arts Theater', av: true, fac: true, cust: true, sec: true },
    { title: 'Aviation Discovery Day', status: 'CONFIRMED', days: 6, desc: 'Open house at Flabob.', loc: 'Aviation Hangar', av: true, fac: true, sec: true },
    { title: 'Summer STEM Camp', status: 'DRAFT', days: 50, endDays: 55, multi: true, desc: 'Week-long STEM camp.', loc: 'Enterprise Learning Campus', av: true },
    { title: 'Open Enrollment Night - IE', status: 'PENDING_APPROVAL', days: 5, desc: 'Info night for IE families.', loc: 'Rancho Cucamonga Campus', av: true, gates: { av: { status: 'APPROVED' }, admin: { status: 'PENDING' } } },
    { title: 'Community Resource Fair', status: 'CONFIRMED', days: 11, desc: 'Free community event.', loc: 'Temecula Campus', fac: true, sec: true },
    { title: 'Staff Appreciation Luncheon', status: 'CONFIRMED', days: 39, desc: 'End-of-year celebration.', loc: 'Enterprise Main Hall', fac: true, cust: true },
  ]

  let projCount = 0
  for (const p of projDefs) {
    const existing = await prisma.eventProject.findFirst({ where: { organizationId: orgId, title: p.title } })
    if (!existing) {
      await prisma.eventProject.create({
        data: {
          id: uid(), organizationId: orgId, title: p.title, description: p.desc,
          startsAt: setTime(daysFromNow(p.days), 9), endsAt: setTime(daysFromNow(p.endDays || p.days), 17),
          isMultiDay: p.multi || false, locationText: p.loc, status: p.status, source: 'DIRECT_REQUEST',
          createdById: admin.id, requiresAV: p.av || false, requiresFacilities: p.fac || false,
          requiresCustodial: p.cust || false, requiresSecurity: p.sec || false,
          approvalGates: p.gates || null,
        },
      })
      projCount++
    }
  }
  console.log(`  ${projCount} event projects`)

  // ── 9. Tickets ────────────────────────────────────────────────────────

  console.log('Creating tickets...')
  const ticketDefs = [
    { title: 'HVAC not cooling - Temecula Room 3', cat: 'MAINTENANCE', pri: 'HIGH', status: 'OPEN', desc: 'Rooms 3 and 4 at 85F. HVAC grinding noise.', loc: 'Temecula Classroom Building', by: 'slee@demo.com' },
    { title: 'Parking lot lights out - Enterprise west lot', cat: 'MAINTENANCE', pri: 'HIGH', status: 'OPEN', desc: 'Three lights out. Safety concern for evening programs.', loc: 'Enterprise Learning Campus', by: 'lmartinez@demo.com' },
    { title: 'Restroom plumbing - Murrieta 2nd floor', cat: 'MAINTENANCE', pri: 'NORMAL', status: 'IN_PROGRESS', desc: 'Slow drain, water pooling.', loc: 'Murrieta Classroom Building', by: 'mrivera@demo.com', to: 'dgarcia@demo.com' },
    { title: 'Fire extinguisher inspection overdue - HQ', cat: 'MAINTENANCE', pri: 'CRITICAL', status: 'OPEN', desc: 'Annual inspection 2 weeks overdue.', loc: 'Main Office Building', by: 'lmartinez@demo.com' },
    { title: 'Projector dead - Temecula Room 6', cat: 'IT', pri: 'HIGH', status: 'OPEN', desc: 'Lamp indicator red. Need replacement.', loc: 'Temecula Classroom Building - Room 6', by: 'mlee@demo.com' },
    { title: 'Wi-Fi drops across Palm Academy', cat: 'IT', pri: 'CRITICAL', status: 'IN_PROGRESS', desc: 'Intermittent drops since Monday. 200+ students affected.', loc: 'Palm Academy Main Building', to: 'bchen@demo.com', by: 'cfoster@demo.com' },
    { title: 'Chromebook batch - 5 cracked screens', cat: 'IT', pri: 'NORMAL', status: 'OPEN', desc: 'From Riverside Campus. Tags RS-CB-1247 to 1251.', loc: 'IT & Operations Center', by: 'anelson@demo.com' },
    { title: 'PA system feedback at Flabob', cat: 'IT', pri: 'HIGH', status: 'OPEN', desc: 'Loud feedback during announcements. Fix before Aviation Discovery Day.', loc: 'Flabob STEM Lab', by: 'twalker@demo.com' },
    { title: 'AV setup for Spring Arts Festival', cat: 'EVENT', pri: 'HIGH', status: 'IN_PROGRESS', desc: 'Stage lighting, 6 wireless mics, 2 projectors, sound system.', loc: 'Performing Arts Theater', to: 'kpatel@demo.com', by: 'jpark@demo.com' },
    { title: 'Tables/chairs for Resource Fair', cat: 'EVENT', pri: 'NORMAL', status: 'OPEN', desc: '30 tables, 120 chairs in parking lot. Friday evening setup.', loc: 'Temecula Campus', by: 'admin@demo.com' },
    { title: 'Graduation stage rental', cat: 'EVENT', pri: 'HIGH', status: 'OPEN', desc: 'Portable stage, podium, sound for Otay Ranch graduation.', loc: 'Performing Arts Theater', by: 'jpark@demo.com' },
  ]

  let ticketCount = 0
  for (const t of ticketDefs) {
    const existing = await prisma.ticket.findFirst({ where: { organizationId: orgId, title: t.title } })
    if (!existing) {
      await prisma.ticket.create({
        data: { id: uid(), organizationId: orgId, title: t.title, description: t.desc, category: t.cat, priority: t.pri, status: t.status, locationText: t.loc, createdById: userIds[t.by] || admin.id, assignedToId: t.to ? (userIds[t.to] || null) : null },
      })
      ticketCount++
    }
  }
  console.log(`  ${ticketCount} tickets`)

  // ── 10. Inventory ─────────────────────────────────────────────────────

  console.log('Creating inventory...')
  const invDefs = [
    { name: 'Folding Tables (6ft)', category: 'Event Equipment', quantityOnHand: 150 },
    { name: 'Folding Chairs', category: 'Event Equipment', quantityOnHand: 900 },
    { name: 'Pop-Up Canopy (10x10)', category: 'Event Equipment', quantityOnHand: 30 },
    { name: 'Wireless Microphone Set', category: 'A/V Equipment', quantityOnHand: 18 },
    { name: 'Portable PA Speaker', category: 'A/V Equipment', quantityOnHand: 10 },
    { name: 'Portable Projector', category: 'A/V Equipment', quantityOnHand: 15 },
    { name: 'Stage Lighting Kit', category: 'A/V Equipment', quantityOnHand: 3 },
    { name: 'Student Chromebook', category: 'IT Equipment', quantityOnHand: 3200, description: '1:1 program across all 21 campuses.' },
    { name: 'Teacher Laptop', category: 'IT Equipment', quantityOnHand: 220 },
    { name: 'Walkie-Talkie Set', category: 'Security', quantityOnHand: 50 },
    { name: 'First Aid Kit', category: 'Safety', quantityOnHand: 50 },
    { name: 'Extension Cords (50ft)', category: 'Facilities', quantityOnHand: 40 },
  ]

  let invCount = 0
  for (const item of invDefs) {
    const existing = await prisma.inventoryItem.findFirst({ where: { organizationId: orgId, name: item.name } })
    if (!existing) {
      await prisma.inventoryItem.create({ data: { id: uid(), organizationId: orgId, ...item, allowCheckout: true } })
      invCount++
    }
  }
  console.log(`  ${invCount} inventory items`)

  // ── Summary ───────────────────────────────────────────────────────────

  console.log('\n--- Done ---')
  console.log(`Schools: ${schoolDefs.length} | Campuses: ${campusDefs.length} | Buildings: ${buildingDefs.length}`)
  console.log(`Users: ${userDefs.length + 1} | Calendars: ${calDefs.length} | Events: ${evtCount}`)
  console.log(`Projects: ${projCount} | Tickets: ${ticketCount} | Inventory: ${invCount}`)
  console.log('All passwords: test123\n')
}

main()
  .catch(e => { console.error('Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
