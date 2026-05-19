/**
 * Facility Booking Service
 *
 * Core logic for space availability checking, conflict detection with capacity
 * and buffer awareness, alternative space suggestions, and blackout date enforcement.
 *
 * CalendarEvent is the single source of truth for "is this space taken?"
 */

import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import { getOrgContextId } from '@/lib/org-context'
import type { Prisma, SpaceStatus } from '@prisma/client'

// ─── Constants ──────────────────────────────────────────────────────────────

/** SpaceTypes considered outdoor (for weather cancellation flows) */
export const OUTDOOR_SPACE_TYPES = ['FIELD', 'COURT', 'GARDEN', 'PLAYGROUND', 'PARKING'] as const

/** SpaceTypes considered indoor */
export const INDOOR_SPACE_TYPES = ['GYM', 'POOL', 'COMMON', 'OTHER'] as const

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConflictInfo {
  id: string
  title: string
  startTime: Date
  endTime: Date
  date: string // ISO date string for recurring — which specific date conflicts
  location: string
  sourceModule: string | null
  bookedBy: {
    id: string
    name: string | null
    firstName: string | null
    lastName: string | null
    email: string
    avatar: string | null
    schoolId: string | null
  } | null
}

export interface AlternativeSpace {
  id: string
  name: string
  spaceType: string
  status: SpaceStatus
  capacity: number | null
  building: { id: string; name: string } | null
}

export interface AvailabilityResult {
  available: boolean
  space: {
    id: string
    name: string
    status: SpaceStatus
    capacity: number | null
    openTime: string | null
    closeTime: string | null
    currentBookings: number
  }
  conflicts: ConflictInfo[]
  alternatives: AlternativeSpace[]
  blockedReason?: string // "Space is under maintenance", "Space is closed", "Blackout date: Winter Break"
}

export interface BulkCheckResult {
  startTime: Date
  endTime: Date
  available: boolean
  conflict?: ConflictInfo
  blockedReason?: string
}

// ─── Space Status Checks ────────────────────────────────────────────────────

/**
 * Check if a space is in a bookable state (not under maintenance or closed).
 */
async function checkSpaceStatus(spaceId: string): Promise<{
  ok: boolean
  space: {
    id: string
    name: string
    status: SpaceStatus
    capacity: number | null
    spaceType: string
    openTime: string | null
    closeTime: string | null
    buildingId: string | null
  }
  reason?: string
}> {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: {
      id: true,
      name: true,
      status: true,
      capacity: true,
      spaceType: true,
      openTime: true,
      closeTime: true,
      buildingId: true,
    },
  })

  if (!space) {
    return { ok: false, space: null as never, reason: 'Space not found' }
  }

  if (space.status === 'UNDER_MAINTENANCE') {
    return { ok: false, space, reason: `${space.name} is under maintenance` }
  }

  if (space.status === 'CLOSED') {
    return { ok: false, space, reason: `${space.name} is closed` }
  }

  return { ok: true, space }
}

// ─── Operating Hours Check ──────────────────────────────────────────────────

/**
 * Validate that a booking fits within a space's operating hours.
 * - event.startTime - setupMinutes >= openTime
 * - event.endTime <= closeTime
 * - Teardown can extend past closing (cleanup after event ends).
 */
export function checkOperatingHours(
  startTime: Date,
  endTime: Date,
  openTime: string | null,
  closeTime: string | null,
  setupMinutes?: number | null,
  orgTimezone?: string,
): { ok: boolean; reason?: string } {
  if (!openTime && !closeTime) return { ok: true }

  const tz = orgTimezone ?? 'America/Chicago'

  // Extract HH:mm from the booking times in org timezone
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const effectiveStart = setupMinutes
    ? new Date(startTime.getTime() - setupMinutes * 60_000)
    : startTime

  const startLocal = fmt.format(effectiveStart)
  const endLocal = fmt.format(endTime)

  if (openTime && startLocal < openTime) {
    return {
      ok: false,
      reason: `Booking (including ${setupMinutes ?? 0} min setup) starts at ${startLocal}, but space opens at ${openTime}`,
    }
  }

  if (closeTime && endLocal > closeTime) {
    return {
      ok: false,
      reason: `Booking ends at ${endLocal}, but space closes at ${closeTime}`,
    }
  }

  return { ok: true }
}

// ─── Blackout Date Check ────────────────────────────────────────────────────

/**
 * Check if a date falls on an org blackout date. Compares in org timezone.
 */
export async function checkBlackoutDate(
  bookingStart: Date,
  spaceId?: string | null,
): Promise<{ blocked: boolean; reason?: string }> {
  const orgId = getOrgContextId()
  if (!orgId) return { blocked: false }

  // Get org timezone
  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { timezone: true },
  })
  const tz = org?.timezone ?? 'America/Chicago'

  // Get booking date in org timezone
  const bookingDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(bookingStart) // returns YYYY-MM-DD

  // Query blackout dates for this org
  const blackouts = await prisma.blackoutDate.findMany({
    where: { organizationId: orgId },
    select: { date: true, reason: true, appliesToAll: true, spaceId: true },
  })

  for (const b of blackouts) {
    const blackoutDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(b.date)

    if (blackoutDateStr !== bookingDateStr) continue

    // Check if this blackout applies
    if (b.appliesToAll) {
      return { blocked: true, reason: b.reason ? `School closed: ${b.reason}` : 'School closed (blackout date)' }
    }
    if (b.spaceId && b.spaceId === spaceId) {
      return { blocked: true, reason: b.reason ? `Space blocked: ${b.reason}` : 'Space blocked (blackout date)' }
    }
  }

  return { blocked: false }
}

// ─── Conflict Detection (Extended) ──────────────────────────────────────────

/**
 * Count how many confirmed/pending bookings overlap with a time window for a space.
 * Returns the count and the conflict details.
 */
interface OverlappingBooking extends ConflictInfo {
  exclusiveUse: boolean
}

async function findOverlappingBookings(opts: {
  spaceId: string
  buildingId?: string | null
  startTime: Date
  endTime: Date
  setupMinutes?: number | null
  teardownMinutes?: number | null
  excludeEventId?: string
}): Promise<OverlappingBooking[]> {
  const { spaceId, startTime, endTime, excludeEventId } = opts

  // Get org buffer setting
  const orgId = getOrgContextId()
  if (!orgId) return []

  const org = await rawPrisma.organization.findUnique({
    where: { id: orgId },
    select: { eventBufferMinutes: true },
  })
  const orgBufferMinutes = org?.eventBufferMinutes ?? 60

  // Use per-event buffers if set, otherwise split org buffer equally
  const setup = opts.setupMinutes ?? Math.floor(orgBufferMinutes / 2)
  const teardown = opts.teardownMinutes ?? Math.floor(orgBufferMinutes / 2)

  const windowStart = new Date(startTime.getTime() - setup * 60_000)
  const windowEnd = new Date(endTime.getTime() + teardown * 60_000)

  const where: Prisma.CalendarEventWhereInput = {
    spaceId,
    startTime: { lt: windowEnd },
    endTime: { gt: windowStart },
    calendarStatus: { in: ['CONFIRMED', 'PENDING_APPROVAL'] },
    ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
  }

  const conflicts = await prisma.calendarEvent.findMany({
    where,
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      locationText: true,
      sourceModule: true,
      exclusiveUse: true,
      building: { select: { name: true } },
      space: { select: { name: true } },
      createdBy: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          schoolId: true,
        },
      },
    },
    orderBy: { startTime: 'asc' },
  })

  return conflicts.map((c) => ({
    id: c.id,
    title: c.title,
    startTime: c.startTime,
    endTime: c.endTime,
    date: c.startTime.toISOString().split('T')[0],
    location:
      [c.building?.name, c.space?.name].filter(Boolean).join(' — ') ||
      c.locationText ||
      'Same location',
    sourceModule: c.sourceModule,
    bookedBy: c.createdBy,
    exclusiveUse: c.exclusiveUse,
  }))
}

// ─── Main Availability Check ────────────────────────────────────────────────

/**
 * Check if a space is available for a given time range.
 * Checks: space status, operating hours, blackout dates, capacity, exclusive use.
 */
export async function checkAvailability(opts: {
  spaceId: string
  startTime: Date
  endTime: Date
  setupMinutes?: number | null
  teardownMinutes?: number | null
  excludeEventId?: string
  includeAlternatives?: boolean
}): Promise<AvailabilityResult> {
  const { spaceId, startTime, endTime, excludeEventId } = opts

  // 1. Check space status
  const statusCheck = await checkSpaceStatus(spaceId)
  if (!statusCheck.ok) {
    return {
      available: false,
      space: {
        id: statusCheck.space?.id ?? spaceId,
        name: statusCheck.space?.name ?? 'Unknown',
        status: statusCheck.space?.status ?? 'CLOSED',
        capacity: statusCheck.space?.capacity ?? null,
        openTime: statusCheck.space?.openTime ?? null,
        closeTime: statusCheck.space?.closeTime ?? null,
        currentBookings: 0,
      },
      conflicts: [],
      alternatives: opts.includeAlternatives !== false
        ? await findAlternativeSpaces(spaceId, startTime, endTime)
        : [],
      blockedReason: statusCheck.reason,
    }
  }

  const space = statusCheck.space

  // 2. Check operating hours
  const orgId = getOrgContextId()
  const org = orgId
    ? await rawPrisma.organization.findUnique({
        where: { id: orgId },
        select: { timezone: true },
      })
    : null

  const hoursCheck = checkOperatingHours(
    startTime,
    endTime,
    space.openTime,
    space.closeTime,
    opts.setupMinutes,
    org?.timezone,
  )
  if (!hoursCheck.ok) {
    return {
      available: false,
      space: {
        id: space.id,
        name: space.name,
        status: space.status,
        capacity: space.capacity,
        openTime: space.openTime,
        closeTime: space.closeTime,
        currentBookings: 0,
      },
      conflicts: [],
      alternatives: opts.includeAlternatives !== false
        ? await findAlternativeSpaces(spaceId, startTime, endTime)
        : [],
      blockedReason: hoursCheck.reason,
    }
  }

  // 3. Check blackout dates
  const blackoutCheck = await checkBlackoutDate(startTime, spaceId)
  if (blackoutCheck.blocked) {
    return {
      available: false,
      space: {
        id: space.id,
        name: space.name,
        status: space.status,
        capacity: space.capacity,
        openTime: space.openTime,
        closeTime: space.closeTime,
        currentBookings: 0,
      },
      conflicts: [],
      alternatives: [],
      blockedReason: blackoutCheck.reason,
    }
  }

  // 4. Find overlapping bookings
  const overlapping = await findOverlappingBookings({
    spaceId,
    buildingId: space.buildingId,
    startTime,
    endTime,
    setupMinutes: opts.setupMinutes,
    teardownMinutes: opts.teardownMinutes,
    excludeEventId,
  })

  // 5. Check capacity
  const maxCapacity = space.capacity ?? 1
  const hasExclusiveUse = overlapping.some((c) => c.exclusiveUse)
  const currentBookings = overlapping.length

  // If any existing booking is exclusive-use, space is full regardless of capacity
  const atCapacity = hasExclusiveUse || currentBookings >= maxCapacity

  // Strip internal fields before returning
  const conflicts: ConflictInfo[] = overlapping.map(({ exclusiveUse: _, ...rest }) => rest)

  return {
    available: !atCapacity,
    space: {
      id: space.id,
      name: space.name,
      status: space.status,
      capacity: space.capacity,
      openTime: space.openTime,
      closeTime: space.closeTime,
      currentBookings,
    },
    conflicts: atCapacity ? conflicts : [],
    alternatives:
      atCapacity && opts.includeAlternatives !== false
        ? await findAlternativeSpaces(spaceId, startTime, endTime)
        : [],
  }
}

// ─── Bulk Check (Recurring) ─────────────────────────────────────────────────

/**
 * Check availability for multiple time slots (expanded from rrule).
 * Max 200 slots enforced.
 */
export async function checkBulkAvailability(opts: {
  spaceId: string
  slots: Array<{ startTime: Date; endTime: Date }>
  setupMinutes?: number | null
  teardownMinutes?: number | null
  excludeEventId?: string
}): Promise<BulkCheckResult[]> {
  const { spaceId, slots, excludeEventId } = opts

  if (slots.length > 200) {
    throw new Error('Maximum 200 slots per bulk check')
  }

  // Check space status once
  const statusCheck = await checkSpaceStatus(spaceId)

  const results: BulkCheckResult[] = []

  for (const slot of slots) {
    // If space is blocked, all slots are unavailable
    if (!statusCheck.ok) {
      results.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: false,
        blockedReason: statusCheck.reason,
      })
      continue
    }

    // Check blackout
    const blackout = await checkBlackoutDate(slot.startTime, spaceId)
    if (blackout.blocked) {
      results.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: false,
        blockedReason: blackout.reason,
      })
      continue
    }

    // Check conflicts
    const overlapping = await findOverlappingBookings({
      spaceId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      setupMinutes: opts.setupMinutes,
      teardownMinutes: opts.teardownMinutes,
      excludeEventId,
    })

    const maxCapacity = statusCheck.space.capacity ?? 1
    const hasExclusiveUse = overlapping.some((c) => c.exclusiveUse)
    const atCapacity = hasExclusiveUse || overlapping.length >= maxCapacity

    if (atCapacity && overlapping.length > 0) {
      const first = overlapping[0]
      results.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: false,
        conflict: {
          id: first.id,
          title: first.title,
          startTime: first.startTime,
          endTime: first.endTime,
          date: first.date,
          location: first.location,
          sourceModule: first.sourceModule,
          bookedBy: first.bookedBy,
        },
      })
    } else {
      results.push({
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: true,
      })
    }
  }

  return results
}

// ─── Alternative Space Finder ───────────────────────────────────────────────

/**
 * Find spaces of the same type that are available during the requested window.
 */
async function findAlternativeSpaces(
  originalSpaceId: string,
  startTime: Date,
  endTime: Date,
): Promise<AlternativeSpace[]> {
  // Get the original space's type
  const originalSpace = await prisma.space.findUnique({
    where: { id: originalSpaceId },
    select: { spaceType: true },
  })
  if (!originalSpace) return []

  // Find all active spaces of the same type (excluding the original)
  const candidates = await prisma.space.findMany({
    where: {
      id: { not: originalSpaceId },
      spaceType: originalSpace.spaceType,
      status: 'ACTIVE',
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      spaceType: true,
      status: true,
      capacity: true,
      building: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
    take: 10,
  })

  // Check each candidate for availability (quick check — count overlaps only)
  const available: AlternativeSpace[] = []

  for (const candidate of candidates) {
    const overlapping = await prisma.calendarEvent.count({
      where: {
        spaceId: candidate.id,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        calendarStatus: { in: ['CONFIRMED', 'PENDING_APPROVAL'] },
      },
    })

    const maxCapacity = candidate.capacity ?? 1
    if (overlapping < maxCapacity) {
      available.push({
        id: candidate.id,
        name: candidate.name,
        spaceType: candidate.spaceType,
        status: candidate.status,
        capacity: candidate.capacity,
        building: candidate.building,
      })
    }
  }

  return available
}

// ─── Space Schedule Query ───────────────────────────────────────────────────

/**
 * Get all bookings for a space within a date range.
 */
export async function getSpaceSchedule(opts: {
  spaceId: string
  start: Date
  end: Date
}): Promise<{
  space: {
    id: string
    name: string
    status: SpaceStatus
    capacity: number | null
    spaceType: string
    openTime: string | null
    closeTime: string | null
  }
  bookings: Array<{
    id: string
    title: string
    startTime: Date
    endTime: Date
    sourceModule: string | null
    calendarStatus: string
    setupMinutes: number | null
    teardownMinutes: number | null
    exclusiveUse: boolean
    bookedBy: {
      id: string
      name: string | null
      firstName: string | null
      lastName: string | null
      avatar: string | null
    } | null
  }>
}> {
  const space = await prisma.space.findUnique({
    where: { id: opts.spaceId },
    select: {
      id: true,
      name: true,
      status: true,
      capacity: true,
      spaceType: true,
      openTime: true,
      closeTime: true,
    },
  })

  if (!space) throw new Error('Space not found')

  const bookings = await prisma.calendarEvent.findMany({
    where: {
      spaceId: opts.spaceId,
      startTime: { lt: opts.end },
      endTime: { gt: opts.start },
      calendarStatus: { in: ['CONFIRMED', 'PENDING_APPROVAL'] },
    },
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      sourceModule: true,
      calendarStatus: true,
      setupMinutes: true,
      teardownMinutes: true,
      exclusiveUse: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          avatar: true,
        },
      },
    },
    orderBy: { startTime: 'asc' },
  })

  return {
    space,
    bookings: bookings.map((b) => ({
      ...b,
      bookedBy: b.createdBy,
    })),
  }
}

// ─── Maintenance Blocking ───────────────────────────────────────────────────

/**
 * Update space status based on maintenance tickets.
 * Called when a maintenance ticket with blocksFacility is created/resolved.
 */
export async function syncSpaceMaintenanceStatus(spaceId: string): Promise<void> {
  // Count open blocking tickets on this space
  const openBlockingCount = await prisma.maintenanceTicket.count({
    where: {
      spaceId,
      blocksFacility: true,
      status: { notIn: ['DONE', 'CANCELLED'] },
    },
  })

  const newStatus = openBlockingCount > 0 ? 'UNDER_MAINTENANCE' : 'ACTIVE'

  await prisma.space.update({
    where: { id: spaceId },
    data: { status: newStatus },
  })
}

// ─── Validation Helpers ─────────────────────────────────────────────────────

/** Booking duration must be between 15 min and 24 hours */
export function validateBookingDuration(startTime: Date, endTime: Date): { ok: boolean; reason?: string } {
  const durationMs = endTime.getTime() - startTime.getTime()
  const durationMin = durationMs / 60_000

  if (durationMin < 15) {
    return { ok: false, reason: 'Booking must be at least 15 minutes' }
  }
  if (durationMin > 24 * 60) {
    return { ok: false, reason: 'Booking cannot exceed 24 hours' }
  }
  if (startTime <= new Date()) {
    return { ok: false, reason: 'Cannot book in the past' }
  }

  // Max 12 months in advance
  const maxAdvance = new Date()
  maxAdvance.setMonth(maxAdvance.getMonth() + 12)
  if (startTime > maxAdvance) {
    return { ok: false, reason: 'Cannot book more than 12 months in advance' }
  }

  return { ok: true }
}

/** Setup/teardown sanity check */
export function validateBufferMinutes(setupMinutes?: number | null, teardownMinutes?: number | null): { ok: boolean; reason?: string } {
  if (setupMinutes != null && (setupMinutes < 0 || setupMinutes > 120)) {
    return { ok: false, reason: 'Setup time must be between 0 and 120 minutes' }
  }
  if (teardownMinutes != null && (teardownMinutes < 0 || teardownMinutes > 120)) {
    return { ok: false, reason: 'Teardown time must be between 0 and 120 minutes' }
  }
  return { ok: true }
}

/**
 * Is a given spaceType considered outdoor?
 */
export function isOutdoorSpace(spaceType: string): boolean {
  return (OUTDOOR_SPACE_TYPES as readonly string[]).includes(spaceType)
}
