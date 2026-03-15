/**
 * Event Check-In Service
 *
 * Handles QR code check-in, undo check-in, counter queries, participant lookup,
 * and offline sync for day-of event operations.
 *
 * Uses rawPrisma: check-in queries need to cross registration + event data
 * without always having org context (e.g., public participant lookup).
 */

import { rawPrisma } from '@/lib/db'
import { RegistrationStatus, AnnouncementAudience } from '@prisma/client'

// ─── Input Types ─────────────────────────────────────────────────────────────

export type CheckInInput = {
  eventProjectId: string
  registrationId: string
  checkedInById?: string
  method?: 'QR_SCAN' | 'MANUAL'
  syncedAt?: Date
}

export type OfflineCheckInInput = {
  registrationId: string
  eventProjectId: string
  checkedInAt: Date
  method?: 'QR_SCAN' | 'MANUAL'
}

// ─── Check-In CRUD ────────────────────────────────────────────────────────────

/**
 * Checks in a participant. Uses upsert on the unique [registrationId, eventProjectId] constraint.
 * If already checked in, returns existing record with alreadyCheckedIn: true.
 * Returns the check-in record plus basic participant flash card data.
 */
export async function checkIn(data: CheckInInput): Promise<Record<string, unknown>> {
  const { eventProjectId, registrationId, checkedInById, method = 'QR_SCAN', syncedAt } = data

  // Verify registration exists and belongs to this event
  const registration = await rawPrisma.eventRegistration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      eventProjectId: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      email: true,
      grade: true,
      photoUrl: true,
      status: true,
    },
  })

  if (!registration) {
    throw new Error('Registration not found')
  }

  if (registration.eventProjectId !== eventProjectId) {
    throw new Error('Registration does not belong to this event')
  }

  // Check for existing check-in
  const existing = await rawPrisma.eventCheckIn.findUnique({
    where: {
      registrationId_eventProjectId: { registrationId, eventProjectId },
    },
    include: {
      checkedInBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  if (existing) {
    return {
      ...existing,
      alreadyCheckedIn: true,
      participant: {
        firstName: registration.firstName,
        lastName: registration.lastName,
        email: registration.email,
        grade: registration.grade,
        photoUrl: registration.photoUrl,
      },
    }
  }

  // Create new check-in record
  const checkInRecord = await rawPrisma.eventCheckIn.create({
    data: {
      organizationId: registration.organizationId,
      eventProjectId,
      registrationId,
      checkedInAt: new Date(),
      checkedInById: checkedInById ?? null,
      method,
      syncedAt: syncedAt ?? null,
    },
    include: {
      checkedInBy: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  return {
    ...checkInRecord,
    alreadyCheckedIn: false,
    participant: {
      firstName: registration.firstName,
      lastName: registration.lastName,
      email: registration.email,
      grade: registration.grade,
      photoUrl: registration.photoUrl,
    },
  }
}

/**
 * Undoes a check-in (for mistakes — staff accidentally scanned wrong person).
 * Hard deletes the EventCheckIn record.
 */
export async function undoCheckIn(eventProjectId: string, registrationId: string): Promise<void> {
  await rawPrisma.eventCheckIn.deleteMany({
    where: {
      registrationId,
      eventProjectId,
    },
  })
}

/**
 * Returns the check-in counter for an event.
 * { checkedIn: number, total: number }
 * total = count of REGISTERED participants
 * checkedIn = count of EventCheckIn records for this event
 */
export async function getCheckInCounter(eventProjectId: string): Promise<{
  checkedIn: number
  total: number
}> {
  const [checkedIn, total] = await Promise.all([
    rawPrisma.eventCheckIn.count({
      where: { eventProjectId },
    }),
    rawPrisma.eventRegistration.count({
      where: {
        eventProjectId,
        status: RegistrationStatus.REGISTERED,
        deletedAt: null,
      },
    }),
  ])

  return { checkedIn, total }
}

/**
 * Returns full list of all REGISTERED participants with check-in status.
 * Sorted by last check-in time (most recent first), unchecked-in at the bottom.
 * Each entry includes: registrationId, firstName, lastName, photoUrl, grade,
 * isCheckedIn, checkedInAt, checkedInBy (name).
 */
export async function getCheckInStatus(eventProjectId: string): Promise<Array<{
  registrationId: string
  firstName: string
  lastName: string
  photoUrl: string | null
  grade: string | null
  isCheckedIn: boolean
  checkedInAt: Date | null
  checkedInByName: string | null
}>> {
  // Fetch all registered participants
  const registrations = await rawPrisma.eventRegistration.findMany({
    where: {
      eventProjectId,
      status: RegistrationStatus.REGISTERED,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      grade: true,
    },
  })

  // Fetch all check-in records for this event
  const checkIns = await rawPrisma.eventCheckIn.findMany({
    where: { eventProjectId },
    select: {
      registrationId: true,
      checkedInAt: true,
      checkedInBy: { select: { firstName: true, lastName: true } },
    },
  })

  // Build a map of registrationId -> check-in record
  const checkInMap = new Map<string, { checkedInAt: Date; checkedInByName: string | null }>()
  for (const ci of checkIns) {
    checkInMap.set(ci.registrationId, {
      checkedInAt: ci.checkedInAt,
      checkedInByName: ci.checkedInBy
        ? `${ci.checkedInBy.firstName} ${ci.checkedInBy.lastName}`.trim()
        : null,
    })
  }

  // Merge and build result list
  const result = registrations.map((reg) => {
    const ci = checkInMap.get(reg.id)
    return {
      registrationId: reg.id,
      firstName: reg.firstName,
      lastName: reg.lastName,
      photoUrl: reg.photoUrl,
      grade: reg.grade,
      isCheckedIn: !!ci,
      checkedInAt: ci?.checkedInAt ?? null,
      checkedInByName: ci?.checkedInByName ?? null,
    }
  })

  // Sort: checked-in first (by checkedInAt desc), then unchecked-in
  result.sort((a, b) => {
    if (a.isCheckedIn && b.isCheckedIn) {
      return (b.checkedInAt?.getTime() ?? 0) - (a.checkedInAt?.getTime() ?? 0)
    }
    if (a.isCheckedIn) return -1
    if (b.isCheckedIn) return 1
    return 0
  })

  return result
}

/**
 * Fetches comprehensive participant info for QR scan result display.
 * Accepts includeMedical boolean — caller MUST verify events:medical:read before passing true.
 *
 * Returns:
 * - Basic: firstName, lastName, photoUrl, grade, email
 * - Medical (if includeMedical): allergies, medications from RegistrationSensitiveData
 * - Groups: group assignments with name and type
 * - Schedule: EventScheduleBlocks for the event
 * - Announcements: relevant announcements (ALL or group-targeted for participant)
 * - Check-in status: isCheckedIn, checkedInAt
 */
export async function getParticipantByRegistration(
  registrationId: string,
  includeMedical = false,
): Promise<Record<string, unknown> | null> {
  const registration = await rawPrisma.eventRegistration.findUnique({
    where: { id: registrationId, deletedAt: null },
    select: {
      id: true,
      eventProjectId: true,
      organizationId: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      grade: true,
      email: true,
      status: true,
      sensitiveData: includeMedical
        ? { select: { allergies: true, medications: true } }
        : false,
      groupAssignments: {
        select: {
          group: { select: { id: true, name: true, type: true } },
        },
      },
      checkIns: {
        where: {},
        select: { checkedInAt: true, checkedInById: true },
        take: 1,
      },
    },
  })

  if (!registration) return null

  // Fetch schedule blocks for this event
  const scheduleBlocks = await rawPrisma.eventScheduleBlock.findMany({
    where: { eventProjectId: registration.eventProjectId },
    select: {
      id: true,
      title: true,
      type: true,
      startsAt: true,
      endsAt: true,
      locationText: true,
    },
    orderBy: { startsAt: 'asc' },
  })

  // Fetch relevant announcements: ALL audience + GROUP audience for participant's groups
  const groupIds = registration.groupAssignments.map((ga) => ga.group.id)
  const announcements = await rawPrisma.eventAnnouncement.findMany({
    where: {
      eventProjectId: registration.eventProjectId,
      OR: [
        { audience: AnnouncementAudience.ALL },
        ...(groupIds.length > 0 ? [{ audience: AnnouncementAudience.GROUP, targetGroupId: { in: groupIds } }] : []),
      ],
    },
    select: {
      id: true,
      title: true,
      body: true,
      audience: true,
      sentAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const checkIn = registration.checkIns[0] ?? null

  const result: Record<string, unknown> = {
    registrationId: registration.id,
    firstName: registration.firstName,
    lastName: registration.lastName,
    photoUrl: registration.photoUrl,
    grade: registration.grade,
    email: registration.email,
    status: registration.status,
    groups: registration.groupAssignments.map((ga) => ({
      id: ga.group.id,
      name: ga.group.name,
      type: ga.group.type,
    })),
    schedule: scheduleBlocks,
    announcements,
    checkInStatus: {
      isCheckedIn: !!checkIn,
      checkedInAt: checkIn?.checkedInAt ?? null,
    },
  }

  if (includeMedical && registration.sensitiveData) {
    result.medical = {
      allergies: registration.sensitiveData.allergies,
      medications: registration.sensitiveData.medications,
    }
  }

  return result
}

/**
 * Batch upsert for offline sync. Skips duplicates (already checked in).
 * Returns { synced: number, skipped: number }.
 */
export async function syncOfflineCheckIns(
  checkIns: OfflineCheckInInput[],
): Promise<{ synced: number; skipped: number }> {
  let synced = 0
  let skipped = 0

  for (const ci of checkIns) {
    // Check for existing check-in
    const existing = await rawPrisma.eventCheckIn.findUnique({
      where: {
        registrationId_eventProjectId: {
          registrationId: ci.registrationId,
          eventProjectId: ci.eventProjectId,
        },
      },
      select: { id: true },
    })

    if (existing) {
      skipped++
      continue
    }

    // Look up organizationId from registration
    const registration = await rawPrisma.eventRegistration.findUnique({
      where: { id: ci.registrationId },
      select: { organizationId: true, eventProjectId: true },
    })

    if (!registration || registration.eventProjectId !== ci.eventProjectId) {
      skipped++
      continue
    }

    await rawPrisma.eventCheckIn.create({
      data: {
        organizationId: registration.organizationId,
        eventProjectId: ci.eventProjectId,
        registrationId: ci.registrationId,
        checkedInAt: ci.checkedInAt,
        method: ci.method ?? 'QR_SCAN',
        syncedAt: new Date(),
      },
    })

    synced++
  }

  return { synced, skipped }
}
