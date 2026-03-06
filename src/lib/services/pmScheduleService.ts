/**
 * PM Schedule Service
 *
 * Core business logic for Preventive Maintenance (PM) schedules:
 * - Recurrence calculation (8 types: DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL, CUSTOM)
 * - CRUD for PmSchedule records
 * - Calendar event projection from PM schedules
 */

import { z } from 'zod'
import { addDays, addWeeks, addMonths, addYears, startOfDay, isBefore } from 'date-fns'
import { prisma, rawPrisma } from '@/lib/db'
import { generateTicketNumber } from '@/lib/services/maintenanceTicketService'
import { PM_RECURRENCE_TYPES, type PmRecurrenceType, type PmCalendarEvent } from '@/lib/types/pm-schedule'
export type { PmRecurrenceType, PmCalendarEvent } from '@/lib/types/pm-schedule'

// ─── PM Status Constants ───────────────────────────────────────────────────────

export const PM_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
} as const

export type PmStatus = typeof PM_STATUS[keyof typeof PM_STATUS]

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

// Base schema without refinement so .partial() can be used for updates
const PmScheduleBaseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  recurrenceType: z.enum(PM_RECURRENCE_TYPES),
  intervalDays: z.number().int().positive().optional().nullable(),
  months: z.array(z.number().int().min(1).max(12)).default([]),
  advanceNoticeDays: z.number().int().min(0).default(7),
  checklistItems: z.array(z.string()).default([]),
  assetId: z.string().optional().nullable(),
  buildingId: z.string().optional().nullable(),
  areaId: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  schoolId: z.string().optional().nullable(),
  defaultTechnicianId: z.string().optional().nullable(),
  avoidSchoolYear: z.boolean().default(false),
})

// Creation schema adds refinement: CUSTOM requires intervalDays
export const CreatePmScheduleSchema = PmScheduleBaseSchema.refine(
  (data) => data.recurrenceType !== 'CUSTOM' || (data.intervalDays != null && data.intervalDays > 0),
  { message: 'intervalDays is required for CUSTOM recurrence type', path: ['intervalDays'] }
)

// Update schema uses base (no refinement) so .partial() works
export const UpdatePmScheduleSchema = PmScheduleBaseSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export type CreatePmScheduleInput = z.infer<typeof CreatePmScheduleSchema>
export type UpdatePmScheduleInput = z.infer<typeof UpdatePmScheduleSchema>

// ─── computeNextDueDate ───────────────────────────────────────────────────────

/**
 * Compute the next due date from a base date given a recurrence type.
 *
 * For MONTHLY with specific months array, advances to the next matching month
 * after baseDate's month. If months is empty, falls back to addMonths(1).
 */
export function computeNextDueDate(
  baseDate: Date,
  recurrenceType: PmRecurrenceType,
  intervalDays?: number | null,
  months?: number[]
): Date {
  const base = startOfDay(baseDate)

  switch (recurrenceType) {
    case 'DAILY':
      return addDays(base, 1)
    case 'WEEKLY':
      return addWeeks(base, 1)
    case 'BIWEEKLY':
      return addWeeks(base, 2)
    case 'QUARTERLY':
      return addMonths(base, 3)
    case 'SEMIANNUAL':
      return addMonths(base, 6)
    case 'ANNUAL':
      return addYears(base, 1)
    case 'CUSTOM':
      return addDays(base, intervalDays ?? 30)
    case 'MONTHLY': {
      // If specific months are provided, advance to the next matching month
      if (months && months.length > 0) {
        const sortedMonths = [...months].sort((a, b) => a - b)
        const baseMonth = base.getMonth() + 1 // 1-12
        const baseYear = base.getFullYear()

        // Find the next month in the list after baseDate's month
        const nextMonthInList = sortedMonths.find((m) => m > baseMonth)

        if (nextMonthInList != null) {
          // Same year, next matching month
          return new Date(baseYear, nextMonthInList - 1, 1)
        } else {
          // Wrap to next year's first matching month
          return new Date(baseYear + 1, sortedMonths[0] - 1, 1)
        }
      }
      // Default: monthly
      return addMonths(base, 1)
    }
    default:
      return addMonths(base, 1)
  }
}

// ─── PM Schedule Includes ─────────────────────────────────────────────────────

const PM_INCLUDES = {
  asset: { select: { id: true, assetNumber: true, name: true } },
  building: { select: { id: true, name: true } },
  area: { select: { id: true, name: true } },
  room: { select: { id: true, roomNumber: true, displayName: true } },
  school: { select: { id: true, name: true } },
  defaultTechnician: { select: { id: true, name: true, email: true } },
} as const

// ─── Create PM Schedule ───────────────────────────────────────────────────────

export async function createPmSchedule(orgId: string, input: unknown) {
  const data = CreatePmScheduleSchema.parse(input)

  // Compute initial nextDueDate from today
  const today = startOfDay(new Date())
  const nextDueDate = computeNextDueDate(
    today,
    data.recurrenceType,
    data.intervalDays,
    data.months
  )

  const schedule = await prisma.pmSchedule.create({
    data: {
      organizationId: orgId,
      name: data.name,
      description: data.description ?? null,
      recurrenceType: data.recurrenceType,
      intervalDays: data.intervalDays ?? null,
      months: data.months,
      advanceNoticeDays: data.advanceNoticeDays,
      checklistItems: data.checklistItems,
      assetId: data.assetId ?? null,
      buildingId: data.buildingId ?? null,
      areaId: data.areaId ?? null,
      roomId: data.roomId ?? null,
      schoolId: data.schoolId ?? null,
      defaultTechnicianId: data.defaultTechnicianId ?? null,
      avoidSchoolYear: data.avoidSchoolYear,
      nextDueDate,
      isActive: true,
    },
    include: PM_INCLUDES,
  })

  return schedule
}

// ─── PM Schedule Filters ──────────────────────────────────────────────────────

export interface PmScheduleFilters {
  assetId?: string
  buildingId?: string
  schoolId?: string
  status?: 'active' | 'paused'
  keyword?: string
  view?: 'calendar'
  start?: string
  end?: string
}

// ─── Get PM Schedules ─────────────────────────────────────────────────────────

export async function getPmSchedules(orgId: string, filters: PmScheduleFilters = {}) {
  const { assetId, buildingId, schoolId, status, keyword } = filters

  const where: Record<string, unknown> = {}

  if (assetId) where.assetId = assetId
  if (buildingId) where.buildingId = buildingId
  if (schoolId) where.schoolId = schoolId

  // Status filter: active = isActive true, paused = isActive false
  if (status === 'active') {
    where.isActive = true
  } else if (status === 'paused') {
    where.isActive = false
  }

  if (keyword) {
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { description: { contains: keyword, mode: 'insensitive' } },
    ]
  }

  const schedules = await prisma.pmSchedule.findMany({
    where,
    include: PM_INCLUDES,
    orderBy: { nextDueDate: 'asc' },
  })

  return schedules
}

// ─── Get PM Calendar Events ───────────────────────────────────────────────────

export async function getPmCalendarEvents(
  orgId: string,
  start: string,
  end: string
): Promise<PmCalendarEvent[]> {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const now = startOfDay(new Date())

  // Fetch schedules with nextDueDate in the given range (or all active if no valid range)
  const where: Record<string, unknown> = {}

  if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
    where.nextDueDate = { gte: startDate, lte: endDate }
  }

  const schedules = await prisma.pmSchedule.findMany({
    where,
    include: PM_INCLUDES,
    orderBy: { nextDueDate: 'asc' },
  })

  return schedules.map((s) => {
    const due = s.nextDueDate ? new Date(s.nextDueDate) : null

    let color: 'blue' | 'red' | 'green' = 'blue'
    if (due) {
      if (isBefore(due, now)) {
        color = 'red' // overdue
      }
    }
    // green would be set for completed — not yet tracked at list level, keep blue for upcoming

    const locationParts = [
      s.building?.name,
      s.area?.name,
      s.room ? (s.room.displayName || s.room.roomNumber) : null,
    ].filter(Boolean)
    const locationName = locationParts.length > 0 ? locationParts.join(' > ') : null

    const eventDate = due || new Date()
    const endEventDate = addDays(eventDate, 1)

    return {
      id: s.id,
      title: s.name,
      start: eventDate.toISOString(),
      end: endEventDate.toISOString(),
      color,
      assetName: s.asset?.name ?? null,
      locationName,
      recurrenceType: s.recurrenceType,
      isActive: s.isActive,
    }
  })
}

// ─── Get PM Schedule By ID ────────────────────────────────────────────────────

export async function getPmScheduleById(orgId: string, id: string) {
  const schedule = await prisma.pmSchedule.findFirst({
    where: { id },
    include: PM_INCLUDES,
  })
  return schedule
}

// ─── Update PM Schedule ───────────────────────────────────────────────────────

export async function updatePmSchedule(orgId: string, id: string, input: unknown) {
  const data = UpdatePmScheduleSchema.parse(input)

  // Check if recurrence fields changed — if so, recompute nextDueDate
  const recurrenceFieldsChanged =
    data.recurrenceType !== undefined ||
    data.intervalDays !== undefined ||
    data.months !== undefined

  const updateData: Record<string, unknown> = {}

  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.recurrenceType !== undefined) updateData.recurrenceType = data.recurrenceType
  if (data.intervalDays !== undefined) updateData.intervalDays = data.intervalDays
  if (data.months !== undefined) updateData.months = data.months
  if (data.advanceNoticeDays !== undefined) updateData.advanceNoticeDays = data.advanceNoticeDays
  if (data.checklistItems !== undefined) updateData.checklistItems = data.checklistItems
  if (data.assetId !== undefined) updateData.assetId = data.assetId
  if (data.buildingId !== undefined) updateData.buildingId = data.buildingId
  if (data.areaId !== undefined) updateData.areaId = data.areaId
  if (data.roomId !== undefined) updateData.roomId = data.roomId
  if (data.schoolId !== undefined) updateData.schoolId = data.schoolId
  if (data.defaultTechnicianId !== undefined) updateData.defaultTechnicianId = data.defaultTechnicianId
  if (data.avoidSchoolYear !== undefined) updateData.avoidSchoolYear = data.avoidSchoolYear
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  // Recompute nextDueDate if recurrence changed
  if (recurrenceFieldsChanged) {
    // Fetch current schedule to get existing values for unmodified fields
    const existing = await prisma.pmSchedule.findFirst({ where: { id } })
    if (existing) {
      const recurrenceType = (data.recurrenceType ?? existing.recurrenceType) as PmRecurrenceType
      const intervalDays = data.intervalDays ?? existing.intervalDays
      const months = data.months ?? existing.months
      const today = startOfDay(new Date())
      updateData.nextDueDate = computeNextDueDate(today, recurrenceType, intervalDays, months)
    }
  }

  const schedule = await prisma.pmSchedule.update({
    where: { id },
    data: updateData,
    include: PM_INCLUDES,
  })

  return schedule
}

// ─── Delete PM Schedule (Soft-Delete via isActive = false) ────────────────────

export async function deletePmSchedule(orgId: string, id: string) {
  // PmSchedule does not have a deletedAt (not in orgScopedModels soft-delete list)
  // Use isActive = false as deactivation, or hard-delete
  await prisma.pmSchedule.delete({
    where: { id },
  })
}

// ─── Generate PM Tickets (Cron) ───────────────────────────────────────────────

/**
 * generatePmTickets — called by the hourly cron job.
 *
 * Scans ALL active PmSchedules across all organizations where:
 *   nextDueDate <= today + advanceNoticeDays
 *
 * For each qualifying schedule, creates a MaintenanceTicket with TODO status
 * and the schedule's checklistItems pre-populated as pmChecklistItems.
 *
 * Idempotent: duplicate cron runs skip silently via @@unique([pmScheduleId, pmScheduledDueDate]).
 *
 * Uses rawPrisma (no org context) — cron iterates all orgs like other cron tasks.
 */
export async function generatePmTickets(): Promise<number> {
  const today = startOfDay(new Date())
  let created = 0

  // Fetch all active schedules where the advance-notice window has been reached
  const schedules = await rawPrisma.pmSchedule.findMany({
    where: {
      isActive: true,
      nextDueDate: { not: null },
    },
    include: {
      asset: { select: { id: true, name: true, category: true } },
    },
  })

  const qualifying = schedules.filter((s) => {
    if (!s.nextDueDate) return false
    const advanceCutoff = addDays(today, s.advanceNoticeDays)
    return !isBefore(advanceCutoff, s.nextDueDate) // nextDueDate <= today + advanceNoticeDays
  })

  for (const schedule of qualifying) {
    try {
      const ticketNumber = await generateTicketNumber(schedule.organizationId)

      // Determine category from linked asset, or fall back to OTHER
      const category = (schedule.asset?.category as string) || 'OTHER'

      await rawPrisma.maintenanceTicket.create({
        data: {
          organizationId: schedule.organizationId,
          ticketNumber,
          title: schedule.name,
          description: schedule.description ?? null,
          category: category as any,
          specialty: assetCategoryToSpecialty(category) as any,
          priority: 'MEDIUM',
          status: 'TODO',
          // PM-specific fields
          pmScheduleId: schedule.id,
          pmScheduledDueDate: schedule.nextDueDate!,
          pmChecklistItems: schedule.checklistItems,
          pmChecklistDone: schedule.checklistItems.map(() => false),
          // Location from schedule
          assetId: schedule.assetId ?? null,
          buildingId: schedule.buildingId ?? null,
          areaId: schedule.areaId ?? null,
          roomId: schedule.roomId ?? null,
          schoolId: schedule.schoolId ?? null,
          // Default technician from schedule
          assignedToId: schedule.defaultTechnicianId ?? null,
          // System-generated: submittedById needs a system user; use any org user or skip
          // We cannot leave submittedById null (NOT NULL in schema) — use assignee or a fallback
          submittedById: schedule.defaultTechnicianId ?? await getOrgFirstUserId(schedule.organizationId),
        },
      })

      created++
      console.log(`[generatePmTickets] Created ticket ${ticketNumber} for schedule ${schedule.id} (${schedule.name})`)
    } catch (err: unknown) {
      // Unique constraint violation = duplicate run for same schedule+date — skip silently
      const isUniqueError =
        err instanceof Error &&
        (err.message.includes('Unique constraint') || (err as any).code === 'P2002')
      if (isUniqueError) {
        console.log(`[generatePmTickets] Skipping duplicate PM ticket for schedule ${schedule.id} due ${schedule.nextDueDate?.toISOString()}`)
      } else {
        console.error(`[generatePmTickets] Failed to create PM ticket for schedule ${schedule.id}:`, err)
      }
    }
  }

  return created
}

/**
 * Map asset category string to maintenance specialty.
 * Falls back to OTHER for unrecognized values.
 */
function assetCategoryToSpecialty(category: string): string {
  const map: Record<string, string> = {
    ELECTRICAL: 'ELECTRICAL',
    PLUMBING: 'PLUMBING',
    HVAC: 'HVAC',
    STRUCTURAL: 'STRUCTURAL',
    CUSTODIAL_BIOHAZARD: 'CUSTODIAL_BIOHAZARD',
    IT_AV: 'IT_AV',
    GROUNDS: 'GROUNDS',
    OTHER: 'OTHER',
  }
  return map[category] ?? 'OTHER'
}

/**
 * Get the ID of any non-deleted user in an organization.
 * Used as a fallback submittedById when no default technician is set.
 */
async function getOrgFirstUserId(orgId: string): Promise<string> {
  const user = await rawPrisma.user.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!user) throw new Error(`No users found in org ${orgId} for PM ticket generation`)
  return user.id
}
