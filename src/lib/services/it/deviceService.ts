/**
 * IT Device Management Service
 *
 * Core business logic for the IT device inventory lifecycle:
 * - Device creation with auto-generated DEV-XXXX asset tags
 * - Filterable device listing with pagination
 * - Device assignment/unassignment to students and users
 * - Repair history tracking
 * - Bulk import for fleet onboarding
 */

import { z } from 'zod'
import { rawPrisma, prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const CreateDeviceSchema = z.object({
  serialNumber: z.string().optional(),
  deviceType: z.enum(['CHROMEBOOK', 'LAPTOP', 'TABLET', 'DESKTOP', 'MONITOR', 'PRINTER', 'OTHER']).default('CHROMEBOOK'),
  make: z.string().optional(),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  osVersion: z.string().optional(),
  status: z.enum(['ACTIVE', 'REPAIR', 'LOANER', 'RETIRED', 'LOST', 'DECOMMISSIONED']).default('ACTIVE'),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().optional(),
  warrantyExpiry: z.string().optional(),
  schoolId: z.string().optional(),
  buildingId: z.string().optional(),
  roomId: z.string().optional(),
  notes: z.string().optional(),
  photos: z.array(z.string()).max(5).default([]),
})

export const UpdateDeviceSchema = CreateDeviceSchema.partial()

export const CreateRepairSchema = z.object({
  deviceId: z.string(),
  ticketId: z.string().optional(),
  repairDate: z.string().optional(),
  repairCost: z.number().default(0),
  description: z.string().optional(),
  partsUsed: z.string().optional(),
  repairType: z.string().optional(),
  vendor: z.string().optional(),
})

export const BulkImportSchema = z.object({
  devices: z.array(z.object({
    serialNumber: z.string().optional(),
    deviceType: z.enum(['CHROMEBOOK', 'LAPTOP', 'TABLET', 'DESKTOP', 'MONITOR', 'PRINTER', 'OTHER']).default('CHROMEBOOK'),
    make: z.string().optional(),
    model: z.string().optional(),
    status: z.enum(['ACTIVE', 'REPAIR', 'LOANER', 'RETIRED', 'LOST', 'DECOMMISSIONED']).default('ACTIVE'),
    purchaseDate: z.string().optional(),
    purchasePrice: z.number().optional(),
    schoolId: z.string().optional(),
    notes: z.string().optional(),
  })).min(1).max(500),
})

// ─── Asset Tag Generator ────────────────────────────────────────────────────

export async function generateAssetTag(orgId: string): Promise<string> {
  const counter = await rawPrisma.iTDeviceCounter.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, lastDeviceNumber: 1 },
    update: { lastDeviceNumber: { increment: 1 } },
  })
  return `DEV-${String(counter.lastDeviceNumber).padStart(4, '0')}`
}

// ─── Create Device ──────────────────────────────────────────────────────────

export async function createDevice(
  input: z.infer<typeof CreateDeviceSchema>,
  orgId: string
) {
  const assetTag = await generateAssetTag(orgId)

  const device = await (prisma.iTDevice.create as Function)({
    data: {
      assetTag,
      serialNumber: input.serialNumber || null,
      deviceType: input.deviceType,
      make: input.make || null,
      model: input.model || null,
      manufacturer: input.manufacturer || null,
      osVersion: input.osVersion || null,
      status: input.status,
      purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
      purchasePrice: input.purchasePrice ?? null,
      warrantyExpiry: input.warrantyExpiry ? new Date(input.warrantyExpiry) : null,
      schoolId: input.schoolId || null,
      buildingId: input.buildingId || null,
      roomId: input.roomId || null,
      notes: input.notes || null,
      photos: input.photos,
    },
    include: {
      school: { select: { id: true, name: true } },
      building: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true, displayName: true } },
    },
  })

  return device
}

// ─── Update Device ──────────────────────────────────────────────────────────

export async function updateDevice(
  id: string,
  input: z.infer<typeof UpdateDeviceSchema>
) {
  const data: Record<string, unknown> = {}

  if (input.serialNumber !== undefined) data.serialNumber = input.serialNumber || null
  if (input.deviceType !== undefined) data.deviceType = input.deviceType
  if (input.make !== undefined) data.make = input.make || null
  if (input.model !== undefined) data.model = input.model || null
  if (input.manufacturer !== undefined) data.manufacturer = input.manufacturer || null
  if (input.osVersion !== undefined) data.osVersion = input.osVersion || null
  if (input.status !== undefined) data.status = input.status
  if (input.purchaseDate !== undefined) data.purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : null
  if (input.purchasePrice !== undefined) data.purchasePrice = input.purchasePrice ?? null
  if (input.warrantyExpiry !== undefined) data.warrantyExpiry = input.warrantyExpiry ? new Date(input.warrantyExpiry) : null
  if (input.schoolId !== undefined) data.schoolId = input.schoolId || null
  if (input.buildingId !== undefined) data.buildingId = input.buildingId || null
  if (input.roomId !== undefined) data.roomId = input.roomId || null
  if (input.notes !== undefined) data.notes = input.notes || null
  if (input.photos !== undefined) data.photos = input.photos

  const device = await prisma.iTDevice.update({
    where: { id },
    data,
    include: {
      school: { select: { id: true, name: true } },
      building: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true, displayName: true } },
    },
  })

  return device
}

// ─── Delete Device (Soft-Delete) ────────────────────────────────────────────

export async function deleteDevice(id: string) {
  return prisma.iTDevice.delete({ where: { id } })
}

// ─── List Devices ───────────────────────────────────────────────────────────

interface ListDevicesInput {
  deviceType?: string
  status?: string
  schoolId?: string
  search?: string
  isLemon?: boolean
  limit?: number
  offset?: number
}

export async function listDevices(
  filters: ListDevicesInput,
  context: { userId: string; orgId: string }
) {
  const where: Record<string, unknown> = {}

  if (filters.deviceType) where.deviceType = filters.deviceType
  if (filters.status) where.status = filters.status
  if (filters.schoolId) where.schoolId = filters.schoolId
  if (filters.isLemon !== undefined) where.isLemon = filters.isLemon
  if (filters.search) {
    where.OR = [
      { assetTag: { contains: filters.search, mode: 'insensitive' } },
      { serialNumber: { contains: filters.search, mode: 'insensitive' } },
      { make: { contains: filters.search, mode: 'insensitive' } },
      { model: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  const [devices, total] = await Promise.all([
    prisma.iTDevice.findMany({
      where,
      include: {
        school: { select: { id: true, name: true } },
        building: { select: { id: true, name: true } },
        room: { select: { id: true, roomNumber: true, displayName: true } },
        assignments: {
          where: { returnedAt: null },
          take: 1,
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
      take: filters.limit || 50,
      skip: filters.offset || 0,
    }),
    prisma.iTDevice.count({ where }),
  ])

  // Flatten current assignment from array to single object
  const devicesWithAssignment = devices.map((d: Record<string, unknown>) => {
    const assignments = d.assignments as Array<Record<string, unknown>>
    return {
      ...d,
      currentAssignment: assignments?.[0] || null,
      assignments: undefined,
    }
  })

  return { devices: devicesWithAssignment, total }
}

// ─── Get Device Detail ──────────────────────────────────────────────────────

export async function getDeviceDetail(id: string) {
  const device = await prisma.iTDevice.findUnique({
    where: { id },
    include: {
      school: { select: { id: true, name: true } },
      building: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true, displayName: true } },
      assignments: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { assignedAt: 'desc' as const },
      },
      repairs: {
        orderBy: { repairDate: 'desc' as const },
      },
    },
  })

  if (!device) return null

  // Separate current assignment from history
  const allAssignments = (device as Record<string, unknown>).assignments as Array<Record<string, unknown>>
  const currentAssignment = allAssignments?.find((a) => !a.returnedAt) || null
  const assignmentHistory = allAssignments || []

  return {
    ...device,
    currentAssignment,
    assignmentHistory,
  }
}

// ─── Assign Device ──────────────────────────────────────────────────────────

export async function assignDevice(
  deviceId: string,
  data: {
    studentId?: string
    userId?: string
    assignedById: string
    notes?: string
  }
) {
  // Check for existing active assignment
  const existing = await prisma.iTDeviceAssignment.findFirst({
    where: { deviceId, returnedAt: null },
  })
  if (existing) {
    throw new Error('DEVICE_ALREADY_ASSIGNED: This device has an active assignment. Unassign it first.')
  }

  const assignment = await (prisma.iTDeviceAssignment.create as Function)({
    data: {
      deviceId,
      studentId: data.studentId || null,
      userId: data.userId || null,
      assignedById: data.assignedById,
      notes: data.notes || null,
    },
    include: {
      device: { select: { id: true, assetTag: true, make: true, model: true } },
      student: { select: { id: true, firstName: true, lastName: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  return assignment
}

// ─── Unassign Device ────────────────────────────────────────────────────────

export async function unassignDevice(deviceId: string, userId: string) {
  const activeAssignment = await prisma.iTDeviceAssignment.findFirst({
    where: { deviceId, returnedAt: null },
  })

  if (!activeAssignment) {
    throw new Error('NO_ACTIVE_ASSIGNMENT: No active assignment found for this device.')
  }

  const updated = await prisma.iTDeviceAssignment.update({
    where: { id: activeAssignment.id },
    data: { returnedAt: new Date() },
    include: {
      device: { select: { id: true, assetTag: true, make: true, model: true } },
      student: { select: { id: true, firstName: true, lastName: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  return updated
}

// ─── Get Device History ─────────────────────────────────────────────────────

export async function getDeviceHistory(deviceId: string) {
  const [assignments, repairs] = await Promise.all([
    prisma.iTDeviceAssignment.findMany({
      where: { deviceId },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.iTDeviceRepair.findMany({
      where: { deviceId },
      orderBy: { repairDate: 'desc' },
    }),
  ])

  // Merge and sort by date descending
  const history = [
    ...assignments.map((a: Record<string, unknown>) => ({
      type: 'assignment' as const,
      date: a.assignedAt as Date,
      data: a,
    })),
    ...repairs.map((r: Record<string, unknown>) => ({
      type: 'repair' as const,
      date: r.repairDate as Date,
      data: r,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return history
}

// ─── Create Repair ──────────────────────────────────────────────────────────

export async function createRepair(input: z.infer<typeof CreateRepairSchema>) {
  const repair = await (prisma.iTDeviceRepair.create as Function)({
    data: {
      deviceId: input.deviceId,
      ticketId: input.ticketId || null,
      repairDate: input.repairDate ? new Date(input.repairDate) : new Date(),
      repairCost: input.repairCost,
      description: input.description || null,
      partsUsed: input.partsUsed || null,
      repairType: input.repairType || null,
      vendor: input.vendor || null,
    },
    include: {
      device: { select: { id: true, assetTag: true, make: true, model: true } },
    },
  })

  return repair
}

// ─── List Repairs ───────────────────────────────────────────────────────────

export async function listRepairs(deviceId: string) {
  const repairs = await prisma.iTDeviceRepair.findMany({
    where: { deviceId },
    include: {
      device: { select: { id: true, assetTag: true, make: true, model: true } },
    },
    orderBy: { repairDate: 'desc' },
  })

  return repairs
}

// ─── Bulk Import Devices ────────────────────────────────────────────────────

export async function bulkImportDevices(
  input: z.infer<typeof BulkImportSchema>,
  orgId: string
) {
  let created = 0
  const errors: string[] = []

  for (let i = 0; i < input.devices.length; i++) {
    const deviceInput = input.devices[i]
    try {
      const assetTag = await generateAssetTag(orgId)

      await (prisma.iTDevice.create as Function)({
        data: {
          assetTag,
          serialNumber: deviceInput.serialNumber || null,
          deviceType: deviceInput.deviceType,
          make: deviceInput.make || null,
          model: deviceInput.model || null,
          status: deviceInput.status,
          purchaseDate: deviceInput.purchaseDate ? new Date(deviceInput.purchaseDate) : null,
          purchasePrice: deviceInput.purchasePrice ?? null,
          schoolId: deviceInput.schoolId || null,
          notes: deviceInput.notes || null,
        },
      })

      created++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push(`Row ${i + 1}: ${message}`)
    }
  }

  return { created, errors }
}
