/**
 * Seed Springs Charter Schools demo content.
 * Run: node scripts/seed-springs-charter.mjs
 *
 * Updates the demo org to "Springs Charter Schools" with 20 student centers,
 * realistic users, calendars, events, tickets, and inventory.
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
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}
function setTime(date, hours, minutes = 0) {
  const d = new Date(date)
  d.setHours(hours, minutes, 0, 0)
  return d
}

// ── Color palette for campuses ───────────────────────────────────────────
const CAMPUS_COLORS = [
  '#3B82F6', '#10B981', '#6366F1', '#F97316', '#EC4899',
  '#14B8A6', '#8B5CF6', '#EF4444', '#F59E0B', '#06B6D4',
  '#84CC16', '#E11D48', '#0EA5E9', '#A855F7', '#FB923C',
  '#22D3EE', '#4ADE80', '#F472B6', '#818CF8', '#FBBF24',
  '#2DD4BF',
]

async function main() {
  console.log('\n--- Seeding Springs Charter Schools ---\n')

  const org = await prisma.organization.findUnique({ where: { slug: 'demo' } })
  if (!org) { console.error('No "demo" org. Run npm run db:seed first.'); process.exit(1) }
  const orgId = org.id

  // Update org name
  await prisma.organization.update({
    where: { id: orgId },
    data: { name: 'Springs Charter Schools' },
  })
  console.log('Organization renamed to: Springs Charter Schools')

  const admin = await prisma.user.findFirst({ where: { organizationId: orgId, email: 'admin@demo.com' } })
  if (!admin) { console.error('Admin user not found.'); process.exit(1) }

  const roles = await prisma.role.findMany({ where: { organizationId: orgId } })
  const roleMap = Object.fromEntries(roles.map((r) => [r.slug, r]))
  const teams = await prisma.team.findMany({ where: { organizationId: orgId } })
  const teamMap = Object.fromEntries(teams.map((t) => [t.slug, t]))

  // ── 1. School (single charter) ─────────────────────────────────────────

  console.log('Creating school...')

  const school = await prisma.school.upsert({
    where: { organizationId_name: { organizationId: orgId, name: 'River Springs Charter School' } },
    update: { institutionType: 'CHARTER', color: '#3B82F6', address: '27740 Jefferson Avenue, Temecula, CA 92590' },
    create: {
      organizationId: orgId, id: uid(),
      name: 'River Springs Charter School',
      institutionType: 'CHARTER',
      color: '#3B82F6',
      address: '27740 Jefferson Avenue, Temecula, CA 92590',
      principalName: 'Dr. Kathleen Hermsmeyer',
      principalEmail: 'khermsmeyer@springscharterschools.org',
    },
  })
  console.log(`  School: ${school.name}`)

  // Soft-delete old schools
  await prisma.school.updateMany({
    where: { organizationId: orgId, id: { not: school.id }, deletedAt: null },
    data: { deletedAt: new Date() },
  })

  // ── 2. Campuses (Student & Learning Centers) ───────────────────────────

  console.log('Creating campuses...')

  // Soft-delete old campuses
  await prisma.campus.updateMany({
    where: { organizationId: orgId, deletedAt: null },
    data: { deletedAt: new Date() },
  })

  const campusData = [
    { name: 'Administrative Headquarters', address: '27740 Jefferson Avenue, Temecula, CA 92590', campusKind: 'HEADQUARTERS' },
    { name: 'Bear River Student Center', address: 'Menifee, CA' },
    { name: 'Corona Student Center', address: 'Corona, CA' },
    { name: 'Cherry Valley Student Center', address: 'Cherry Valley, CA' },
    { name: 'Del Rio Student Center', address: 'Perris, CA' },
    { name: 'Enterprise Learning Center', address: 'Temecula, CA' },
    { name: 'Flabob Airport Preparatory Academy', address: 'Riverside, CA' },
    { name: 'Hemet Learning Center', address: 'Hemet, CA' },
    { name: 'Hemet Quest Student Center', address: 'Hemet, CA' },
    { name: 'iShine Student Center', address: 'Temecula, CA' },
    { name: 'Magnolia Student Center', address: 'Riverside, CA' },
    { name: 'Murrieta Student Center', address: 'Murrieta, CA' },
    { name: 'Otay Ranch Academy for the Arts', address: 'Chula Vista, CA' },
    { name: 'Palm Academy', address: 'Indio, CA' },
    { name: 'Pathfinder Student Center', address: 'Riverside, CA' },
    { name: 'Rancho Cucamonga Learning Center', address: 'Rancho Cucamonga, CA' },
    { name: 'Renaissance Valley Academy', address: 'San Jacinto, CA' },
    { name: 'Riverside Student Center', address: 'Riverside, CA' },
    { name: 'Santa Ana Student Center', address: 'Santa Ana, CA' },
    { name: 'Temecula Student Center', address: 'Temecula, CA' },
    { name: 'Vista Student Center', address: 'Vista, CA' },
  ]

  const campusIds = {}
  for (let i = 0; i < campusData.length; i++) {
    const c = campusData[i]
    let campus = await prisma.campus.findFirst({
      where: { organizationId: orgId, name: c.name },
    })
    if (campus) {
      // Undelete if it was soft-deleted
      await prisma.campus.update({ where: { id: campus.id }, data: { deletedAt: null, schoolId: school.id, ...c } })
    } else {
      campus = await prisma.campus.create({
        data: {
          organizationId: orgId, id: uid(),
          schoolId: school.id,
          color: CAMPUS_COLORS[i % CAMPUS_COLORS.length],
          sortOrder: i,
          ...c,
        },
      })
    }
    campusIds[c.name] = campus.id
    console.log(`  ${c.name}`)
  }

  // ── 3. Buildings (select campuses) ─────────────────────────────────────

  console.log('Creating buildings...')

  const buildingData = [
    // HQ
    { name: 'Main Office Building', campusId: campusIds['Administrative Headquarters'], buildingType: 'ADMINISTRATION' },
    { name: 'IT & Operations Center', campusId: campusIds['Administrative Headquarters'], buildingType: 'SUPPORT_SERVICES' },
    // Temecula
    { name: 'Temecula Classroom Building', campusId: campusIds['Temecula Student Center'], buildingType: 'GENERAL' },
    { name: 'Temecula Gymnasium', campusId: campusIds['Temecula Student Center'], buildingType: 'ATHLETICS' },
    { name: 'Temecula Arts Wing', campusId: campusIds['Temecula Student Center'], buildingType: 'ARTS_CULTURE' },
    // Enterprise
    { name: 'Enterprise Main Hall', campusId: campusIds['Enterprise Learning Center'], buildingType: 'GENERAL' },
    { name: 'Enterprise Media Lab', campusId: campusIds['Enterprise Learning Center'], buildingType: 'GENERAL' },
    // Murrieta
    { name: 'Murrieta Classroom Building', campusId: campusIds['Murrieta Student Center'], buildingType: 'GENERAL' },
    { name: 'Murrieta Multi-Purpose Room', campusId: campusIds['Murrieta Student Center'], buildingType: 'GENERAL' },
    // Otay Ranch
    { name: 'Performing Arts Theater', campusId: campusIds['Otay Ranch Academy for the Arts'], buildingType: 'ARTS_CULTURE' },
    { name: 'Visual Arts Studio', campusId: campusIds['Otay Ranch Academy for the Arts'], buildingType: 'ARTS_CULTURE' },
    { name: 'Otay Ranch Classroom Building', campusId: campusIds['Otay Ranch Academy for the Arts'], buildingType: 'GENERAL' },
    // Flabob
    { name: 'Aviation Hangar', campusId: campusIds['Flabob Airport Preparatory Academy'], buildingType: 'GENERAL' },
    { name: 'Flabob STEM Lab', campusId: campusIds['Flabob Airport Preparatory Academy'], buildingType: 'GENERAL' },
    // Palm Academy
    { name: 'Palm Academy Main Building', campusId: campusIds['Palm Academy'], buildingType: 'GENERAL' },
    // Bear River
    { name: 'Bear River Classroom Building', campusId: campusIds['Bear River Student Center'], buildingType: 'GENERAL' },
    // Riverside
    { name: 'Riverside Main Building', campusId: campusIds['Riverside Student Center'], buildingType: 'GENERAL' },
    // Corona
    { name: 'Corona Classroom Complex', campusId: campusIds['Corona Student Center'], buildingType: 'GENERAL' },
  ]

  const buildingIds = {}
  for (const b of buildingData) {
    let building = await prisma.building.findFirst({ where: { organizationId: orgId, name: b.name } })
    if (!building) {
      building = await prisma.building.create({ data: { organizationId: orgId, id: uid(), ...b } })
    }
    buildingIds[b.name] = building.id
  }
  console.log(`  ${buildingData.length} buildings created`)

  // ── 4. Users ───────────────────────────────────────────────────────────

  console.log('Creating users...')

  const passwordHash = await bcrypt.hash('test123', 10)

  const userData = [
    // District leadership
    { email: 'khermsmeyer@demo.com', firstName: 'Kathleen', lastName: 'Hermsmeyer', jobTitle: 'Executive Director', roleSlug: 'super-admin' },
    { email: 'jmendez@demo.com', firstName: 'Julia', lastName: 'Mendez', jobTitle: 'Director of Operations', roleSlug: 'admin' },
    { email: 'rthompson@demo.com', firstName: 'Robert', lastName: 'Thompson', jobTitle: 'Director of Curriculum', roleSlug: 'admin' },
    // IT
    { email: 'bchen@demo.com', firstName: 'Brian', lastName: 'Chen', jobTitle: 'IT Director', roleSlug: 'admin' },
    { email: 'anelson@demo.com', firstName: 'Alex', lastName: 'Nelson', jobTitle: 'Systems Administrator', roleSlug: 'member' },
    // Facilities
    { email: 'lmartinez@demo.com', firstName: 'Lisa', lastName: 'Martinez', jobTitle: 'Facilities Director', roleSlug: 'admin' },
    { email: 'dgarcia@demo.com', firstName: 'David', lastName: 'Garcia', jobTitle: 'Maintenance Lead', roleSlug: 'member' },
    // A/V & Events
    { email: 'kpatel@demo.com', firstName: 'Kevin', lastName: 'Patel', jobTitle: 'A/V & Events Coordinator', roleSlug: 'member' },
    // Center directors (select campuses)
    { email: 'slee@demo.com', firstName: 'Samantha', lastName: 'Lee', jobTitle: 'Temecula Center Director', roleSlug: 'admin' },
    { email: 'mrivera@demo.com', firstName: 'Marco', lastName: 'Rivera', jobTitle: 'Murrieta Center Director', roleSlug: 'admin' },
    { email: 'jpark@demo.com', firstName: 'Jennifer', lastName: 'Park', jobTitle: 'Otay Ranch Academy Director', roleSlug: 'admin' },
    { email: 'twalker@demo.com', firstName: 'Terrence', lastName: 'Walker', jobTitle: 'Flabob Prep Academy Director', roleSlug: 'admin' },
    { email: 'cfoster@demo.com', firstName: 'Christina', lastName: 'Foster', jobTitle: 'Palm Academy Director', roleSlug: 'admin' },
    // Teachers
    { email: 'mlee@demo.com', firstName: 'Michael', lastName: 'Lee', jobTitle: 'Math Teacher - Temecula', roleSlug: 'member' },
    { email: 'rwilson@demo.com', firstName: 'Rachel', lastName: 'Wilson', jobTitle: 'Science Teacher - Enterprise', roleSlug: 'member' },
    { email: 'akim@demo.com', firstName: 'Amy', lastName: 'Kim', jobTitle: 'Office Manager - HQ', roleSlug: 'member' },
    { email: 'tbrooks@demo.com', firstName: 'Tyler', lastName: 'Brooks', jobTitle: 'Security Coordinator', roleSlug: 'member' },
  ]

  const userIds = { [admin.email]: admin.id }
  for (const u of userData) {
    const user = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: orgId, email: u.email } },
      update: { firstName: u.firstName, lastName: u.lastName, roleId: roleMap[u.roleSlug].id, jobTitle: u.jobTitle },
      create: {
        organizationId: orgId, id: uid(),
        email: u.email,
        name: `${u.firstName} ${u.lastName}`,
        firstName: u.firstName, lastName: u.lastName,
        passwordHash,
        roleId: roleMap[u.roleSlug].id,
        status: 'ACTIVE',
        employmentType: 'FULL_TIME',
        jobTitle: u.jobTitle,
        emailVerified: true,
      },
    })
    userIds[u.email] = user.id
  }
  console.log(`  ${userData.length} users`)

  // Team assignments
  const teamAssignments = [
    { email: 'bchen@demo.com', team: 'it-support' },
    { email: 'anelson@demo.com', team: 'it-support' },
    { email: 'lmartinez@demo.com', team: 'maintenance' },
    { email: 'dgarcia@demo.com', team: 'maintenance' },
    { email: 'kpatel@demo.com', team: 'av-production' },
    { email: 'tbrooks@demo.com', team: 'security' },
    { email: 'akim@demo.com', team: 'administration' },
    { email: 'admin@demo.com', team: 'administration' },
    { email: 'khermsmeyer@demo.com', team: 'administration' },
    { email: 'jmendez@demo.com', team: 'administration' },
  ]
  for (const ta of teamAssignments) {
    if (teamMap[ta.team] && userIds[ta.email]) {
      await prisma.userTeam.upsert({
        where: { userId_teamId: { userId: userIds[ta.email], teamId: teamMap[ta.team].id } },
        update: {},
        create: { userId: userIds[ta.email], teamId: teamMap[ta.team].id },
      })
    }
  }

  // ── 5. Categories ──────────────────────────────────────────────────────

  console.log('Creating categories...')

  const categoryData = [
    { name: 'Assembly', color: '#3B82F6', icon: 'users' },
    { name: 'Staff Meeting', color: '#8B5CF6', icon: 'briefcase' },
    { name: 'Parent Event', color: '#EC4899', icon: 'heart' },
    { name: 'Field Trip', color: '#F97316', icon: 'map-pin' },
    { name: 'Professional Development', color: '#14B8A6', icon: 'graduation-cap' },
    { name: 'Student Performance', color: '#EAB308', icon: 'sparkles' },
    { name: 'Testing', color: '#EF4444', icon: 'clipboard' },
    { name: 'Fundraiser', color: '#10B981', icon: 'dollar-sign' },
    { name: 'Board Meeting', color: '#6366F1', icon: 'building' },
    { name: 'Athletics', color: '#F97316', icon: 'trophy' },
    { name: 'Enrollment', color: '#06B6D4', icon: 'user-plus' },
    { name: 'Community Outreach', color: '#A855F7', icon: 'megaphone' },
  ]

  const categoryIds = {}
  for (const c of categoryData) {
    const cat = await prisma.calendarCategory.upsert({
      where: { organizationId_name: { organizationId: orgId, name: c.name } },
      update: { color: c.color, icon: c.icon },
      create: { organizationId: orgId, id: uid(), ...c },
    })
    categoryIds[c.name] = cat.id
  }
  console.log(`  ${categoryData.length} categories`)

  // ── 6. Calendars ───────────────────────────────────────────────────────

  console.log('Creating calendars...')

  const calendarData = [
    { name: 'District-Wide Calendar', calendarType: 'ACADEMIC', color: '#3B82F6', visibility: 'ORG_WIDE', isDefault: true, isActive: true },
    { name: 'Temecula Student Center', calendarType: 'ACADEMIC', color: '#10B981', campusId: campusIds['Temecula Student Center'], visibility: 'ORG_WIDE', isActive: true },
    { name: 'Enterprise Learning Center', calendarType: 'ACADEMIC', color: '#6366F1', campusId: campusIds['Enterprise Learning Center'], visibility: 'ORG_WIDE', isActive: true },
    { name: 'Otay Ranch Academy', calendarType: 'ACADEMIC', color: '#EC4899', campusId: campusIds['Otay Ranch Academy for the Arts'], visibility: 'ORG_WIDE', isActive: true },
    { name: 'Flabob Prep Academy', calendarType: 'ACADEMIC', color: '#F97316', campusId: campusIds['Flabob Airport Preparatory Academy'], visibility: 'ORG_WIDE', isActive: true },
    { name: 'Murrieta Student Center', calendarType: 'ACADEMIC', color: '#8B5CF6', campusId: campusIds['Murrieta Student Center'], visibility: 'ORG_WIDE', isActive: true },
    { name: 'Staff & PD Calendar', calendarType: 'STAFF', color: '#374151', visibility: 'ORG_WIDE', isActive: true },
    { name: 'Board & Governance', calendarType: 'GENERAL', color: '#1F2937', visibility: 'ORG_WIDE', isActive: true },
    { name: 'Community & Enrollment', calendarType: 'PARENT_FACING', color: '#06B6D4', visibility: 'PUBLIC', isActive: true },
  ]

  const calendarIds = {}
  for (const c of calendarData) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
    const cal = await prisma.calendar.upsert({
      where: { organizationId_slug: { organizationId: orgId, slug } },
      update: { ...c, slug },
      create: { organizationId: orgId, id: uid(), slug, createdById: admin.id, schoolId: school.id, ...c },
    })
    calendarIds[c.name] = cal.id
  }
  console.log(`  ${calendarData.length} calendars`)

  // ── 7. Calendar Events ─────────────────────────────────────────────────

  console.log('Creating calendar events...')

  const events = [
    // District-wide
    { title: 'Board of Directors Meeting', cal: 'Board & Governance', cat: 'Board Meeting', days: -10, h: 17, eh: 19, desc: 'Monthly board meeting. Public comment at 5:30 PM.', loc: 'Administrative Headquarters - Main Office Building' },
    { title: 'All-Staff Professional Development Day', cal: 'Staff & PD Calendar', cat: 'Professional Development', days: -5, h: 8, eh: 15, desc: 'District-wide PD: Personalized learning strategies and data-driven instruction.', loc: 'Virtual + Temecula Student Center', allDay: true },
    { title: 'CAASPP Testing Window Opens', cal: 'District-Wide Calendar', cat: 'Testing', days: -2, h: 8, eh: 15, desc: 'State standardized testing begins across all student centers. Modified schedules in effect.', loc: 'All Student Centers', allDay: true },
    { title: 'District Staff Meeting', cal: 'Staff & PD Calendar', cat: 'Staff Meeting', days: 2, h: 15, eh: 16, desc: 'Monthly all-staff meeting. Agenda: end-of-year timeline, summer programs, facility updates.', loc: 'Virtual' },
    { title: 'Open Enrollment Information Night', cal: 'Community & Enrollment', cat: 'Enrollment', days: 5, h: 18, eh: 20, desc: 'Learn about Springs Charter Schools programs. Tours available at Temecula and Murrieta centers.', loc: 'Temecula Student Center & Murrieta Student Center' },
    { title: 'Board Finance Committee', cal: 'Board & Governance', cat: 'Board Meeting', days: 10, h: 16, eh: 18, desc: 'Quarterly budget review and fiscal year planning.', loc: 'Administrative Headquarters' },
    { title: 'Summer Program Registration Opens', cal: 'District-Wide Calendar', cat: 'Enrollment', days: 14, h: 8, eh: 9, desc: 'Online registration opens for summer enrichment, credit recovery, and STEM camps.', loc: 'Online' },
    { title: 'Charter Renewal Planning Session', cal: 'Board & Governance', cat: 'Board Meeting', days: 18, h: 14, eh: 17, desc: 'Work session for charter renewal documentation with Riverside County Office of Education.', loc: 'Administrative Headquarters' },

    // Temecula
    { title: 'Temecula Spring Showcase', cal: 'Temecula Student Center', cat: 'Student Performance', days: 3, h: 18, eh: 20, desc: 'Student project presentations and performances for families.', loc: 'Temecula Classroom Building' },
    { title: 'Parent-Teacher Conferences', cal: 'Temecula Student Center', cat: 'Parent Event', days: 8, h: 13, eh: 19, desc: 'Spring conferences. Sign up through the parent portal.', loc: 'Temecula Classroom Building' },
    { title: 'Temecula Field Day', cal: 'Temecula Student Center', cat: 'Athletics', days: 20, h: 9, eh: 14, desc: 'Annual outdoor field day with relay races, games, and team challenges.', loc: 'Temecula Gymnasium', allDay: true },

    // Otay Ranch
    { title: 'Spring Arts Festival', cal: 'Otay Ranch Academy', cat: 'Student Performance', days: 4, h: 17, eh: 21, desc: 'Annual arts festival featuring student visual art, dance, theater, and music.', loc: 'Performing Arts Theater' },
    { title: 'Senior Art Gallery Opening', cal: 'Otay Ranch Academy', cat: 'Student Performance', days: 15, h: 18, eh: 20, desc: 'Senior capstone art exhibition open to families and community.', loc: 'Visual Arts Studio' },
    { title: 'Otay Ranch Graduation Ceremony', cal: 'Otay Ranch Academy', cat: 'Assembly', days: 35, h: 17, eh: 19, desc: 'Class of 2026 commencement ceremony for Otay Ranch Academy for the Arts.', loc: 'Performing Arts Theater' },

    // Flabob
    { title: 'Aviation Discovery Day', cal: 'Flabob Prep Academy', cat: 'Community Outreach', days: 6, h: 9, eh: 14, desc: 'Open house for prospective students. Flight simulator demos, hangar tours, and STEM activities.', loc: 'Aviation Hangar', allDay: true },
    { title: 'Young Eagles Flight Rally', cal: 'Flabob Prep Academy', cat: 'Field Trip', days: 12, h: 8, eh: 15, desc: 'EAA Young Eagles rally — students experience introductory flights with licensed pilots.', loc: 'Flabob Airport', allDay: true },

    // Enterprise
    { title: 'Enterprise Science Fair', cal: 'Enterprise Learning Center', cat: 'Student Performance', days: 7, h: 9, eh: 14, desc: 'Student science projects on display. Judging from 9-12, public viewing 12-2.', loc: 'Enterprise Main Hall' },
    { title: 'Media Production Showcase', cal: 'Enterprise Learning Center', cat: 'Student Performance', days: 16, h: 18, eh: 20, desc: 'Student films, podcasts, and digital media projects screened for families.', loc: 'Enterprise Media Lab' },

    // Murrieta
    { title: 'Murrieta Family Game Night', cal: 'Murrieta Student Center', cat: 'Parent Event', days: 9, h: 18, eh: 20, desc: 'Family engagement event with board games, trivia, and food trucks.', loc: 'Murrieta Multi-Purpose Room' },
    { title: 'Murrieta Promotion Ceremony', cal: 'Murrieta Student Center', cat: 'Assembly', days: 34, h: 10, eh: 12, desc: '8th grade promotion ceremony.', loc: 'Murrieta Multi-Purpose Room' },

    // Community
    { title: 'Community Resource Fair', cal: 'Community & Enrollment', cat: 'Community Outreach', days: 11, h: 10, eh: 14, desc: 'Free community event with local organizations, health screenings, and enrollment assistance.', loc: 'Temecula Student Center', allDay: true },
    { title: 'Spring Fundraiser Gala', cal: 'Community & Enrollment', cat: 'Fundraiser', days: 17, h: 18, eh: 21, desc: 'Annual fundraiser supporting arts programs and scholarships across all Springs Charter campuses.', loc: 'Temecula Arts Wing' },

    // End of year
    { title: 'Last Day of School - Early Release', cal: 'District-Wide Calendar', cat: 'Assembly', days: 38, h: 8, eh: 12, desc: 'Last day of the 2025-2026 school year. Early release at noon, all campuses.', loc: 'All Student Centers', allDay: true },
    { title: 'Staff End-of-Year Celebration', cal: 'Staff & PD Calendar', cat: 'Staff Meeting', days: 39, h: 11, eh: 14, desc: 'Year-end appreciation luncheon for all Springs Charter staff.', loc: 'Enterprise Main Hall' },
  ]

  let eventCount = 0
  for (const e of events) {
    const calId = calendarIds[e.cal]
    const catId = e.cat ? categoryIds[e.cat] : null
    if (!calId) continue
    const start = setTime(daysFromNow(e.days), e.h)
    const end = setTime(daysFromNow(e.days), e.eh)
    const existing = await prisma.calendarEvent.findFirst({ where: { organizationId: orgId, calendarId: calId, title: e.title } })
    if (!existing) {
      await prisma.calendarEvent.create({
        data: { id: uid(), organizationId: orgId, calendarId: calId, title: e.title, description: e.desc, startTime: start, endTime: end, locationText: e.loc, categoryId: catId, isAllDay: e.allDay || false, calendarStatus: 'CONFIRMED', createdById: admin.id },
      })
      eventCount++
    }
  }
  console.log(`  ${eventCount} calendar events`)

  // ── 8. Event Projects ──────────────────────────────────────────────────

  console.log('Creating event projects...')

  const projectData = [
    { title: 'Spring Fundraiser Gala', status: 'CONFIRMED', days: 17, desc: 'Annual fundraiser for arts and scholarships.', loc: 'Temecula Arts Wing', av: true, fac: true, cust: true, sec: true },
    { title: 'Spring Arts Festival - Otay Ranch', status: 'CONFIRMED', days: 4, desc: 'Multi-day arts festival featuring all disciplines.', loc: 'Performing Arts Theater', av: true, fac: true },
    { title: 'Otay Ranch Graduation', status: 'IN_PROGRESS', days: 35, desc: 'Commencement ceremony.', loc: 'Performing Arts Theater', av: true, fac: true, cust: true, sec: true },
    { title: 'Aviation Discovery Day', status: 'CONFIRMED', days: 6, desc: 'Open house with flight demos and STEM activities.', loc: 'Aviation Hangar', av: true, fac: true, sec: true },
    { title: 'Summer STEM Camp Setup', status: 'DRAFT', days: 50, endDays: 55, multi: true, desc: 'Week-long STEM camp across Temecula and Enterprise centers.', loc: 'Enterprise Main Hall', av: true },
    { title: 'Open Enrollment Night', status: 'PENDING_APPROVAL', days: 5, desc: 'Information night for prospective families.', loc: 'Temecula & Murrieta', av: true, gates: { av: { status: 'APPROVED' }, facilities: { status: 'PENDING' }, admin: { status: 'PENDING' } } },
    { title: 'Community Resource Fair', status: 'CONFIRMED', days: 11, desc: 'Free community event with enrollment assistance.', loc: 'Temecula Student Center', fac: true, sec: true },
    { title: 'Staff Appreciation Luncheon', status: 'CONFIRMED', days: 39, desc: 'End-of-year staff celebration.', loc: 'Enterprise Main Hall', fac: true, cust: true },
    { title: 'Charter Renewal Presentation', status: 'DRAFT', days: 30, desc: 'Formal presentation to RCOE board.', loc: 'Administrative Headquarters' },
    { title: 'Murrieta Family Game Night', status: 'PENDING_APPROVAL', days: 9, desc: 'Family engagement event.', loc: 'Murrieta Multi-Purpose Room', fac: true, gates: { facilities: { status: 'APPROVED' }, admin: { status: 'PENDING' } } },
  ]

  let projCount = 0
  for (const p of projectData) {
    const existing = await prisma.eventProject.findFirst({ where: { organizationId: orgId, title: p.title } })
    if (!existing) {
      await prisma.eventProject.create({
        data: {
          id: uid(), organizationId: orgId, title: p.title, description: p.desc,
          startsAt: setTime(daysFromNow(p.days), 9), endsAt: setTime(daysFromNow(p.endDays || p.days), 17),
          isMultiDay: p.multi || false, locationText: p.loc, status: p.status, source: 'DIRECT_REQUEST',
          createdById: admin.id, schoolId: school.id,
          requiresAV: p.av || false, requiresFacilities: p.fac || false,
          requiresCustodial: p.cust || false, requiresSecurity: p.sec || false,
          approvalGates: p.gates || null,
        },
      })
      projCount++
    }
  }
  console.log(`  ${projCount} event projects`)

  // ── 9. Tickets ─────────────────────────────────────────────────────────

  console.log('Creating tickets...')

  const ticketData = [
    { title: 'HVAC not cooling - Temecula Classroom Building', cat: 'MAINTENANCE', pri: 'HIGH', status: 'OPEN', desc: 'Room 3 and 4 temperatures reaching 85F. HVAC unit making grinding noise.', loc: 'Temecula Classroom Building', by: 'slee@demo.com' },
    { title: 'Parking lot lights out - Enterprise', cat: 'MAINTENANCE', pri: 'HIGH', status: 'OPEN', desc: 'Three parking lot lights out in the west lot. Safety concern for evening programs.', loc: 'Enterprise Learning Center', by: 'lmartinez@demo.com' },
    { title: 'Restroom plumbing issue - Murrieta', cat: 'MAINTENANCE', pri: 'NORMAL', status: 'IN_PROGRESS', desc: 'Second floor restroom has a slow drain. Pooling water on floor.', loc: 'Murrieta Classroom Building', by: 'mrivera@demo.com', to: 'dgarcia@demo.com' },
    { title: 'Replace carpet tiles - Otay Ranch lobby', cat: 'MAINTENANCE', pri: 'LOW', status: 'OPEN', desc: 'Several carpet tiles in the main lobby are stained and lifting. Replacement needed before Arts Festival.', loc: 'Otay Ranch Classroom Building', by: 'jpark@demo.com' },
    { title: 'Fire extinguisher inspection overdue - HQ', cat: 'MAINTENANCE', pri: 'CRITICAL', status: 'OPEN', desc: 'Annual fire extinguisher inspection is 2 weeks overdue for the Main Office Building.', loc: 'Main Office Building', by: 'lmartinez@demo.com' },
    { title: 'Projector dead in Temecula Room 6', cat: 'IT', pri: 'HIGH', status: 'OPEN', desc: 'Ceiling projector shows no image. Lamp indicator is red. Need replacement bulb or unit.', loc: 'Temecula Classroom Building - Room 6', by: 'mlee@demo.com' },
    { title: 'Wi-Fi connectivity issues - Palm Academy', cat: 'IT', pri: 'CRITICAL', status: 'IN_PROGRESS', desc: 'Intermittent Wi-Fi drops across the entire campus since Monday. Affecting Chromebook usage for 200+ students.', loc: 'Palm Academy Main Building', to: 'bchen@demo.com', by: 'cfoster@demo.com' },
    { title: 'Student Chromebook batch - cracked screens (5)', cat: 'IT', pri: 'NORMAL', status: 'OPEN', desc: 'Five Chromebooks returned with cracked screens from Riverside Student Center. Asset tags: RS-CB-1247 through 1251.', loc: 'IT & Operations Center', by: 'anelson@demo.com' },
    { title: 'PA system feedback at Flabob', cat: 'IT', pri: 'HIGH', status: 'OPEN', desc: 'PA system produces loud feedback during morning announcements. Needs audio calibration before Aviation Discovery Day.', loc: 'Flabob STEM Lab', by: 'twalker@demo.com' },
    { title: 'Smartboard calibration - Enterprise Room 2', cat: 'IT', pri: 'LOW', status: 'RESOLVED', desc: 'Smartboard touch points are misaligned. Recalibrated and tested.', loc: 'Enterprise Main Hall - Room 2', by: 'rwilson@demo.com', to: 'anelson@demo.com' },
    { title: 'AV setup needed for Spring Arts Festival', cat: 'EVENT', pri: 'HIGH', status: 'IN_PROGRESS', desc: 'Full AV setup: stage lighting, 6 wireless mics, 2 projectors, sound system for theater and outdoor stage.', loc: 'Performing Arts Theater', to: 'kpatel@demo.com', by: 'jpark@demo.com' },
    { title: 'Tables and chairs for Community Resource Fair', cat: 'EVENT', pri: 'NORMAL', status: 'OPEN', desc: 'Need 30 tables and 120 chairs set up in the parking lot area. Setup Friday evening.', loc: 'Temecula Student Center', by: 'admin@demo.com' },
    { title: 'Graduation stage rental coordination', cat: 'EVENT', pri: 'HIGH', status: 'OPEN', desc: 'Coordinate rental of portable stage, podium, and sound system for Otay Ranch graduation ceremony.', loc: 'Performing Arts Theater', by: 'jpark@demo.com' },
  ]

  let ticketCount = 0
  for (const t of ticketData) {
    const existing = await prisma.ticket.findFirst({ where: { organizationId: orgId, title: t.title } })
    if (!existing) {
      await prisma.ticket.create({
        data: {
          id: uid(), organizationId: orgId, title: t.title, description: t.desc,
          category: t.cat, priority: t.pri, status: t.status, locationText: t.loc,
          createdById: userIds[t.by] || admin.id,
          assignedToId: t.to ? (userIds[t.to] || null) : null,
        },
      })
      ticketCount++
    }
  }
  console.log(`  ${ticketCount} tickets`)

  // ── 10. Inventory ──────────────────────────────────────────────────────

  console.log('Creating inventory...')

  const inventoryData = [
    { name: 'Folding Tables (6ft)', category: 'Event Equipment', quantityOnHand: 120, reorderThreshold: 20, description: 'Standard 6-foot folding tables distributed across student centers.' },
    { name: 'Folding Chairs', category: 'Event Equipment', quantityOnHand: 800, reorderThreshold: 100, description: 'Metal folding chairs for assemblies and events.' },
    { name: 'Pop-Up Canopy (10x10)', category: 'Event Equipment', quantityOnHand: 25, reorderThreshold: 5, description: 'Instant canopy tents for outdoor events.' },
    { name: 'Wireless Microphone Set', category: 'A/V Equipment', quantityOnHand: 14, reorderThreshold: 3, description: 'Shure wireless handheld microphone systems.' },
    { name: 'Portable PA Speaker', category: 'A/V Equipment', quantityOnHand: 8, reorderThreshold: 2, description: 'JBL powered portable speakers for outdoor events.' },
    { name: 'Portable Projector', category: 'A/V Equipment', quantityOnHand: 12, reorderThreshold: 2, description: 'Epson portable projectors for classroom and meeting use.' },
    { name: 'Stage Lighting Kit', category: 'A/V Equipment', quantityOnHand: 3, reorderThreshold: 0, description: 'Portable LED stage lighting kits (Otay Ranch + HQ).' },
    { name: 'Student Chromebook', category: 'IT Equipment', quantityOnHand: 2400, reorderThreshold: 50, description: 'Lenovo 300e Chromebooks for 1:1 student program across all centers.' },
    { name: 'Teacher Laptop', category: 'IT Equipment', quantityOnHand: 180, reorderThreshold: 10, description: 'Dell Latitude 5540 laptops for instructional staff.' },
    { name: 'Walkie-Talkie Set', category: 'Security', quantityOnHand: 40, reorderThreshold: 5, description: 'Motorola two-way radios distributed to all center directors and security.' },
    { name: 'First Aid Kit', category: 'Safety', quantityOnHand: 45, reorderThreshold: 10, description: 'Comprehensive first aid kits — 2 per student center plus spares.' },
    { name: 'Extension Cords (50ft)', category: 'Facilities', quantityOnHand: 35, reorderThreshold: 10, description: 'Heavy-duty outdoor-rated extension cords.' },
    { name: 'Safety Cones', category: 'Facilities', quantityOnHand: 60, reorderThreshold: 15, description: 'Orange traffic cones for parking and event management.' },
    { name: 'HDMI Cables (15ft)', category: 'A/V Equipment', quantityOnHand: 50, reorderThreshold: 10, description: '15-foot HDMI cables for projector connections.' },
  ]

  let invCount = 0
  for (const item of inventoryData) {
    const existing = await prisma.inventoryItem.findFirst({ where: { organizationId: orgId, name: item.name } })
    if (!existing) {
      await prisma.inventoryItem.create({ data: { id: uid(), organizationId: orgId, ...item, allowCheckout: true } })
      invCount++
    }
  }
  console.log(`  ${invCount} inventory items`)

  // ── Done ───────────────────────────────────────────────────────────────

  console.log('\n--- Springs Charter Schools Seeded ---')
  console.log(`\nOrg: Springs Charter Schools`)
  console.log(`School: River Springs Charter School`)
  console.log(`Campuses: ${campusData.length} (21 student/learning centers + HQ)`)
  console.log(`Buildings: ${buildingData.length}`)
  console.log(`Users: ${userData.length + 1}`)
  console.log(`Calendars: ${calendarData.length}`)
  console.log(`Events: ${eventCount}`)
  console.log(`Event Projects: ${projCount}`)
  console.log(`Tickets: ${ticketCount}`)
  console.log(`Inventory: ${invCount}`)
  console.log(`\nAll passwords: test123`)
  console.log('')
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
