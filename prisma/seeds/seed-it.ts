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
import type { ITIssueType, ITPasswordSubType, ITAVSubType, ITTicketStatus, ITPriority, ITDeviceType, ITDeviceStatus, StudentStatus } from '@prisma/client'

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

  const ticketTemplates: {
    issueType: ITIssueType
    passwordSubType?: ITPasswordSubType
    avSubType?: ITAVSubType
    title: string
    priority: ITPriority
    status: ITTicketStatus
  }[] = [
    { issueType: 'ACCOUNT_PASSWORD', passwordSubType: 'RESET', title: 'Student forgot password — Room 204', priority: 'MEDIUM', status: 'TODO' },
    { issueType: 'HARDWARE', title: 'Chromebook screen cracked — 3rd grade', priority: 'HIGH', status: 'IN_PROGRESS' },
    { issueType: 'SOFTWARE', title: 'Projector not connecting to laptop in gym', priority: 'MEDIUM', status: 'BACKLOG' },
    { issueType: 'NETWORK', title: 'WiFi dropping in Building B classrooms', priority: 'URGENT', status: 'IN_PROGRESS' },
    { issueType: 'DISPLAY_AV', avSubType: 'SOUNDBOARD', title: 'Microphone feedback during assembly', priority: 'HIGH', status: 'TODO' },
    { issueType: 'ACCOUNT_PASSWORD', passwordSubType: 'NEW_ACCOUNT', title: 'New teacher needs Google Workspace account', priority: 'MEDIUM', status: 'DONE' },
    { issueType: 'HARDWARE', title: 'Main office printer paper jam — won\'t clear', priority: 'LOW', status: 'BACKLOG' },
    { issueType: 'HARDWARE', title: 'Charging cart not working in Library', priority: 'HIGH', status: 'TODO' },
  ]

  // Get or create counter
  let counter = await prisma.iTTicketCounter.findFirst({ where: { organizationId: orgId } })
  if (!counter) {
    counter = await prisma.iTTicketCounter.create({
      data: { organizationId: orgId, lastTicketNumber: 0 },
    })
  }

  for (const t of ticketTemplates) {
    counter = await prisma.iTTicketCounter.update({
      where: { id: counter.id },
      data: { lastTicketNumber: { increment: 1 } },
    })

    const ticket = await prisma.iTTicket.create({
      data: {
        organizationId: orgId,
        ticketNumber: `IT-${String(counter.lastTicketNumber).padStart(4, '0')}`,
        issueType: t.issueType,
        passwordSubType: t.passwordSubType ?? null,
        avSubType: t.avSubType ?? null,
        title: t.title,
        priority: t.priority,
        status: t.status,
        submittedById: teacher.id,
        ...(t.status === 'IN_PROGRESS' || t.status === 'DONE' ? { assignedToId: itCoordinator.id } : {}),
        ...(school ? { schoolId: school.id } : {}),
        ...(building ? { buildingId: building.id } : {}),
      },
    })
    console.log(`  Ticket: ${ticket.ticketNumber} — ${ticket.title}`)
  }

  // Create sample devices
  logSection('Creating IT devices')

  let deviceCounter = await prisma.iTDeviceCounter.findFirst({ where: { organizationId: orgId } })
  if (!deviceCounter) {
    deviceCounter = await prisma.iTDeviceCounter.create({
      data: { organizationId: orgId, lastDeviceNumber: 0 },
    })
  }

  const deviceTemplates: { type: ITDeviceType; make: string; model: string; status: ITDeviceStatus }[] = [
    { type: 'CHROMEBOOK', make: 'Lenovo', model: '300e Gen 3', status: 'ACTIVE' },
    { type: 'CHROMEBOOK', make: 'Dell', model: 'Chromebook 3100', status: 'ACTIVE' },
    { type: 'CHROMEBOOK', make: 'HP', model: 'Chromebook 11 G9', status: 'REPAIR' },
    { type: 'TABLET', make: 'Apple', model: 'iPad 10th Gen', status: 'ACTIVE' },
    { type: 'LAPTOP', make: 'Dell', model: 'Latitude 3420', status: 'ACTIVE' },
    { type: 'DESKTOP', make: 'HP', model: 'ProDesk 400 G7', status: 'ACTIVE' },
    { type: 'CHROMEBOOK', make: 'Acer', model: 'Chromebook Spin 511', status: 'LOANER' },
    { type: 'CHROMEBOOK', make: 'Lenovo', model: '500e Gen 3', status: 'RETIRED' },
  ]

  for (const d of deviceTemplates) {
    deviceCounter = await prisma.iTDeviceCounter.update({
      where: { id: deviceCounter.id },
      data: { lastDeviceNumber: { increment: 1 } },
    })

    const device = await prisma.iTDevice.create({
      data: {
        organizationId: orgId,
        assetTag: `DEV-${String(deviceCounter.lastDeviceNumber).padStart(4, '0')}`,
        serialNumber: `SN${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        deviceType: d.type,
        make: d.make,
        model: d.model,
        status: d.status,
        purchaseDate: new Date(`2023-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-15`),
        ...(school ? { schoolId: school.id } : {}),
      },
    })
    console.log(`  Device: ${device.assetTag} — ${device.make} ${device.model}`)
  }

  // Create sample students
  logSection('Creating students')

  const studentNames: { firstName: string; lastName: string; grade: string }[] = [
    { firstName: 'Emma', lastName: 'Wilson', grade: '3' },
    { firstName: 'Liam', lastName: 'Garcia', grade: '5' },
    { firstName: 'Olivia', lastName: 'Martinez', grade: '4' },
    { firstName: 'Noah', lastName: 'Anderson', grade: '3' },
    { firstName: 'Sophia', lastName: 'Thomas', grade: '6' },
  ]

  for (const s of studentNames) {
    const studentStatus: StudentStatus = 'ACTIVE'
    const student = await prisma.student.create({
      data: {
        organizationId: orgId,
        firstName: s.firstName,
        lastName: s.lastName,
        studentId: `STU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        grade: s.grade,
        ...(school ? { schoolId: school.id } : {}),
        status: studentStatus,
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
