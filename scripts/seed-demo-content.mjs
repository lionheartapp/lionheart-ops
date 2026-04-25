/**
 * Seed rich demo content for the "demo" organization.
 * Run: node scripts/seed-demo-content.mjs
 *
 * Populates: schools, campuses, buildings, rooms, calendars, categories,
 * calendar events, event projects, tickets, inventory items, and users.
 */

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

// Prefer .env.local for local dev
config({ path: '.env.local' })
config()

const prisma = new PrismaClient()
const uid = () => crypto.randomUUID()

// ── Helpers ──────────────────────────────────────────────────────────────

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

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n--- Seeding Demo Content ---\n')

  // Find the demo org
  const org = await prisma.organization.findUnique({ where: { slug: 'demo' } })
  if (!org) {
    console.error('No "demo" organization found. Run `npm run db:seed` first.')
    process.exit(1)
  }
  const orgId = org.id
  console.log(`Organization: ${org.name} (${orgId})`)

  // Find admin user for createdById references
  const admin = await prisma.user.findFirst({
    where: { organizationId: orgId, email: 'admin@demo.com' },
  })
  if (!admin) {
    console.error('Admin user not found. Run `npm run db:seed` first.')
    process.exit(1)
  }

  // Get roles for new users
  const roles = await prisma.role.findMany({ where: { organizationId: orgId } })
  const roleMap = Object.fromEntries(roles.map((r) => [r.slug, r]))

  // Get teams
  const teams = await prisma.team.findMany({ where: { organizationId: orgId } })
  const teamMap = Object.fromEntries(teams.map((t) => [t.slug, t]))

  // ── 1. Schools ──────────────────────────────────────────────────────────

  console.log('Creating schools...')

  const schoolData = [
    { name: 'River Springs Elementary', institutionType: 'CHARTER', color: '#10B981', sortOrder: 0, principalName: 'Dr. Maria Santos', principalEmail: 'msantos@riverspringscharter.org' },
    { name: 'River Springs Middle School', institutionType: 'CHARTER', color: '#6366F1', sortOrder: 1, principalName: 'James Whitfield', principalEmail: 'jwhitfield@riverspringscharter.org' },
    { name: 'River Springs High School', institutionType: 'CHARTER', color: '#3B82F6', sortOrder: 2, principalName: 'Dr. Angela Torres', principalEmail: 'atorres@riverspringscharter.org' },
  ]

  const schoolIds = {}
  for (const s of schoolData) {
    const school = await prisma.school.upsert({
      where: { organizationId_name: { organizationId: orgId, name: s.name } },
      update: { ...s },
      create: { organizationId: orgId, id: uid(), ...s },
    })
    schoolIds[s.name] = school.id
    console.log(`  School: ${school.name}`)
  }

  // ── 2. Campuses ─────────────────────────────────────────────────────────

  console.log('Creating campuses...')

  const campusData = [
    { name: 'Elementary Campus', gradeLevel: 'ELEMENTARY', schoolId: schoolIds['River Springs Elementary'], color: '#10B981', sortOrder: 0, address: '1200 Oak Valley Dr, Temecula, CA 92591' },
    { name: 'Middle School Campus', gradeLevel: 'MIDDLE_SCHOOL', schoolId: schoolIds['River Springs Middle School'], color: '#6366F1', sortOrder: 1, address: '2400 Meadow Creek Ln, Temecula, CA 92592' },
    { name: 'Main Campus', gradeLevel: 'HIGH_SCHOOL', schoolId: schoolIds['River Springs High School'], color: '#3B82F6', sortOrder: 2, address: '3800 River Springs Way, Temecula, CA 92590' },
  ]

  const campusIds = {}
  for (const c of campusData) {
    let campus = await prisma.campus.findFirst({
      where: { organizationId: orgId, name: c.name },
    })
    if (!campus) {
      campus = await prisma.campus.create({
        data: { organizationId: orgId, id: uid(), ...c },
      })
    }
    campusIds[c.name] = campus.id
    console.log(`  Campus: ${campus.name}`)
  }

  // ── 3. Buildings ────────────────────────────────────────────────────────

  console.log('Creating buildings...')

  const buildingData = [
    // Elementary
    { name: 'Classroom Wing A', campusId: campusIds['Elementary Campus'], buildingType: 'GENERAL' },
    { name: 'Classroom Wing B', campusId: campusIds['Elementary Campus'], buildingType: 'GENERAL' },
    { name: 'Elementary Gym', campusId: campusIds['Elementary Campus'], buildingType: 'ATHLETICS' },
    { name: 'Media Center', campusId: campusIds['Elementary Campus'], buildingType: 'GENERAL' },
    // Middle School
    { name: 'STEM Building', campusId: campusIds['Middle School Campus'], buildingType: 'GENERAL' },
    { name: 'Arts & Humanities', campusId: campusIds['Middle School Campus'], buildingType: 'ARTS_CULTURE' },
    { name: 'Middle School Gymnasium', campusId: campusIds['Middle School Campus'], buildingType: 'ATHLETICS' },
    { name: 'Admin Building', campusId: campusIds['Middle School Campus'], buildingType: 'ADMINISTRATION' },
    // High School
    { name: 'Science & Technology Center', campusId: campusIds['Main Campus'], buildingType: 'GENERAL' },
    { name: 'Performing Arts Center', campusId: campusIds['Main Campus'], buildingType: 'ARTS_CULTURE' },
    { name: 'Athletic Complex', campusId: campusIds['Main Campus'], buildingType: 'ATHLETICS' },
    { name: 'Main Administration', campusId: campusIds['Main Campus'], buildingType: 'ADMINISTRATION' },
    { name: 'Student Commons', campusId: campusIds['Main Campus'], buildingType: 'GENERAL' },
    { name: 'Library & Learning Center', campusId: campusIds['Main Campus'], buildingType: 'GENERAL' },
  ]

  const buildingIds = {}
  for (const b of buildingData) {
    let building = await prisma.building.findFirst({
      where: { organizationId: orgId, name: b.name },
    })
    if (!building) {
      building = await prisma.building.create({
        data: { organizationId: orgId, id: uid(), ...b },
      })
    }
    buildingIds[b.name] = building.id
  }
  console.log(`  ${buildingData.length} buildings created`)

  // ── 4. Additional Users ─────────────────────────────────────────────────

  console.log('Creating users...')

  const passwordHash = await bcrypt.hash('test123', 10)

  const userData = [
    { email: 'jwhitfield@demo.com', firstName: 'James', lastName: 'Whitfield', jobTitle: 'Middle School Principal', roleSlug: 'admin' },
    { email: 'atorres@demo.com', firstName: 'Angela', lastName: 'Torres', jobTitle: 'High School Principal', roleSlug: 'admin' },
    { email: 'msantos@demo.com', firstName: 'Maria', lastName: 'Santos', jobTitle: 'Elementary Principal', roleSlug: 'admin' },
    { email: 'bchen@demo.com', firstName: 'Brian', lastName: 'Chen', jobTitle: 'IT Director', roleSlug: 'admin' },
    { email: 'lmartinez@demo.com', firstName: 'Lisa', lastName: 'Martinez', jobTitle: 'Facilities Manager', roleSlug: 'admin' },
    { email: 'kpatel@demo.com', firstName: 'Kevin', lastName: 'Patel', jobTitle: 'A/V Coordinator', roleSlug: 'member' },
    { email: 'sjohnson@demo.com', firstName: 'Sarah', lastName: 'Johnson', jobTitle: 'Athletic Director', roleSlug: 'admin' },
    { email: 'mlee@demo.com', firstName: 'Michael', lastName: 'Lee', jobTitle: 'Math Teacher', roleSlug: 'member' },
    { email: 'rwilson@demo.com', firstName: 'Rachel', lastName: 'Wilson', jobTitle: 'Science Teacher', roleSlug: 'member' },
    { email: 'dgarcia@demo.com', firstName: 'David', lastName: 'Garcia', jobTitle: 'Custodial Lead', roleSlug: 'member' },
    { email: 'akim@demo.com', firstName: 'Amy', lastName: 'Kim', jobTitle: 'Office Manager', roleSlug: 'member' },
    { email: 'tbrooks@demo.com', firstName: 'Tyler', lastName: 'Brooks', jobTitle: 'Security Officer', roleSlug: 'member' },
  ]

  const userIds = { [admin.email]: admin.id }
  for (const u of userData) {
    const user = await prisma.user.upsert({
      where: { organizationId_email: { organizationId: orgId, email: u.email } },
      update: { firstName: u.firstName, lastName: u.lastName, roleId: roleMap[u.roleSlug].id },
      create: {
        organizationId: orgId,
        id: uid(),
        email: u.email,
        name: `${u.firstName} ${u.lastName}`,
        firstName: u.firstName,
        lastName: u.lastName,
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
  console.log(`  ${userData.length} users created`)

  // Assign users to teams
  const teamAssignments = [
    { email: 'bchen@demo.com', team: 'it-support' },
    { email: 'lmartinez@demo.com', team: 'maintenance' },
    { email: 'kpatel@demo.com', team: 'av-production' },
    { email: 'dgarcia@demo.com', team: 'maintenance' },
    { email: 'tbrooks@demo.com', team: 'security' },
    { email: 'akim@demo.com', team: 'administration' },
    { email: 'admin@demo.com', team: 'administration' },
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
  console.log(`  ${teamAssignments.length} team assignments`)

  // ── 5. Calendar Categories ──────────────────────────────────────────────

  console.log('Creating calendar categories...')

  const categoryData = [
    { name: 'Assembly', color: '#3B82F6', icon: 'users' },
    { name: 'Staff Meeting', color: '#8B5CF6', icon: 'briefcase' },
    { name: 'Parent Event', color: '#EC4899', icon: 'heart' },
    { name: 'Field Trip', color: '#F97316', icon: 'map-pin' },
    { name: 'Professional Development', color: '#14B8A6', icon: 'graduation-cap' },
    { name: 'Spirit Week', color: '#EAB308', icon: 'sparkles' },
    { name: 'Testing', color: '#EF4444', icon: 'clipboard' },
    { name: 'Fundraiser', color: '#10B981', icon: 'dollar-sign' },
    { name: 'Board Meeting', color: '#6366F1', icon: 'building' },
    { name: 'Athletics', color: '#F97316', icon: 'trophy' },
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
  console.log(`  ${categoryData.length} categories created`)

  // ── 6. Calendars ────────────────────────────────────────────────────────

  console.log('Creating calendars...')

  const calendarData = [
    { name: 'Elementary School Master', calendarType: 'ACADEMIC', color: '#10B981', campusId: campusIds['Elementary Campus'], schoolId: schoolIds['River Springs Elementary'], visibility: 'ORG_WIDE', isDefault: true, isActive: true },
    { name: 'Middle School Master', calendarType: 'ACADEMIC', color: '#6366F1', campusId: campusIds['Middle School Campus'], schoolId: schoolIds['River Springs Middle School'], visibility: 'ORG_WIDE', isDefault: false, isActive: true },
    { name: 'High School Master', calendarType: 'ACADEMIC', color: '#3B82F6', campusId: campusIds['Main Campus'], schoolId: schoolIds['River Springs High School'], visibility: 'ORG_WIDE', isDefault: false, isActive: true },
    { name: 'Staff Calendar', calendarType: 'STAFF', color: '#8B5CF6', visibility: 'ORG_WIDE', isDefault: false, isActive: true },
    { name: 'Athletics Calendar', calendarType: 'ATHLETICS', color: '#F97316', visibility: 'ORG_WIDE', isDefault: false, isActive: true },
    { name: 'Parent-Facing Calendar', calendarType: 'PARENT_FACING', color: '#EC4899', visibility: 'PUBLIC', isDefault: false, isActive: true },
    { name: 'Board & Governance', calendarType: 'GENERAL', color: '#374151', visibility: 'ORG_WIDE', isDefault: false, isActive: true },
  ]

  const calendarIds = {}
  for (const c of calendarData) {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const cal = await prisma.calendar.upsert({
      where: { organizationId_slug: { organizationId: orgId, slug } },
      update: { ...c, slug },
      create: { organizationId: orgId, id: uid(), slug, createdById: admin.id, ...c },
    })
    calendarIds[c.name] = cal.id
  }
  console.log(`  ${calendarData.length} calendars created`)

  // ── 7. Calendar Events ──────────────────────────────────────────────────

  console.log('Creating calendar events...')

  const events = [
    // Past events
    { title: 'Back to School Night', calendarName: 'High School Master', categoryName: 'Parent Event', daysOffset: -20, startHour: 18, endHour: 20, description: 'Annual back to school night for all high school families. Meet teachers, tour classrooms, and learn about the year ahead.', locationText: 'Student Commons' },
    { title: 'Staff Professional Development Day', calendarName: 'Staff Calendar', categoryName: 'Professional Development', daysOffset: -15, startHour: 8, endHour: 15, description: 'Full-day PD focused on differentiated instruction and project-based learning.', locationText: 'Library & Learning Center', isAllDay: true },
    { title: 'Board of Directors Meeting', calendarName: 'Board & Governance', categoryName: 'Board Meeting', daysOffset: -12, startHour: 17, endHour: 19, description: 'Monthly board meeting. Public comment period at 5:30 PM.', locationText: 'Main Administration - Board Room' },

    // This week
    { title: 'CAASPP Testing Window Opens', calendarName: 'High School Master', categoryName: 'Testing', daysOffset: -1, startHour: 8, endHour: 15, description: 'State standardized testing begins for grades 9-11. Modified bell schedule in effect.', locationText: 'Science & Technology Center', isAllDay: true },
    { title: 'Elementary Spring Concert', calendarName: 'Elementary School Master', categoryName: 'Parent Event', daysOffset: 1, startHour: 18, endHour: 19, description: 'K-5 spring music showcase featuring student performances from all grade levels.', locationText: 'Elementary Gym' },
    { title: 'Staff Meeting - All Schools', calendarName: 'Staff Calendar', categoryName: 'Staff Meeting', daysOffset: 2, startHour: 15, endHour: 16, description: 'Monthly all-staff meeting. Agenda: end-of-year timeline, summer school updates, facility improvements.', locationText: 'Performing Arts Center' },
    { title: 'Middle School Science Fair', calendarName: 'Middle School Master', categoryName: 'Parent Event', daysOffset: 3, startHour: 9, endHour: 14, description: '6th-8th grade science fair. Student projects on display for judging and parent viewing.', locationText: 'STEM Building' },

    // Next week
    { title: 'High School Spring Formal', calendarName: 'High School Master', categoryName: 'Spirit Week', daysOffset: 7, startHour: 19, endHour: 22, description: 'Annual spring formal dance for grades 9-12. Tickets required.', locationText: 'Student Commons' },
    { title: 'Elementary Field Trip - Natural History Museum', calendarName: 'Elementary School Master', categoryName: 'Field Trip', daysOffset: 8, startHour: 8, endHour: 14, description: '3rd grade field trip to the Natural History Museum. Buses depart at 8:00 AM sharp.', locationText: 'Off Campus' },
    { title: 'MS Basketball vs. Valley Academy', calendarName: 'Athletics Calendar', categoryName: 'Athletics', daysOffset: 8, startHour: 15, endHour: 17, description: 'Home game. Middle school basketball championship qualifier.', locationText: 'Middle School Gymnasium' },
    { title: 'Parent Teacher Conferences', calendarName: 'Parent-Facing Calendar', categoryName: 'Parent Event', daysOffset: 9, startHour: 13, endHour: 19, description: 'Spring parent-teacher conferences. Half day for students. Sign up through the parent portal.', locationText: 'All Campuses' },
    { title: 'Charter Renewal Committee', calendarName: 'Board & Governance', categoryName: 'Board Meeting', daysOffset: 10, startHour: 16, endHour: 18, description: 'Committee meeting to review charter renewal documentation and timeline.', locationText: 'Main Administration - Conference Room' },

    // 2-3 weeks out
    { title: 'HS Track & Field Invitational', calendarName: 'Athletics Calendar', categoryName: 'Athletics', daysOffset: 14, startHour: 9, endHour: 16, description: 'Annual invitational with 12 schools competing. Full concession stand.', locationText: 'Athletic Complex', isAllDay: true },
    { title: 'Robotics Club Showcase', calendarName: 'Middle School Master', categoryName: 'Assembly', daysOffset: 15, startHour: 10, endHour: 11, description: 'Middle school robotics club presents their competition robots to the student body.', locationText: 'STEM Building' },
    { title: 'Spring Fundraiser Gala', calendarName: 'Parent-Facing Calendar', categoryName: 'Fundraiser', daysOffset: 17, startHour: 18, endHour: 21, description: 'Annual fundraiser supporting arts programs and scholarships. Silent auction, dinner, and entertainment.', locationText: 'Performing Arts Center' },
    { title: 'Professional Development - AI in Education', calendarName: 'Staff Calendar', categoryName: 'Professional Development', daysOffset: 19, startHour: 8, endHour: 12, description: 'Half-day workshop on integrating AI tools into classroom instruction responsibly.', locationText: 'Library & Learning Center' },
    { title: 'Elementary Field Day', calendarName: 'Elementary School Master', categoryName: 'Spirit Week', daysOffset: 21, startHour: 9, endHour: 14, description: 'Annual outdoor field day for all elementary students. Relay races, games, and team challenges.', locationText: 'Elementary Gym', isAllDay: true },

    // 4+ weeks out
    { title: 'High School Graduation Ceremony', calendarName: 'High School Master', categoryName: 'Assembly', daysOffset: 35, startHour: 17, endHour: 19, description: 'Class of 2026 commencement ceremony. Processional begins at 4:45 PM.', locationText: 'Athletic Complex' },
    { title: '8th Grade Promotion', calendarName: 'Middle School Master', categoryName: 'Assembly', daysOffset: 34, startHour: 10, endHour: 12, description: '8th grade promotion ceremony celebrating students moving on to high school.', locationText: 'Middle School Gymnasium' },
    { title: 'Last Day of School - Early Release', calendarName: 'Parent-Facing Calendar', categoryName: 'Assembly', daysOffset: 38, startHour: 8, endHour: 12, description: 'Last day of the 2025-2026 school year. Early release at noon.', locationText: 'All Campuses', isAllDay: true },
    { title: 'Summer School Registration Opens', calendarName: 'Staff Calendar', categoryName: 'Staff Meeting', daysOffset: 28, startHour: 8, endHour: 9, description: 'Online registration opens for summer school courses and enrichment programs.', locationText: 'Online' },
  ]

  let eventCount = 0
  for (const e of events) {
    const start = setTime(daysFromNow(e.daysOffset), e.startHour)
    const end = setTime(daysFromNow(e.daysOffset), e.endHour)
    const calId = calendarIds[e.calendarName]
    const catId = e.categoryName ? categoryIds[e.categoryName] : null
    if (!calId) continue

    const existing = await prisma.calendarEvent.findFirst({
      where: { organizationId: orgId, calendarId: calId, title: e.title },
    })
    if (!existing) {
      await prisma.calendarEvent.create({
        data: {
          id: uid(),
          organizationId: orgId,
          calendarId: calId,
          title: e.title,
          description: e.description,
          startTime: start,
          endTime: end,
          locationText: e.locationText,
          categoryId: catId,
          isAllDay: e.isAllDay || false,
          calendarStatus: 'CONFIRMED',
          createdById: admin.id,
        },
      })
    }
    eventCount++
  }
  console.log(`  ${eventCount} calendar events created`)

  // ── 8. Event Projects ───────────────────────────────────────────────────

  console.log('Creating event projects...')

  const projectData = [
    { title: 'Spring Fundraiser Gala', status: 'CONFIRMED', daysOffset: 17, endOffset: 17, description: 'Annual fundraiser supporting arts programs and scholarships.', locationText: 'Performing Arts Center', requiresAV: true, requiresFacilities: true, requiresCustodial: true, requiresSecurity: true, schoolId: schoolIds['River Springs High School'] },
    { title: 'Elementary Spring Concert', status: 'CONFIRMED', daysOffset: 1, endOffset: 1, description: 'K-5 spring music showcase.', locationText: 'Elementary Gym', requiresAV: true, requiresFacilities: true, schoolId: schoolIds['River Springs Elementary'] },
    { title: 'High School Graduation', status: 'IN_PROGRESS', daysOffset: 35, endOffset: 35, description: 'Class of 2026 commencement ceremony.', locationText: 'Athletic Complex', requiresAV: true, requiresFacilities: true, requiresCustodial: true, requiresSecurity: true, schoolId: schoolIds['River Springs High School'] },
    { title: 'Summer STEM Camp', status: 'DRAFT', daysOffset: 50, endOffset: 55, isMultiDay: true, description: 'Week-long STEM enrichment camp for grades 6-10.', locationText: 'Science & Technology Center', requiresAV: true, schoolId: schoolIds['River Springs High School'] },
    { title: 'Parent Orientation Night', status: 'PENDING_APPROVAL', daysOffset: 25, endOffset: 25, description: 'Orientation for incoming 6th grade families.', locationText: 'Arts & Humanities', requiresAV: true, schoolId: schoolIds['River Springs Middle School'] },
    { title: 'Track & Field Invitational', status: 'CONFIRMED', daysOffset: 14, endOffset: 14, description: 'Annual invitational with 12 competing schools.', locationText: 'Athletic Complex', requiresFacilities: true, requiresSecurity: true, schoolId: schoolIds['River Springs High School'] },
    { title: 'Staff Appreciation Luncheon', status: 'CONFIRMED', daysOffset: 20, endOffset: 20, description: 'End-of-year staff appreciation event with catered lunch.', locationText: 'Student Commons', requiresFacilities: true, requiresCustodial: true },
    { title: 'Art Gallery Opening', status: 'PENDING_APPROVAL', daysOffset: 22, endOffset: 22, description: 'Student art showcase open to families and community.', locationText: 'Performing Arts Center', requiresAV: true, schoolId: schoolIds['River Springs High School'] },
    { title: 'Middle School Dance', status: 'DRAFT', daysOffset: 28, endOffset: 28, description: 'End-of-year dance for 6th-8th graders.', locationText: 'Middle School Gymnasium', requiresAV: true, requiresSecurity: true, schoolId: schoolIds['River Springs Middle School'] },
    { title: 'Kindergarten Celebration', status: 'CONFIRMED', daysOffset: 33, endOffset: 33, description: 'Kindergarten graduation and celebration.', locationText: 'Elementary Gym', requiresAV: true, schoolId: schoolIds['River Springs Elementary'] },
  ]

  for (const p of projectData) {
    const startsAt = setTime(daysFromNow(p.daysOffset), 9)
    const endsAt = setTime(daysFromNow(p.endOffset), 17)

    const existingProject = await prisma.eventProject.findFirst({
      where: { organizationId: orgId, title: p.title },
    })
    if (!existingProject) {
      await prisma.eventProject.create({
        data: {
          id: uid(),
          organizationId: orgId,
          title: p.title,
          description: p.description,
          startsAt,
          endsAt,
          isMultiDay: p.isMultiDay || false,
          locationText: p.locationText,
          status: p.status,
          source: 'DIRECT_REQUEST',
          createdById: admin.id,
          requiresAV: p.requiresAV || false,
          requiresFacilities: p.requiresFacilities || false,
          requiresCustodial: p.requiresCustodial || false,
          requiresSecurity: p.requiresSecurity || false,
          schoolId: p.schoolId || null,
          approvalGates: p.status === 'PENDING_APPROVAL' ? { av: { status: 'PENDING' }, facilities: { status: 'APPROVED' }, admin: { status: 'PENDING' } } : null,
        },
      })
    }
  }
  console.log(`  ${projectData.length} event projects created`)

  // ── 9. Tickets ──────────────────────────────────────────────────────────

  console.log('Creating tickets...')

  const ticketData = [
    // Maintenance
    { title: 'Gym floor needs refinishing', category: 'MAINTENANCE', priority: 'HIGH', status: 'OPEN', description: 'The gym floor has visible wear and scuff marks in the main court area. Needs professional refinishing before graduation.', locationText: 'Athletic Complex', createdBy: 'lmartinez@demo.com' },
    { title: 'Replace HVAC filter - Building B', category: 'MAINTENANCE', priority: 'NORMAL', status: 'IN_PROGRESS', description: 'Scheduled filter replacement for HVAC units in Classroom Wing B.', locationText: 'Classroom Wing B', assignedTo: 'dgarcia@demo.com', createdBy: 'lmartinez@demo.com' },
    { title: 'Parking lot light out - Section C', category: 'MAINTENANCE', priority: 'HIGH', status: 'OPEN', description: 'Two parking lot lights are out in the visitor parking section near the performing arts center. Safety concern for evening events.', locationText: 'Main Campus - Parking Lot C', createdBy: 'tbrooks@demo.com' },
    { title: 'Water fountain leaking - 2nd floor', category: 'MAINTENANCE', priority: 'NORMAL', status: 'OPEN', description: 'Water fountain outside Room 204 has a slow leak. Water pooling on floor.', locationText: 'STEM Building - 2nd Floor', createdBy: 'rwilson@demo.com' },
    { title: 'Classroom door lock sticking - Room 112', category: 'MAINTENANCE', priority: 'LOW', status: 'RESOLVED', description: 'Door lock on Room 112 requires extra force to lock/unlock. Needs adjustment or replacement.', locationText: 'Classroom Wing A - Room 112', createdBy: 'mlee@demo.com', assignedTo: 'dgarcia@demo.com' },
    { title: 'Restroom soap dispenser broken', category: 'MAINTENANCE', priority: 'NORMAL', status: 'IN_PROGRESS', description: 'Boys restroom near the cafeteria - soap dispenser is broken and leaking.', locationText: 'Student Commons - Restroom', assignedTo: 'dgarcia@demo.com', createdBy: 'akim@demo.com' },

    // IT
    { title: 'Projector not displaying in Room 305', category: 'IT', priority: 'HIGH', status: 'OPEN', description: 'Ceiling-mounted projector in Room 305 shows "No Signal" on all inputs. Tried different cables and laptop.', locationText: 'Science & Technology Center - Room 305', createdBy: 'rwilson@demo.com' },
    { title: 'Wi-Fi dead zone in Arts building', category: 'IT', priority: 'CRITICAL', status: 'IN_PROGRESS', description: 'Multiple staff reporting no Wi-Fi connectivity in the Arts & Humanities building since this morning. Affecting Chromebook usage.', locationText: 'Arts & Humanities', assignedTo: 'bchen@demo.com', createdBy: 'admin@demo.com' },
    { title: 'Need new toner for office printer', category: 'IT', priority: 'LOW', status: 'OPEN', description: 'Front office laser printer showing low toner warning. Will need replacement within the week.', locationText: 'Main Administration', createdBy: 'akim@demo.com' },
    { title: 'Student Chromebook screen cracked', category: 'IT', priority: 'NORMAL', status: 'OPEN', description: 'Student in 7th grade returned Chromebook with cracked screen. Asset tag #RS-CB-1247.', locationText: 'STEM Building', createdBy: 'mlee@demo.com' },
    { title: 'PA system feedback in cafeteria', category: 'IT', priority: 'HIGH', status: 'OPEN', description: 'PA system produces loud feedback during morning announcements in the cafeteria area. Needs audio adjustment.', locationText: 'Student Commons - Cafeteria', createdBy: 'kpatel@demo.com' },

    // Event
    { title: 'Set up chairs for graduation rehearsal', category: 'EVENT', priority: 'NORMAL', status: 'OPEN', description: 'Need 400 chairs set up in rows on the athletic field for graduation rehearsal on Friday. Setup diagram attached.', locationText: 'Athletic Complex', createdBy: 'admin@demo.com' },
    { title: 'AV setup for Spring Fundraiser Gala', category: 'EVENT', priority: 'HIGH', status: 'IN_PROGRESS', description: 'Full AV setup needed: stage lighting, wireless mics (4), projector for slideshow, background music system.', locationText: 'Performing Arts Center', assignedTo: 'kpatel@demo.com', createdBy: 'admin@demo.com' },
  ]

  for (const t of ticketData) {
    const existingTicket = await prisma.ticket.findFirst({
      where: { organizationId: orgId, title: t.title },
    })
    if (!existingTicket) {
      await prisma.ticket.create({
        data: {
          id: uid(),
          organizationId: orgId,
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          status: t.status,
          locationText: t.locationText,
          createdById: userIds[t.createdBy] || admin.id,
          assignedToId: t.assignedTo ? userIds[t.assignedTo] : null,
        },
      })
    }
  }
  console.log(`  ${ticketData.length} tickets created`)

  // ── 10. Inventory Items ─────────────────────────────────────────────────

  console.log('Creating inventory items...')

  const inventoryData = [
    { name: 'Folding Tables (6ft)', category: 'Event Equipment', quantityOnHand: 45, reorderThreshold: 10, description: 'Standard 6-foot folding tables for events and meetings.' },
    { name: 'Folding Chairs', category: 'Event Equipment', quantityOnHand: 400, reorderThreshold: 50, description: 'Metal folding chairs for assemblies and events.' },
    { name: 'Wireless Microphone Set', category: 'A/V Equipment', quantityOnHand: 8, reorderThreshold: 2, description: 'Shure wireless handheld microphone system with receiver.' },
    { name: 'Portable PA Speaker', category: 'A/V Equipment', quantityOnHand: 4, reorderThreshold: 1, description: 'JBL EON710 powered portable speakers for outdoor events.' },
    { name: 'HDMI Cables (15ft)', category: 'A/V Equipment', quantityOnHand: 25, reorderThreshold: 5, description: '15-foot HDMI cables for projector connections.' },
    { name: 'Extension Cords (50ft)', category: 'Facilities', quantityOnHand: 20, reorderThreshold: 5, description: 'Heavy-duty 50-foot outdoor-rated extension cords.' },
    { name: 'Safety Cones', category: 'Facilities', quantityOnHand: 30, reorderThreshold: 10, description: 'Orange traffic/safety cones for parking and event management.' },
    { name: 'Pop-Up Canopy (10x10)', category: 'Event Equipment', quantityOnHand: 12, reorderThreshold: 2, description: '10x10 instant canopy tents for outdoor events.' },
    { name: 'Projector - Portable', category: 'A/V Equipment', quantityOnHand: 6, reorderThreshold: 1, description: 'Epson portable projectors for classroom and meeting use.' },
    { name: 'First Aid Kit', category: 'Safety', quantityOnHand: 15, reorderThreshold: 3, description: 'Comprehensive first aid kits stationed across all campuses.' },
    { name: 'Student Chromebook', category: 'IT Equipment', quantityOnHand: 850, reorderThreshold: 20, description: 'Lenovo 300e Chromebook for 1:1 student program.' },
    { name: 'Teacher Laptop', category: 'IT Equipment', quantityOnHand: 95, reorderThreshold: 5, description: 'Dell Latitude 5540 laptops for instructional staff.' },
    { name: 'Walkie-Talkie Set', category: 'Security', quantityOnHand: 16, reorderThreshold: 2, description: 'Motorola two-way radios for campus security and event coordination.' },
    { name: 'Stage Lighting Kit', category: 'A/V Equipment', quantityOnHand: 2, reorderThreshold: 0, description: 'Portable LED stage lighting kit for performing arts events.' },
  ]

  for (const item of inventoryData) {
    const existingItem = await prisma.inventoryItem.findFirst({
      where: { organizationId: orgId, name: item.name },
    })
    if (!existingItem) {
      await prisma.inventoryItem.create({
        data: {
          id: uid(),
          organizationId: orgId,
          ...item,
          allowCheckout: true,
        },
      })
    }
  }
  console.log(`  ${inventoryData.length} inventory items created`)

  // ── Done ────────────────────────────────────────────────────────────────

  console.log('\n--- Demo Content Seeded Successfully ---')
  console.log('\nSchools: River Springs Elementary, Middle School, High School')
  console.log('Campuses: Elementary Campus, Middle School Campus, Main Campus')
  console.log(`Buildings: ${buildingData.length}`)
  console.log(`Users: ${userData.length + 1} (password: test123)`)
  console.log(`Calendars: ${calendarData.length}`)
  console.log(`Events: ${eventCount}`)
  console.log(`Event Projects: ${projectData.length}`)
  console.log(`Tickets: ${ticketData.length}`)
  console.log(`Inventory: ${inventoryData.length}`)
  console.log('')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
