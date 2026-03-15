/**
 * Event Group Service
 *
 * Group CRUD, participant assignment, auto-assign algorithm,
 * elective activity signups, and aggregated dietary/medical reports.
 *
 * All functions operate inside a runWithOrgContext block — use `prisma`
 * (org-scoped) unless accessing RegistrationSensitiveData (no orgId column).
 */

import { prisma, rawPrisma } from '@/lib/db'
import { RegistrationStatus } from '@prisma/client'

// Cast to any to access Phase 21 models registered in orgScopedModels
// (same pattern used throughout the codebase for newer models)
const db = prisma as any

// ─── Enums ────────────────────────────────────────────────────────────────────

export type EventGroupType = 'BUS' | 'CABIN' | 'SMALL_GROUP' | 'ACTIVITY'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateGroupInput = {
  eventProjectId: string
  name: string
  type: EventGroupType
  capacity?: number | null
  leaderId?: string | null
  description?: string | null
  sortOrder?: number
}

export type UpdateGroupInput = Partial<Omit<CreateGroupInput, 'eventProjectId'>>

export type CreateActivityInput = {
  eventProjectId: string
  name: string
  description?: string | null
  capacity?: number | null
  scheduledAt?: Date | null
  durationMinutes?: number | null
  locationText?: string | null
  sortOrder?: number
}

export type UpdateActivityInput = Partial<Omit<CreateActivityInput, 'eventProjectId'>>

export type DietaryMedicalReport = {
  dietarySummary: Array<{ need: string; count: number }>
  allergySummary: Array<{
    allergy: string
    count: number
    participants: Array<{ name: string; registrationId: string }>
  }>
  medicationCount: number
  participantsWithMedicalNotes: Array<{ name: string; registrationId: string }>
}

// ─── Group CRUD ───────────────────────────────────────────────────────────────

/**
 * Creates a new EventGroup for an EventProject.
 */
export async function createGroup(data: CreateGroupInput) {
  return db.eventGroup.create({
    data: {
      eventProjectId: data.eventProjectId,
      name: data.name,
      type: data.type,
      capacity: data.capacity ?? null,
      leaderId: data.leaderId ?? null,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
    include: {
      leader: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { assignments: true } },
    },
  })
}

/**
 * Updates an EventGroup's fields.
 */
export async function updateGroup(id: string, data: UpdateGroupInput) {
  return db.eventGroup.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
      ...(data.leaderId !== undefined && { leaderId: data.leaderId }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
    include: {
      leader: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { assignments: true } },
    },
  })
}

/**
 * Hard-deletes an EventGroup. Cascade deletes assignments.
 */
export async function deleteGroup(id: string): Promise<void> {
  await db.eventGroup.delete({ where: { id } })
}

/**
 * Lists all EventGroups for an EventProject, optionally filtered by type.
 * Sorted by sortOrder ascending.
 */
export async function listGroups(eventProjectId: string, type?: EventGroupType) {
  const groups = await db.eventGroup.findMany({
    where: {
      eventProjectId,
      ...(type ? { type } : {}),
    },
    orderBy: { sortOrder: 'asc' },
    include: {
      leader: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      _count: { select: { assignments: true } },
    },
  })

  return groups.map((g: any) => ({
    id: g.id,
    eventProjectId: g.eventProjectId,
    name: g.name,
    type: g.type,
    capacity: g.capacity,
    leaderId: g.leaderId,
    leaderName: g.leader ? `${g.leader.firstName} ${g.leader.lastName}` : null,
    leaderAvatar: g.leader?.avatar ?? null,
    description: g.description,
    sortOrder: g.sortOrder,
    assignmentCount: g._count.assignments,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  }))
}

// ─── Assignments ──────────────────────────────────────────────────────────────

/**
 * Assigns a participant to a group. Checks capacity before creating.
 * Throws "Group is at capacity" if the group has a capacity set and it is full.
 */
export async function assignToGroup(
  registrationId: string,
  groupId: string,
  assignedById?: string,
) {
  // Load the group to check capacity
  const group = await db.eventGroup.findUnique({
    where: { id: groupId },
    select: { capacity: true },
  })

  if (!group) {
    throw new Error('Group not found')
  }

  if (group.capacity !== null) {
    const currentCount = await db.eventGroupAssignment.count({
      where: { groupId },
    })
    if (currentCount >= group.capacity) {
      throw new Error('Group is at capacity')
    }
  }

  return db.eventGroupAssignment.create({
    data: {
      registrationId,
      groupId,
      assignedById: assignedById ?? null,
    },
  })
}

/**
 * Removes a participant from a group.
 */
export async function removeFromGroup(
  registrationId: string,
  groupId: string,
): Promise<void> {
  await db.eventGroupAssignment.delete({
    where: { registrationId_groupId: { registrationId, groupId } },
  })
}

/**
 * Returns all assignments for a group with participant info.
 */
export async function getGroupAssignments(groupId: string) {
  const assignments = await db.eventGroupAssignment.findMany({
    where: { groupId },
    include: {
      registration: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          grade: true,
          photoUrl: true,
        },
      },
      assignedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { assignedAt: 'asc' },
  })

  return assignments.map((a: any) => ({
    id: a.id,
    registrationId: a.registrationId,
    groupId: a.groupId,
    participantName: `${a.registration.firstName} ${a.registration.lastName}`,
    participantEmail: a.registration.email,
    participantGrade: a.registration.grade,
    participantPhotoUrl: a.registration.photoUrl,
    assignedAt: a.assignedAt,
    assignedByName: a.assignedBy
      ? `${a.assignedBy.firstName} ${a.assignedBy.lastName}`
      : null,
  }))
}

/**
 * Returns REGISTERED participants not yet assigned to any group of the given type.
 * A participant can be in a BUS group AND a CABIN group — these are independent.
 */
export async function getUnassignedParticipants(
  eventProjectId: string,
  groupType: EventGroupType,
) {
  // Find all groupIds of this type for this event project
  const groups = await db.eventGroup.findMany({
    where: { eventProjectId, type: groupType },
    select: { id: true },
  })
  const groupIds = groups.map((g: any) => g.id)

  // Find registrationIds already assigned to any of these groups
  const assignedRegistrationIds: string[] =
    groupIds.length > 0
      ? (
          await db.eventGroupAssignment.findMany({
            where: { groupId: { in: groupIds } },
            select: { registrationId: true },
          })
        ).map((a: any) => a.registrationId)
      : []

  // Return REGISTERED participants not in that set
  const registrations = await rawPrisma.eventRegistration.findMany({
    where: {
      eventProjectId,
      status: RegistrationStatus.REGISTERED,
      deletedAt: null,
      ...(assignedRegistrationIds.length > 0
        ? { id: { notIn: assignedRegistrationIds } }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      grade: true,
      photoUrl: true,
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })

  return registrations.map((r) => ({
    registrationId: r.id,
    participantName: `${r.firstName} ${r.lastName}`,
    email: r.email,
    grade: r.grade,
    photoUrl: r.photoUrl,
  }))
}

// ─── Auto-Assign ──────────────────────────────────────────────────────────────

/**
 * Distributes unassigned participants into groups of the specified type.
 *
 * Algorithm:
 * 1. Get all groups of this type with current counts.
 * 2. Get unassigned participants.
 * 3. Sort groups by available capacity (most space first). Skip full groups.
 * 4. If balanceBy is specified, sort participants by that field, then round-robin.
 * 5. Otherwise, round-robin distribute.
 * 6. Throw error if all groups are full but participants remain.
 *
 * Returns count of assignments made.
 */
export async function autoAssign(
  eventProjectId: string,
  groupType: EventGroupType,
  options?: { balanceBy?: 'grade' | 'gender' },
): Promise<{ assignmentsCreated: number }> {
  // 1. Get all groups with current assignment counts
  const groups = await db.eventGroup.findMany({
    where: { eventProjectId, type: groupType },
    include: { _count: { select: { assignments: true } } },
    orderBy: { sortOrder: 'asc' },
  })

  if (groups.length === 0) {
    throw new Error('No groups of this type exist')
  }

  // 2. Get unassigned participants
  const unassigned = await getUnassignedParticipants(eventProjectId, groupType)

  if (unassigned.length === 0) {
    return { assignmentsCreated: 0 }
  }

  // 3. Sort groups by available capacity (most space first), exclude full groups
  type GroupWithSpace = {
    id: string
    capacity: number | null
    currentCount: number
    availableSpace: number
  }

  const groupsWithSpace: GroupWithSpace[] = groups
    .map((g: any) => ({
      id: g.id,
      capacity: g.capacity as number | null,
      currentCount: g._count.assignments as number,
      availableSpace: g.capacity !== null ? (g.capacity as number) - (g._count.assignments as number) : Number.POSITIVE_INFINITY,
    }))
    .filter((g: GroupWithSpace) => g.availableSpace > 0)
    .sort((a: GroupWithSpace, b: GroupWithSpace) => {
      // Most available space first; unlimited capacity groups go last
      if (a.availableSpace === Infinity && b.availableSpace === Infinity) return 0
      if (a.availableSpace === Infinity) return 1
      if (b.availableSpace === Infinity) return -1
      return b.availableSpace - a.availableSpace
    })

  if (groupsWithSpace.length === 0) {
    throw new Error('All groups are at capacity')
  }

  // 4. Sort participants if balanceBy specified
  const participants = options?.balanceBy === 'grade'
    ? [...unassigned].sort((a, b) => (a.grade ?? '').localeCompare(b.grade ?? ''))
    : [...unassigned]

  // 5. Round-robin assign, tracking per-group counts in-memory (immutable map)
  const groupCounters = new Map<string, number>(
    groupsWithSpace.map((g) => [g.id, g.currentCount]),
  )
  const assignmentData: Array<{ registrationId: string; groupId: string }> = []
  let groupIndex = 0

  for (const participant of participants) {
    let placed = false
    let attempts = 0
    while (attempts < groupsWithSpace.length) {
      const group = groupsWithSpace[groupIndex % groupsWithSpace.length]
      const currentCount = groupCounters.get(group.id) ?? 0
      const hasSpace =
        group.capacity === null || currentCount < (group.capacity ?? Number.MAX_SAFE_INTEGER)

      if (hasSpace) {
        assignmentData.push({
          registrationId: participant.registrationId,
          groupId: group.id,
        })
        groupCounters.set(group.id, currentCount + 1)
        groupIndex++
        placed = true
        break
      } else {
        groupIndex++
        attempts++
      }
    }

    if (!placed) {
      const made = assignmentData.length
      throw new Error(
        `All groups are at capacity. ${made} assignments made before capacity was reached.`,
      )
    }
  }

  // 6. Persist all assignments sequentially
  for (const assignment of assignmentData) {
    // eslint-disable-next-line no-await-in-loop
    await db.eventGroupAssignment.create({
      data: {
        registrationId: assignment.registrationId,
        groupId: assignment.groupId,
      },
    })
  }

  return { assignmentsCreated: assignmentData.length }
}

// ─── Activities ───────────────────────────────────────────────────────────────

/**
 * Creates an EventActivityOption.
 */
export async function createActivity(data: CreateActivityInput) {
  return db.eventActivityOption.create({
    data: {
      eventProjectId: data.eventProjectId,
      name: data.name,
      description: data.description ?? null,
      capacity: data.capacity ?? null,
      scheduledAt: data.scheduledAt ?? null,
      durationMinutes: data.durationMinutes ?? null,
      locationText: data.locationText ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
    include: {
      _count: { select: { signups: true } },
    },
  })
}

/**
 * Updates an EventActivityOption.
 */
export async function updateActivity(id: string, data: UpdateActivityInput) {
  return db.eventActivityOption.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
      ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt }),
      ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
      ...(data.locationText !== undefined && { locationText: data.locationText }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
    include: {
      _count: { select: { signups: true } },
    },
  })
}

/**
 * Hard-deletes an EventActivityOption. Cascade deletes signups.
 */
export async function deleteActivity(id: string): Promise<void> {
  await db.eventActivityOption.delete({ where: { id } })
}

/**
 * Lists all activities for an EventProject with signup count vs capacity.
 */
export async function listActivities(eventProjectId: string) {
  const activities = await db.eventActivityOption.findMany({
    where: { eventProjectId },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { signups: true } },
    },
  })

  return activities.map((a: any) => ({
    id: a.id,
    eventProjectId: a.eventProjectId,
    name: a.name,
    description: a.description,
    capacity: a.capacity,
    scheduledAt: a.scheduledAt,
    durationMinutes: a.durationMinutes,
    locationText: a.locationText,
    sortOrder: a.sortOrder,
    signupCount: a._count.signups,
    isFull: a.capacity !== null && a._count.signups >= a.capacity,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }))
}

// ─── Activity Signups ─────────────────────────────────────────────────────────

/**
 * Signs a participant up for an activity. Checks capacity before creating.
 * Throws "Activity is full" if capacity is set and reached.
 */
export async function signupForActivity(registrationId: string, activityId: string) {
  const activity = await db.eventActivityOption.findUnique({
    where: { id: activityId },
    select: { capacity: true },
  })

  if (!activity) {
    throw new Error('Activity not found')
  }

  if (activity.capacity !== null) {
    const currentCount = await db.eventActivitySignup.count({
      where: { activityId },
    })
    if (currentCount >= activity.capacity) {
      throw new Error('Activity is full')
    }
  }

  return db.eventActivitySignup.create({
    data: { registrationId, activityId },
  })
}

/**
 * Cancels a participant's activity signup.
 */
export async function cancelActivitySignup(
  registrationId: string,
  activityId: string,
): Promise<void> {
  await db.eventActivitySignup.delete({
    where: { registrationId_activityId: { registrationId, activityId } },
  })
}

/**
 * Returns all signups for an activity with participant info.
 */
export async function getActivitySignups(activityId: string) {
  const signups = await db.eventActivitySignup.findMany({
    where: { activityId },
    include: {
      registration: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          grade: true,
          photoUrl: true,
        },
      },
    },
    orderBy: { signedUpAt: 'asc' },
  })

  return signups.map((s: any) => ({
    id: s.id,
    registrationId: s.registrationId,
    activityId: s.activityId,
    participantName: `${s.registration.firstName} ${s.registration.lastName}`,
    participantEmail: s.registration.email,
    participantGrade: s.registration.grade,
    participantPhotoUrl: s.registration.photoUrl,
    signedUpAt: s.signedUpAt,
  }))
}

// ─── Dietary / Medical Report ─────────────────────────────────────────────────

/**
 * Aggregates dietary needs and medical info across all REGISTERED participants.
 *
 * SECURITY: Caller MUST verify events:medical:read permission before calling.
 *
 * Returns:
 * - dietarySummary: aggregated dietary need counts
 * - allergySummary: allergy counts with participant names (not notes)
 * - medicationCount: count of participants with medications
 * - participantsWithMedicalNotes: just names (notes require individual lookup)
 *
 * NOTE: RegistrationSensitiveData has no organizationId column so we use
 * rawPrisma for queries involving sensitiveData.
 */
export async function getDietaryMedicalReport(
  eventProjectId: string,
): Promise<DietaryMedicalReport> {
  // Fetch all REGISTERED registrations with dietaryNeeds + sensitiveData
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
      dietaryNeeds: true,
      sensitiveData: {
        select: {
          allergies: true,
          medications: true,
          medicalNotes: true,
        },
      },
    },
  })

  // Aggregate dietary needs (comma-separated values per registration)
  const dietaryMap = new Map<string, number>()
  for (const reg of registrations) {
    if (reg.dietaryNeeds) {
      const needs = reg.dietaryNeeds
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)
      for (const need of needs) {
        dietaryMap.set(need, (dietaryMap.get(need) ?? 0) + 1)
      }
    }
  }
  const dietarySummary = Array.from(dietaryMap.entries())
    .map(([need, count]) => ({ need, count }))
    .sort((a, b) => b.count - a.count)

  // Aggregate allergies
  const allergyMap = new Map<
    string,
    { count: number; participants: Array<{ name: string; registrationId: string }> }
  >()
  for (const reg of registrations) {
    if (reg.sensitiveData?.allergies) {
      const allergies = reg.sensitiveData.allergies
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)
      const participantName = `${reg.firstName} ${reg.lastName}`
      for (const allergy of allergies) {
        const existing = allergyMap.get(allergy) ?? { count: 0, participants: [] }
        allergyMap.set(allergy, {
          count: existing.count + 1,
          participants: [
            ...existing.participants,
            { name: participantName, registrationId: reg.id },
          ],
        })
      }
    }
  }
  const allergySummary = Array.from(allergyMap.entries())
    .map(([allergy, data]) => ({
      allergy,
      count: data.count,
      participants: data.participants,
    }))
    .sort((a, b) => b.count - a.count)

  // Count participants with medications (non-empty string)
  const medicationCount = registrations.filter(
    (r) => r.sensitiveData?.medications && r.sensitiveData.medications.trim() !== '',
  ).length

  // Participants with medical notes (names only — not the notes themselves)
  const participantsWithMedicalNotes = registrations
    .filter(
      (r) =>
        r.sensitiveData?.medicalNotes && r.sensitiveData.medicalNotes.trim() !== '',
    )
    .map((r) => ({
      name: `${r.firstName} ${r.lastName}`,
      registrationId: r.id,
    }))

  return {
    dietarySummary,
    allergySummary,
    medicationCount,
    participantsWithMedicalNotes,
  }
}
