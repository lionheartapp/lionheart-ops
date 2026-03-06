/**
 * Maintenance Asset Service
 *
 * Core business logic for the asset register:
 * - Asset creation with auto-generated AST-XXXX numbers
 * - Filterable asset queries with building/area/room relations
 * - Soft-delete CRUD
 */

import { z } from 'zod'
import { rawPrisma, prisma } from '@/lib/db'
import type { MaintenanceTicketStatus } from '@prisma/client'

// ─── Asset Status Constants ───────────────────────────────────────────────────

export const ASSET_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  DECOMMISSIONED: 'DECOMMISSIONED',
  PENDING_DISPOSAL: 'PENDING_DISPOSAL',
} as const

export type AssetStatus = typeof ASSET_STATUS[keyof typeof ASSET_STATUS]

// ─── Asset Category Constants ─────────────────────────────────────────────────

export const ASSET_CATEGORIES = [
  'ELECTRICAL',
  'PLUMBING',
  'HVAC',
  'STRUCTURAL',
  'CUSTODIAL_BIOHAZARD',
  'IT_AV',
  'GROUNDS',
  'OTHER',
] as const

export type AssetCategory = typeof ASSET_CATEGORIES[number]

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const AssetCategoryEnum = z.enum(ASSET_CATEGORIES)

export const CreateAssetSchema = z.object({
  name: z.string().min(1).max(200),
  category: AssetCategoryEnum.optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  serialNumber: z.string().max(100).optional(),
  purchaseDate: z.string().datetime().optional().nullable(),
  warrantyExpiry: z.string().datetime().optional().nullable(),
  replacementCost: z.number().positive().optional().nullable(),
  expectedLifespanYears: z.number().int().positive().optional().nullable(),
  repairThresholdPct: z.number().min(0).max(1).default(0.5),
  photos: z.array(z.string().url()).max(5).default([]),
  notes: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DECOMMISSIONED', 'PENDING_DISPOSAL']).default('ACTIVE'),
  buildingId: z.string().optional().nullable(),
  areaId: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  schoolId: z.string().optional().nullable(),
})

export const UpdateAssetSchema = CreateAssetSchema.partial()

export type CreateAssetInput = z.infer<typeof CreateAssetSchema>
export type UpdateAssetInput = z.infer<typeof UpdateAssetSchema>

// ─── Asset Includes ───────────────────────────────────────────────────────────

const ASSET_INCLUDES = {
  building: { select: { id: true, name: true } },
  area: { select: { id: true, name: true } },
  room: { select: { id: true, roomNumber: true, displayName: true } },
  school: { select: { id: true, name: true } },
} as const

// ─── Generate Asset Number ────────────────────────────────────────────────────

export async function generateAssetNumber(orgId: string): Promise<string> {
  const result = await rawPrisma.$transaction(async (tx) => {
    const counter = await tx.maintenanceAssetCounter.upsert({
      where: { organizationId: orgId },
      update: { lastAssetNumber: { increment: 1 } },
      create: { organizationId: orgId, lastAssetNumber: 1 },
    })
    return counter.lastAssetNumber
  })
  return `AST-${String(result).padStart(4, '0')}`
}

// ─── Create Asset ─────────────────────────────────────────────────────────────

export async function createAsset(
  orgId: string,
  input: unknown
) {
  const data = CreateAssetSchema.parse(input)
  const assetNumber = await generateAssetNumber(orgId)

  const asset = await prisma.maintenanceAsset.create({
    data: {
      organizationId: orgId,
      assetNumber,
      name: data.name,
      category: data.category ?? null,
      make: data.make ?? null,
      model: data.model ?? null,
      serialNumber: data.serialNumber ?? null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : null,
      replacementCost: data.replacementCost ?? null,
      expectedLifespanYears: data.expectedLifespanYears ?? null,
      repairThresholdPct: data.repairThresholdPct,
      photos: data.photos,
      notes: data.notes ?? null,
      status: data.status,
      buildingId: data.buildingId ?? null,
      areaId: data.areaId ?? null,
      roomId: data.roomId ?? null,
      schoolId: data.schoolId ?? null,
    },
    include: ASSET_INCLUDES,
  })

  return asset
}

// ─── List Assets ──────────────────────────────────────────────────────────────

export interface AssetFilters {
  category?: string
  buildingId?: string
  areaId?: string
  roomId?: string
  status?: string
  warrantyStatus?: 'active' | 'expiring_soon' | 'expired' | 'none'
  search?: string
  sortField?: 'assetNumber' | 'name' | 'category' | 'warrantyExpiry' | 'replacementCost'
  sortDir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export async function getAssets(orgId: string, filters: AssetFilters = {}) {
  const {
    category,
    buildingId,
    areaId,
    roomId,
    status,
    warrantyStatus,
    search,
    sortField = 'assetNumber',
    sortDir = 'asc',
    page = 1,
    limit = 50,
  } = filters

  // Build where clause for org-scoped prisma (org injection is automatic)
  const where: Record<string, unknown> = {}

  if (category) where.category = category
  if (buildingId) where.buildingId = buildingId
  if (areaId) where.areaId = areaId
  if (roomId) where.roomId = roomId
  if (status) where.status = status

  // Warranty status filter
  const now = new Date()
  const soonThreshold = new Date(now)
  soonThreshold.setDate(soonThreshold.getDate() + 90) // 90 days

  if (warrantyStatus === 'active') {
    where.warrantyExpiry = { gte: soonThreshold }
  } else if (warrantyStatus === 'expiring_soon') {
    where.warrantyExpiry = { gte: now, lt: soonThreshold }
  } else if (warrantyStatus === 'expired') {
    where.warrantyExpiry = { lt: now }
  } else if (warrantyStatus === 'none') {
    where.warrantyExpiry = null
  }

  // Keyword search
  if (search) {
    const searchLower = search.toLowerCase()
    where.OR = [
      { name: { contains: searchLower, mode: 'insensitive' } },
      { assetNumber: { contains: searchLower, mode: 'insensitive' } },
      { make: { contains: searchLower, mode: 'insensitive' } },
      { model: { contains: searchLower, mode: 'insensitive' } },
      { serialNumber: { contains: searchLower, mode: 'insensitive' } },
    ]
  }

  // Sort
  const orderBy: Record<string, unknown> = {}
  const validSortFields = ['assetNumber', 'name', 'category', 'warrantyExpiry', 'replacementCost']
  const field = validSortFields.includes(sortField) ? sortField : 'assetNumber'
  orderBy[field] = sortDir === 'desc' ? 'desc' : 'asc'

  const skip = (page - 1) * limit

  const [assets, total] = await Promise.all([
    prisma.maintenanceAsset.findMany({
      where,
      include: ASSET_INCLUDES,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.maintenanceAsset.count({ where }),
  ])

  return {
    assets,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  }
}

// ─── Get Asset By ID ──────────────────────────────────────────────────────────

export async function getAssetById(orgId: string, id: string) {
  const asset = await prisma.maintenanceAsset.findFirst({
    where: { id },
    include: {
      ...ASSET_INCLUDES,
      pmSchedules: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          recurrenceType: true,
          nextDueDate: true,
          isActive: true,
        },
        orderBy: { nextDueDate: 'asc' },
      },
    },
  })

  return asset
}

// ─── Update Asset ─────────────────────────────────────────────────────────────

export async function updateAsset(orgId: string, id: string, input: unknown) {
  const data = UpdateAssetSchema.parse(input)

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.category !== undefined) updateData.category = data.category
  if (data.make !== undefined) updateData.make = data.make
  if (data.model !== undefined) updateData.model = data.model
  if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber
  if (data.purchaseDate !== undefined) {
    updateData.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null
  }
  if (data.warrantyExpiry !== undefined) {
    updateData.warrantyExpiry = data.warrantyExpiry ? new Date(data.warrantyExpiry) : null
  }
  if (data.replacementCost !== undefined) updateData.replacementCost = data.replacementCost
  if (data.expectedLifespanYears !== undefined) {
    updateData.expectedLifespanYears = data.expectedLifespanYears
  }
  if (data.repairThresholdPct !== undefined) updateData.repairThresholdPct = data.repairThresholdPct
  if (data.photos !== undefined) updateData.photos = data.photos
  if (data.notes !== undefined) updateData.notes = data.notes
  if (data.status !== undefined) updateData.status = data.status
  if (data.buildingId !== undefined) updateData.buildingId = data.buildingId
  if (data.areaId !== undefined) updateData.areaId = data.areaId
  if (data.roomId !== undefined) updateData.roomId = data.roomId
  if (data.schoolId !== undefined) updateData.schoolId = data.schoolId

  const asset = await prisma.maintenanceAsset.update({
    where: { id },
    data: updateData,
    include: ASSET_INCLUDES,
  })

  return asset
}

// ─── Get Asset With Full Details (for detail page) ────────────────────────────

export async function getAssetWithDetails(orgId: string, id: string) {
  const asset = await prisma.maintenanceAsset.findFirst({
    where: { id },
    include: {
      ...ASSET_INCLUDES,
      pmSchedules: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          recurrenceType: true,
          nextDueDate: true,
          isActive: true,
          defaultTechnicianId: true,
          defaultTechnician: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { nextDueDate: 'asc' },
      },
      tickets: {
        where: { deletedAt: null },
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          costEntries: {
            select: { amount: true },
          },
          laborEntries: {
            select: {
              durationMinutes: true,
              technician: {
                select: {
                  technicianProfile: {
                    select: { loadedHourlyRate: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { createdAt: 'desc' },
        ],
      },
    },
  })

  if (!asset) return null

  // Compute cumulative repair cost across all tickets
  let cumulativeRepairCost = 0
  for (const ticket of asset.tickets) {
    // Material / vendor costs
    for (const entry of ticket.costEntries) {
      cumulativeRepairCost += entry.amount
    }
    // Labor costs
    for (const labor of ticket.laborEntries) {
      if (labor.durationMinutes && labor.technician?.technicianProfile?.loadedHourlyRate) {
        cumulativeRepairCost += (labor.durationMinutes / 60) * labor.technician.technicianProfile.loadedHourlyRate
      }
    }
  }

  // Sort tickets: open first, then done/cancelled
  const closedStatuses: MaintenanceTicketStatus[] = ['DONE', 'CANCELLED']
  const openTickets = asset.tickets.filter(t => !closedStatuses.includes(t.status))
  const closedTickets = asset.tickets.filter(t => closedStatuses.includes(t.status))
  const ticketHistory = [...openTickets, ...closedTickets]

  return {
    ...asset,
    ticketHistory,
    pmSchedules: asset.pmSchedules,
    cumulativeRepairCost,
  }
}

export type AssetWithDetails = NonNullable<Awaited<ReturnType<typeof getAssetWithDetails>>>

// ─── Delete Asset (Soft-Delete) ───────────────────────────────────────────────

export async function deleteAsset(orgId: string, id: string) {
  // prisma.maintenanceAsset.delete is intercepted by the soft-delete extension
  // and converts to an update setting deletedAt = now()
  await prisma.maintenanceAsset.delete({
    where: { id },
  })
}
