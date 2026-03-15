/**
 * Event Offline Sync Module
 *
 * Handles syncing offline check-ins and incidents to the server when
 * connectivity is restored, and caching the participant roster for
 * offline use.
 *
 * Auto-registers an 'online' listener on import so the sync fires
 * automatically when the browser reconnects.
 */

import { eventDb, type CachedParticipant } from './event-db'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number
  failed: number
}

// ─── Check-In Sync ────────────────────────────────────────────────────────────

/**
 * Reads all pending check-ins from the queue and PUTs them to the server.
 * On success, marks each as 'synced'. On failure, marks as 'failed'.
 */
export async function syncCheckIns(eventProjectId: string): Promise<SyncResult> {
  const pending = await eventDb.eventCheckInQueue
    .where('eventProjectId')
    .equals(eventProjectId)
    .filter((e) => e.status === 'pending')
    .toArray()

  let synced = 0
  let failed = 0

  for (const entry of pending) {
    if (!entry.id) continue

    // Mark as syncing
    await eventDb.eventCheckInQueue.update(entry.id, { status: 'syncing' })

    try {
      const res = await fetch(`/api/events/projects/${eventProjectId}/check-in`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            registrationId: entry.registrationId,
            eventProjectId: entry.eventProjectId,
            checkedInAt: entry.checkedInAt,
            method: entry.method,
          },
        ]),
      })

      if (res.ok) {
        await eventDb.eventCheckInQueue.update(entry.id, { status: 'synced' })
        synced++
      } else {
        const errorText = await res.text().catch(() => 'Unknown error')
        await eventDb.eventCheckInQueue.update(entry.id, { status: 'failed', syncError: errorText })
        failed++
      }
    } catch (err) {
      await eventDb.eventCheckInQueue.update(entry.id, {
        status: 'failed',
        syncError: err instanceof Error ? err.message : 'Network error',
      })
      failed++
    }
  }

  return { synced, failed }
}

// ─── Incident Sync ────────────────────────────────────────────────────────────

/**
 * Reads all pending incidents from the queue and PUTs them to the server.
 * On success, marks each as 'synced'. On failure, marks as 'failed'.
 */
export async function syncIncidents(eventProjectId: string): Promise<SyncResult> {
  const pending = await eventDb.eventIncidentQueue
    .where('eventProjectId')
    .equals(eventProjectId)
    .filter((e) => e.status === 'pending')
    .toArray()

  let synced = 0
  let failed = 0

  for (const entry of pending) {
    if (!entry.id) continue

    // Mark as syncing
    await eventDb.eventIncidentQueue.update(entry.id, { status: 'syncing' })

    let participantIds: string[] = []
    try {
      participantIds = JSON.parse(entry.participantIds) as string[]
    } catch {
      participantIds = []
    }

    try {
      const res = await fetch(`/api/events/projects/${eventProjectId}/incidents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            eventProjectId: entry.eventProjectId,
            type: entry.type,
            severity: entry.severity,
            description: entry.description,
            actionsTaken: entry.actionsTaken,
            followUpNeeded: entry.followUpNeeded,
            followUpNotes: entry.followUpNotes,
            photoUrl: entry.photoUrl,
            participantIds,
            reportedAt: entry.reportedAt,
          },
        ]),
      })

      if (res.ok) {
        await eventDb.eventIncidentQueue.update(entry.id, { status: 'synced' })
        synced++
      } else {
        const errorText = await res.text().catch(() => 'Unknown error')
        await eventDb.eventIncidentQueue.update(entry.id, { status: 'failed', syncError: errorText })
        failed++
      }
    } catch (err) {
      await eventDb.eventIncidentQueue.update(entry.id, {
        status: 'failed',
        syncError: err instanceof Error ? err.message : 'Network error',
      })
      failed++
    }
  }

  return { synced, failed }
}

// ─── Roster Cache ─────────────────────────────────────────────────────────────

/**
 * Fetches the full participant roster from the API and stores it in
 * cachedParticipants for offline use. Should be called when online to
 * pre-populate the local cache.
 */
export async function cacheRoster(eventProjectId: string): Promise<void> {
  if (!navigator.onLine) return

  try {
    const res = await fetch(`/api/events/projects/${eventProjectId}/check-in?full=true`)
    if (!res.ok) return

    const json = (await res.json()) as {
      ok: boolean
      data: {
        items?: Array<{
          registrationId: string
          firstName: string
          lastName: string
          photoUrl: string | null
          grade: string | null
          groups: Array<{ id: string; name: string; type: string }>
          medicalFlags: { allergies: string[]; medications: string[] } | null
          isCheckedIn: boolean
          checkedInAt: string | null
        }>
      }
    }

    if (!json.ok || !json.data?.items) return

    const now = new Date()
    const entries: Omit<CachedParticipant, 'id'>[] = json.data.items.map((p) => ({
      registrationId: p.registrationId,
      eventProjectId,
      firstName: p.firstName,
      lastName: p.lastName,
      photoUrl: p.photoUrl,
      grade: p.grade,
      groups: JSON.stringify(p.groups),
      medicalFlags: p.medicalFlags ? JSON.stringify(p.medicalFlags) : 'null',
      isCheckedIn: p.isCheckedIn,
      checkedInAt: p.checkedInAt ? new Date(p.checkedInAt) : null,
      cachedAt: now,
    }))

    // Clear existing cache for this event and replace with fresh data
    await eventDb.cachedParticipants
      .where('eventProjectId')
      .equals(eventProjectId)
      .delete()

    await eventDb.cachedParticipants.bulkAdd(entries)
  } catch {
    // Non-fatal — online path is the fallback
  }
}

/**
 * Looks up a participant from the local cache by registrationId.
 * Returns the participant data or null if not found.
 */
export async function getCachedParticipant(registrationId: string): Promise<CachedParticipant | null> {
  const entry = await eventDb.cachedParticipants.where('registrationId').equals(registrationId).first()
  return entry ?? null
}

// ─── Combined Sync ────────────────────────────────────────────────────────────

/**
 * Syncs all pending check-ins and incidents for an event.
 * Called automatically on connectivity restore.
 */
export async function syncAll(eventProjectId: string): Promise<{ checkIns: SyncResult; incidents: SyncResult }> {
  const [checkIns, incidents] = await Promise.all([
    syncCheckIns(eventProjectId),
    syncIncidents(eventProjectId),
  ])
  return { checkIns, incidents }
}

/**
 * Returns count of pending (unsynced) check-ins and incidents across all events.
 */
export async function getPendingCount(): Promise<{ checkIns: number; incidents: number }> {
  const [checkIns, incidents] = await Promise.all([
    eventDb.eventCheckInQueue.filter((e) => e.status === 'pending').count(),
    eventDb.eventIncidentQueue.filter((e) => e.status === 'pending').count(),
  ])
  return { checkIns, incidents }
}
