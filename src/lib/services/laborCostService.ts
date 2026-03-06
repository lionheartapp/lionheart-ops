/**
 * Labor & Cost Service
 *
 * Tracks labor time and material/vendor costs for maintenance tickets.
 * Labor cost is auto-computed from duration × technician's loaded hourly rate.
 * Material costs record vendor, description, amount, and optional receipt photo.
 *
 * This data feeds Phase 5 analytics and Phase 6 FCI calculations.
 */

import { z } from 'zod'
import { rawPrisma } from '@/lib/db'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const CreateLaborEntrySchema = z.object({
  technicianId: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  notes: z.string().optional(),
})

export const UpdateLaborEntrySchema = z.object({
  endTime: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
  notes: z.string().optional(),
})

export const CreateCostEntrySchema = z.object({
  vendor: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  receiptUrl: z.string().url().optional(),
})

export const UpdateCostEntrySchema = z.object({
  vendor: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  receiptUrl: z.string().url().optional().nullable(),
})

export type CreateLaborEntryInput = z.infer<typeof CreateLaborEntrySchema>
export type UpdateLaborEntryInput = z.infer<typeof UpdateLaborEntrySchema>
export type CreateCostEntryInput = z.infer<typeof CreateCostEntrySchema>
export type UpdateCostEntryInput = z.infer<typeof UpdateCostEntrySchema>

// ─── Labor Entries ────────────────────────────────────────────────────────────

/**
 * Create a new labor entry for a ticket.
 * If both startTime and endTime are provided, durationMinutes is computed automatically.
 */
export async function createLaborEntry(
  orgId: string,
  ticketId: string,
  data: unknown
) {
  const parsed = CreateLaborEntrySchema.parse(data)

  // Compute duration from start/end if both provided
  let durationMinutes = parsed.durationMinutes
  if (parsed.startTime && parsed.endTime) {
    const start = new Date(parsed.startTime)
    const end = new Date(parsed.endTime)
    durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
    if (durationMinutes < 0) {
      throw new Error('VALIDATION_ERROR: endTime must be after startTime')
    }
  }

  return rawPrisma.maintenanceLaborEntry.create({
    data: {
      organizationId: orgId,
      ticketId,
      technicianId: parsed.technicianId,
      startTime: new Date(parsed.startTime),
      endTime: parsed.endTime ? new Date(parsed.endTime) : undefined,
      durationMinutes,
      notes: parsed.notes,
    },
    include: {
      technician: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          technicianProfile: { select: { loadedHourlyRate: true } },
        },
      },
    },
  })
}

/**
 * List all labor entries for a ticket, ordered by startTime desc.
 * Includes technician name and loaded hourly rate for cost computation.
 */
export async function getLaborEntries(ticketId: string) {
  const entries = await rawPrisma.maintenanceLaborEntry.findMany({
    where: { ticketId },
    include: {
      technician: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          technicianProfile: { select: { loadedHourlyRate: true } },
        },
      },
    },
    orderBy: { startTime: 'desc' },
  })

  // Enrich each entry with computed labor cost
  return entries.map((e) => {
    const rate = e.technician.technicianProfile?.loadedHourlyRate ?? null
    const hours = e.durationMinutes != null ? e.durationMinutes / 60 : null
    const laborCost = rate != null && hours != null ? rate * hours : null
    return { ...e, laborCost }
  })
}

/**
 * Update a labor entry (partial: end time, notes).
 * Re-computes durationMinutes if both startTime and new endTime are available.
 */
export async function updateLaborEntry(
  orgId: string,
  entryId: string,
  data: unknown
) {
  const parsed = UpdateLaborEntrySchema.parse(data)

  const existing = await rawPrisma.maintenanceLaborEntry.findFirst({
    where: { id: entryId, organizationId: orgId },
  })
  if (!existing) throw new Error('NOT_FOUND')

  const updateData: Record<string, unknown> = {}
  if (parsed.notes !== undefined) updateData.notes = parsed.notes

  // Recompute duration if endTime is being updated
  if (parsed.endTime !== undefined) {
    updateData.endTime = new Date(parsed.endTime)
    const end = new Date(parsed.endTime)
    const start = existing.startTime
    const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
    if (minutes < 0) throw new Error('VALIDATION_ERROR: endTime must be after startTime')
    updateData.durationMinutes = minutes
  } else if (parsed.durationMinutes !== undefined) {
    updateData.durationMinutes = parsed.durationMinutes
  }

  return rawPrisma.maintenanceLaborEntry.update({
    where: { id: entryId },
    data: updateData as any,
    include: {
      technician: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          technicianProfile: { select: { loadedHourlyRate: true } },
        },
      },
    },
  })
}

/**
 * Hard-delete a labor entry (no soft-delete for labor entries).
 */
export async function deleteLaborEntry(orgId: string, entryId: string) {
  const existing = await rawPrisma.maintenanceLaborEntry.findFirst({
    where: { id: entryId, organizationId: orgId },
  })
  if (!existing) throw new Error('NOT_FOUND')

  await rawPrisma.maintenanceLaborEntry.delete({ where: { id: entryId } })
}

// ─── Cost Entries ─────────────────────────────────────────────────────────────

/**
 * Create a new cost entry for a ticket.
 */
export async function createCostEntry(
  orgId: string,
  ticketId: string,
  createdById: string,
  data: unknown
) {
  const parsed = CreateCostEntrySchema.parse(data)

  return rawPrisma.maintenanceCostEntry.create({
    data: {
      organizationId: orgId,
      ticketId,
      createdById,
      vendor: parsed.vendor,
      description: parsed.description,
      amount: parsed.amount,
      receiptUrl: parsed.receiptUrl,
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })
}

/**
 * List all cost entries for a ticket, ordered by createdAt desc.
 */
export async function getCostEntries(ticketId: string) {
  return rawPrisma.maintenanceCostEntry.findMany({
    where: { ticketId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Update a cost entry (partial update).
 */
export async function updateCostEntry(
  orgId: string,
  entryId: string,
  data: unknown
) {
  const parsed = UpdateCostEntrySchema.parse(data)

  const existing = await rawPrisma.maintenanceCostEntry.findFirst({
    where: { id: entryId, organizationId: orgId },
  })
  if (!existing) throw new Error('NOT_FOUND')

  const updateData: Record<string, unknown> = {}
  if (parsed.vendor !== undefined) updateData.vendor = parsed.vendor
  if (parsed.description !== undefined) updateData.description = parsed.description
  if (parsed.amount !== undefined) updateData.amount = parsed.amount
  if (parsed.receiptUrl !== undefined) updateData.receiptUrl = parsed.receiptUrl

  return rawPrisma.maintenanceCostEntry.update({
    where: { id: entryId },
    data: updateData as any,
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })
}

/**
 * Hard-delete a cost entry.
 */
export async function deleteCostEntry(orgId: string, entryId: string) {
  const existing = await rawPrisma.maintenanceCostEntry.findFirst({
    where: { id: entryId, organizationId: orgId },
  })
  if (!existing) throw new Error('NOT_FOUND')

  await rawPrisma.maintenanceCostEntry.delete({ where: { id: entryId } })
}

// ─── Cost Summary ─────────────────────────────────────────────────────────────

/**
 * Aggregate cost summary for a ticket.
 * Returns: totalLaborHours, laborCost, materialsCost, grandTotal.
 */
export async function getCostSummary(ticketId: string) {
  const [laborEntries, costEntries] = await Promise.all([
    rawPrisma.maintenanceLaborEntry.findMany({
      where: { ticketId },
      include: {
        technician: {
          select: { technicianProfile: { select: { loadedHourlyRate: true } } },
        },
      },
    }),
    rawPrisma.maintenanceCostEntry.findMany({
      where: { ticketId },
      select: { amount: true },
    }),
  ])

  let totalLaborMinutes = 0
  let laborCost = 0

  for (const entry of laborEntries) {
    const minutes = entry.durationMinutes ?? 0
    totalLaborMinutes += minutes
    const rate = entry.technician.technicianProfile?.loadedHourlyRate ?? 0
    laborCost += (minutes / 60) * rate
  }

  const materialsCost = costEntries.reduce((sum, e) => sum + e.amount, 0)
  const totalLaborHours = totalLaborMinutes / 60
  const grandTotal = laborCost + materialsCost

  return {
    totalLaborHours: Math.round(totalLaborHours * 100) / 100,
    laborCost: Math.round(laborCost * 100) / 100,
    materialsCost: Math.round(materialsCost * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  }
}

// ─── Vendor List ──────────────────────────────────────────────────────────────

/**
 * Get distinct vendor strings for an org.
 * Optional prefix filter via ?q= (case-insensitive).
 */
export async function getVendorList(orgId: string, q?: string): Promise<string[]> {
  const where: Record<string, unknown> = {
    organizationId: orgId,
    vendor: { not: null },
  }

  if (q && q.trim()) {
    where.vendor = { contains: q.trim(), mode: 'insensitive' }
  }

  const results = await rawPrisma.maintenanceCostEntry.findMany({
    where: where as any,
    select: { vendor: true },
    distinct: ['vendor'],
    orderBy: { vendor: 'asc' },
  })

  return results
    .map((r) => r.vendor)
    .filter((v): v is string => v !== null && v !== '')
}
