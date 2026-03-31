/**
 * Maintenance Module Seed — creates sample work orders and assets.
 *
 * Usage: npm run db:seed:maintenance
 */

import {
  prisma,
  getDefaultOrg,
  getAdminUser,
  getOrCreateUser,
  getDefaultCampus,
  getDefaultBuilding,
  logSection,
} from './shared'
import type { MaintenanceCategory, MaintenancePriority, MaintenanceTicketStatus, MaintenanceSpecialty } from '@prisma/client'

async function main() {
  const org = await getDefaultOrg()
  const admin = await getAdminUser(org.id)
  const campus = await getDefaultCampus(org.id)
  const building = await getDefaultBuilding(org.id)
  const orgId = org.id

  // Create maintenance technician
  logSection('Creating maintenance users')

  const tech = await getOrCreateUser(orgId, 'maintenance@school.edu', {
    firstName: 'Mike',
    lastName: 'Maintenance',
    roleSlug: 'admin',
  })
  console.log(`  Technician: ${tech.email}`)

  // Create maintenance assets
  logSection('Creating maintenance assets')

  const assetTemplates = [
    { name: 'Main HVAC Unit — Building A', category: 'HVAC', status: 'OPERATIONAL', serialNumber: 'HVAC-001' },
    { name: 'Gymnasium Lighting Array', category: 'ELECTRICAL', status: 'OPERATIONAL', serialNumber: 'ELEC-001' },
    { name: 'Cafeteria Walk-in Cooler', category: 'PLUMBING', status: 'NEEDS_REPAIR', serialNumber: 'PLMB-001' },
    { name: 'Parking Lot Gate Motor', category: 'GENERAL', status: 'OPERATIONAL', serialNumber: 'GEN-001' },
    { name: 'Fire Alarm Panel — Admin', category: 'FIRE_SAFETY', status: 'OPERATIONAL', serialNumber: 'FIRE-001' },
  ]

  // Get or create asset counter
  let counter = await prisma.maintenanceAssetCounter.findFirst({ where: { organizationId: orgId } })
  if (!counter) {
    counter = await prisma.maintenanceAssetCounter.create({
      data: { organizationId: orgId, lastAssetNumber: 0 },
    })
  }

  for (const a of assetTemplates) {
    counter = await prisma.maintenanceAssetCounter.update({
      where: { id: counter.id },
      data: { lastAssetNumber: { increment: 1 } },
    })

    const asset = await prisma.maintenanceAsset.create({
      data: {
        organizationId: orgId,
        assetNumber: `ASSET-${String(counter.lastAssetNumber).padStart(4, '0')}`,
        name: a.name,
        category: a.category,
        status: a.status,
        serialNumber: a.serialNumber,
        ...(building ? { buildingId: building.id } : {}),
      },
    })
    console.log(`  Asset: ${asset.assetNumber} — ${asset.name}`)
  }

  // Create maintenance tickets (work orders)
  logSection('Creating maintenance work orders')

  let ticketCounter = await prisma.maintenanceCounter.findFirst({ where: { organizationId: orgId } })
  if (!ticketCounter) {
    ticketCounter = await prisma.maintenanceCounter.create({
      data: { organizationId: orgId, lastTicketNumber: 0 },
    })
  }

  const workOrders: {
    title: string
    category: MaintenanceCategory
    specialty: MaintenanceSpecialty
    priority: MaintenancePriority
    status: MaintenanceTicketStatus
  }[] = [
    { title: 'Leaking faucet in staff restroom', category: 'PLUMBING', specialty: 'PLUMBING', priority: 'MEDIUM', status: 'BACKLOG' },
    { title: 'Broken window latch — Room 102', category: 'STRUCTURAL', specialty: 'OTHER', priority: 'LOW', status: 'BACKLOG' },
    { title: 'HVAC making loud noise — Library', category: 'HVAC', specialty: 'HVAC', priority: 'HIGH', status: 'IN_PROGRESS' },
    { title: 'Flickering lights in hallway B', category: 'ELECTRICAL', specialty: 'ELECTRICAL', priority: 'MEDIUM', status: 'IN_PROGRESS' },
    { title: 'Playground fence repair needed', category: 'GROUNDS', specialty: 'GROUNDS', priority: 'HIGH', status: 'BACKLOG' },
    { title: 'Fire extinguisher expired — Gym', category: 'OTHER', specialty: 'OTHER', priority: 'URGENT', status: 'BACKLOG' },
    { title: 'Door lock stuck — Main entrance', category: 'STRUCTURAL', specialty: 'OTHER', priority: 'HIGH', status: 'DONE' },
    { title: 'Parking lot pothole', category: 'GROUNDS', specialty: 'GROUNDS', priority: 'MEDIUM', status: 'BACKLOG' },
  ]

  for (const wo of workOrders) {
    ticketCounter = await prisma.maintenanceCounter.update({
      where: { id: ticketCounter.id },
      data: { lastTicketNumber: { increment: 1 } },
    })

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        organizationId: orgId,
        ticketNumber: `WO-${String(ticketCounter.lastTicketNumber).padStart(4, '0')}`,
        title: wo.title,
        category: wo.category,
        specialty: wo.specialty,
        priority: wo.priority,
        status: wo.status,
        submittedById: admin.id,
        ...(wo.status === 'IN_PROGRESS' || wo.status === 'DONE'
          ? { assignedToId: tech.id }
          : {}),
        ...(building ? { buildingId: building.id } : {}),
      },
    })
    console.log(`  Work Order: ${ticket.ticketNumber} — ${ticket.title}`)
  }

  logSection('Maintenance seed complete')
}

main()
  .catch((e) => {
    console.error('Maintenance seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
