/**
 * IT Help Desk Module Seed — creates sample IT tickets, devices, and students.
 *
 * Usage: npm run db:seed:it
 */

import {
  prisma,
  getDefaultOrg,
  getAdminUser,
  getOrCreateUser,
  getDefaultSchool,
  getDefaultBuilding,
  logSection,
} from './shared'

async function main() {
  const org = await getDefaultOrg()
  const admin = await getAdminUser(org.id)
  const school = await getDefaultSchool(org.id)
  const building = await getDefaultBuilding(org.id)
  const orgId = org.id

  // Create IT-specific users
  logSection('Creating IT users')

  const itCoordinator = await getOrCreateUser(orgId, 'it@school.edu', {
    firstName: 'Tech',
    lastName: 'Support',
    roleSlug: 'admin',
  })
  console.log(`  IT Coordinator: ${itCoordinator.email}`)

  const teacher = await getOrCreateUser(orgId, 'teacher@school.edu', {
    firstName: 'Jane',
    lastName: 'Teacher',
    roleSlug: 'member',
  })
  console.log(`  Teacher: ${teacher.email}`)

  // Create IT tickets
  logSection('Creating IT tickets')

  const ticketTemplates = [
    { issueType: 'PASSWORD_RESET', subType: 'STUDENT_PASSWORD', summary: 'Student forgot password — Room 204', priority: 'MEDIUM', status: 'TODO' },
    { issueType: 'HARDWARE', subType: null, summary: 'Chromebook screen cracked — 3rd grade', priority: 'HIGH', status: 'IN_PROGRESS' },
    { issueType: 'SOFTWARE', subType: null, summary: 'Projector not connecting to laptop in gym', priority: 'MEDIUM', status: 'BACKLOG' },
    { issueType: 'NETWORK', subType: null, summary: 'WiFi dropping in Building B classrooms', priority: 'URGENT', status: 'IN_PROGRESS' },
    { issueType: 'AV_EQUIPMENT', subType: 'SOUND_SYSTEM', summary: 'Microphone feedback during assembly', priority: 'HIGH', status: 'TODO' },
    { issueType: 'ACCOUNT_ACCESS', subType: null, summary: 'New teacher needs Google Workspace account', priority: 'MEDIUM', status: 'DONE' },
    { issueType: 'PRINTER', subType: null, summary: 'Main office printer paper jam — won\'t clear', priority: 'LOW', status: 'BACKLOG' },
    { issueType: 'HARDWARE', subType: null, summary: 'Charging cart not working in Library', priority: 'HIGH', status: 'TODO' },
  ]

  // Get or create counter
  let counter = await prisma.iTTicketCounter.findFirst({ where: { organizationId: orgId } })
  if (!counter) {
    counter = await prisma.iTTicketCounter.create({
      data: { organizationId: orgId, lastNumber: 0 },
    })
  }

  for (const t of ticketTemplates) {
    counter = await prisma.iTTicketCounter.update({
      where: { id: counter.id },
      data: { lastNumber: { increment: 1 } },
    })

    const ticket = await prisma.iTTicket.create({
      data: {
        organizationId: orgId,
        ticketNumber: `IT-${String(counter.lastNumber).padStart(4, '0')}`,
        issueType: t.issueType as any,
        subType: t.subType,
        summary: t.summary,
        priority: t.priority as any,
        status: t.status as any,
        submittedById: teacher.id,
        ...(t.status === 'IN_PROGRESS' || t.status === 'DONE' ? { assignedToId: itCoordinator.id } : {}),
        ...(school ? { schoolId: school.id } : {}),
        ...(building ? { buildingId: building.id } : {}),
      },
    })
    console.log(`  Ticket: ${ticket.ticketNumber} — ${ticket.summary}`)
  }

  // Create sample devices
  logSection('Creating IT devices')

  let deviceCounter = await prisma.iTDeviceCounter.findFirst({ where: { organizationId: orgId } })
  if (!deviceCounter) {
    deviceCounter = await prisma.iTDeviceCounter.create({
      data: { organizationId: orgId, lastNumber: 0 },
    })
  }

  const deviceTemplates = [
    { type: 'CHROMEBOOK', make: 'Lenovo', model: '300e Gen 3', status: 'ACTIVE' },
    { type: 'CHROMEBOOK', make: 'Dell', model: 'Chromebook 3100', status: 'ACTIVE' },
    { type: 'CHROMEBOOK', make: 'HP', model: 'Chromebook 11 G9', status: 'REPAIR' },
    { type: 'IPAD', make: 'Apple', model: 'iPad 10th Gen', status: 'ACTIVE' },
    { type: 'LAPTOP', make: 'Dell', model: 'Latitude 3420', status: 'ACTIVE' },
    { type: 'DESKTOP', make: 'HP', model: 'ProDesk 400 G7', status: 'ACTIVE' },
    { type: 'CHROMEBOOK', make: 'Acer', model: 'Chromebook Spin 511', status: 'LOANER' },
    { type: 'CHROMEBOOK', make: 'Lenovo', model: '500e Gen 3', status: 'RETIRED' },
  ]

  for (const d of deviceTemplates) {
    deviceCounter = await prisma.iTDeviceCounter.update({
      where: { id: deviceCounter.id },
      data: { lastNumber: { increment: 1 } },
    })

    const device = await prisma.iTDevice.create({
      data: {
        organizationId: orgId,
        assetTag: `DEV-${String(deviceCounter.lastNumber).padStart(4, '0')}`,
        serialNumber: `SN${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        deviceType: d.type as any,
        make: d.make,
        model: d.model,
        status: d.status as any,
        purchaseDate: new Date(`2023-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-15`),
        ...(school ? { schoolId: school.id } : {}),
      },
    })
    console.log(`  Device: ${device.assetTag} — ${device.make} ${device.model}`)
  }

  // Create sample students
  logSection('Creating students')

  const studentNames = [
    { firstName: 'Emma', lastName: 'Wilson', grade: '3' },
    { firstName: 'Liam', lastName: 'Garcia', grade: '5' },
    { firstName: 'Olivia', lastName: 'Martinez', grade: '4' },
    { firstName: 'Noah', lastName: 'Anderson', grade: '3' },
    { firstName: 'Sophia', lastName: 'Thomas', grade: '6' },
  ]

  for (const s of studentNames) {
    const student = await prisma.student.create({
      data: {
        organizationId: orgId,
        firstName: s.firstName,
        lastName: s.lastName,
        studentId: `STU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        grade: s.grade,
        ...(school ? { schoolId: school.id } : {}),
        status: 'ACTIVE',
      },
    })
    console.log(`  Student: ${student.firstName} ${student.lastName} (${student.studentId})`)
  }

  logSection('IT seed complete')
}

main()
  .catch((e) => {
    console.error('IT seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
