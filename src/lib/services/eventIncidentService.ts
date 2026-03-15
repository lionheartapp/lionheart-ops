/**
 * Event Incident Service
 *
 * Handles structured incident logging for day-of event operations.
 * Supports creating incidents with involved participants, updating,
 * listing with filters, and offline sync.
 *
 * Uses rawPrisma: incidents are often accessed in cross-org contexts and
 * need explicit organizationId handling.
 */

import { rawPrisma } from '@/lib/db'
import { EventIncidentType, EventIncidentSeverity } from '@prisma/client'
import type { EventIncidentWithParticipants } from '@/lib/types/events-phase21'

// ─── Input Types ─────────────────────────────────────────────────────────────

export type CreateIncidentInput = {
  eventProjectId: string
  organizationId: string
  type: EventIncidentType
  severity: EventIncidentSeverity
  description: string
  actionsTaken?: string
  followUpNeeded?: boolean
  followUpNotes?: string
  photoUrl?: string
  reportedById: string
  participantIds?: string[]
  syncedAt?: Date
}

export type UpdateIncidentInput = Partial<{
  description: string
  actionsTaken: string
  followUpNeeded: boolean
  followUpNotes: string
  severity: EventIncidentSeverity
  photoUrl: string
}>

export type ListIncidentsOptions = {
  type?: EventIncidentType
  severity?: EventIncidentSeverity
}

// ─── Incident CRUD ────────────────────────────────────────────────────────────

/**
 * Creates an EventIncident and EventIncidentParticipant junction records.
 * Returns the incident with participants.
 */
export async function createIncident(
  data: CreateIncidentInput,
): Promise<EventIncidentWithParticipants> {
  const {
    eventProjectId,
    organizationId,
    type,
    severity,
    description,
    actionsTaken,
    followUpNeeded = false,
    followUpNotes,
    photoUrl,
    reportedById,
    participantIds = [],
    syncedAt,
  } = data

  // Create incident record
  const incident = await rawPrisma.eventIncident.create({
    data: {
      organizationId,
      eventProjectId,
      type,
      severity,
      description,
      actionsTaken: actionsTaken ?? null,
      followUpNeeded,
      followUpNotes: followUpNotes ?? null,
      photoUrl: photoUrl ?? null,
      reportedById,
      syncedAt: syncedAt ?? null,
    },
    include: {
      reportedBy: { select: { firstName: true, lastName: true } },
    },
  })

  // Create participant junction records
  if (participantIds.length > 0) {
    // Verify all registrations exist and belong to this event
    const registrations = await rawPrisma.eventRegistration.findMany({
      where: {
        id: { in: participantIds },
        eventProjectId,
        deletedAt: null,
      },
      select: { id: true, firstName: true, lastName: true },
    })

    const validIds = new Set(registrations.map((r) => r.id))

    const junctionData = participantIds
      .filter((id) => validIds.has(id))
      .map((registrationId) => ({
        registrationId,
        incidentId: incident.id,
      }))

    if (junctionData.length > 0) {
      await rawPrisma.eventIncidentParticipant.createMany({
        data: junctionData,
        skipDuplicates: true,
      })
    }
  }

  // Return full incident with participants
  return getIncident(incident.id) as Promise<EventIncidentWithParticipants>
}

/**
 * Updates incident details. Only provided fields are updated.
 */
export async function updateIncident(
  id: string,
  data: UpdateIncidentInput,
): Promise<EventIncidentWithParticipants> {
  await rawPrisma.eventIncident.update({
    where: { id },
    data: {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.actionsTaken !== undefined && { actionsTaken: data.actionsTaken }),
      ...(data.followUpNeeded !== undefined && { followUpNeeded: data.followUpNeeded }),
      ...(data.followUpNotes !== undefined && { followUpNotes: data.followUpNotes }),
      ...(data.severity !== undefined && { severity: data.severity }),
      ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
    },
  })

  return getIncident(id) as Promise<EventIncidentWithParticipants>
}

/**
 * Returns incidents for the event with involved participant names.
 * Sorted by createdAt desc. Optional filters by type and severity.
 */
export async function listIncidents(
  eventProjectId: string,
  options?: ListIncidentsOptions,
): Promise<EventIncidentWithParticipants[]> {
  const incidents = await rawPrisma.eventIncident.findMany({
    where: {
      eventProjectId,
      ...(options?.type ? { type: options.type } : {}),
      ...(options?.severity ? { severity: options.severity } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      reportedBy: { select: { firstName: true, lastName: true } },
      participants: {
        include: {
          registration: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  return incidents.map((incident) => ({
    id: incident.id,
    eventProjectId: incident.eventProjectId,
    type: incident.type as EventIncidentWithParticipants['type'],
    severity: incident.severity as EventIncidentWithParticipants['severity'],
    description: incident.description,
    actionsTaken: incident.actionsTaken,
    followUpNeeded: incident.followUpNeeded,
    followUpNotes: incident.followUpNotes,
    photoUrl: incident.photoUrl,
    reportedById: incident.reportedById,
    reporterName: `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}`.trim(),
    syncedAt: incident.syncedAt ? incident.syncedAt.toISOString() : null,
    participants: incident.participants.map((p) => ({
      registrationId: p.registrationId,
      participantName: `${p.registration.firstName} ${p.registration.lastName}`.trim(),
    })),
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  }))
}

/**
 * Returns a single incident with full participant details.
 */
export async function getIncident(id: string): Promise<EventIncidentWithParticipants | null> {
  const incident = await rawPrisma.eventIncident.findUnique({
    where: { id },
    include: {
      reportedBy: { select: { firstName: true, lastName: true } },
      participants: {
        include: {
          registration: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  if (!incident) return null

  return {
    id: incident.id,
    eventProjectId: incident.eventProjectId,
    type: incident.type as EventIncidentWithParticipants['type'],
    severity: incident.severity as EventIncidentWithParticipants['severity'],
    description: incident.description,
    actionsTaken: incident.actionsTaken,
    followUpNeeded: incident.followUpNeeded,
    followUpNotes: incident.followUpNotes,
    photoUrl: incident.photoUrl,
    reportedById: incident.reportedById,
    reporterName: `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}`.trim(),
    syncedAt: incident.syncedAt ? incident.syncedAt.toISOString() : null,
    participants: incident.participants.map((p) => ({
      registrationId: p.registrationId,
      participantName: `${p.registration.firstName} ${p.registration.lastName}`.trim(),
    })),
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  }
}

/**
 * Hard-deletes an incident and its participant records (cascade handles junction table).
 */
export async function deleteIncident(id: string): Promise<void> {
  await rawPrisma.eventIncident.delete({
    where: { id },
  })
}

/**
 * Batch create for offline sync. Sets syncedAt to now().
 * Returns { synced: number }.
 */
export async function syncOfflineIncidents(
  incidents: Omit<CreateIncidentInput, 'syncedAt'>[],
): Promise<{ synced: number }> {
  let synced = 0

  for (const incidentData of incidents) {
    await createIncident({
      ...incidentData,
      syncedAt: new Date(),
    })
    synced++
  }

  return { synced }
}
