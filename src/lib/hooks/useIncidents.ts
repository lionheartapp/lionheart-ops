'use client'

/**
 * useIncidents — hook for day-of incident logging with online/offline support.
 *
 * When online: makes API calls directly.
 * When offline: writes to Dexie eventIncidentQueue and merges pending into the list.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { eventDb } from '@/lib/offline/event-db'
import type { EventIncidentWithParticipants, EventIncidentType, EventIncidentSeverity } from '@/lib/types/events-phase21'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateIncidentData {
  type: EventIncidentType
  severity: EventIncidentSeverity
  description: string
  actionsTaken?: string
  followUpNeeded?: boolean
  followUpNotes?: string
  photoUrl?: string
  participantIds?: string[]
}

export interface OfflineIncident extends CreateIncidentData {
  id: string             // local Dexie id prefixed with 'offline-'
  eventProjectId: string
  reporterName: string
  createdAt: string
  isPendingSync: boolean
}

export type IncidentListItem = EventIncidentWithParticipants | OfflineIncident

export interface UseIncidentsReturn {
  incidents: IncidentListItem[]
  pendingSync: number
  isOnline: boolean
  isLoading: boolean
  createIncident: (data: CreateIncidentData) => Promise<{ success: boolean; offline: boolean }>
  refreshIncidents: () => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIncidents(eventProjectId: string): UseIncidentsReturn {
  const [incidents, setIncidents] = useState<IncidentListItem[]>([])
  const [pendingSync, setPendingSync] = useState(0)
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [isLoading, setIsLoading] = useState(false)

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Connectivity ────────────────────────────────────────────────────

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ─── Fetch incidents ─────────────────────────────────────────────────

  const fetchIncidents = useCallback(async () => {
    let serverIncidents: EventIncidentWithParticipants[] = []

    if (isOnline) {
      try {
        const res = await fetch(`/api/events/projects/${eventProjectId}/incidents`)
        if (res.ok) {
          const json = (await res.json()) as { ok: boolean; data: EventIncidentWithParticipants[] }
          if (json.ok) serverIncidents = json.data
        }
      } catch {
        // Use empty list + offline queue
      }
    }

    // Fetch pending offline incidents
    const pendingOffline = await eventDb.eventIncidentQueue
      .where('eventProjectId')
      .equals(eventProjectId)
      .filter((e) => e.status === 'pending')
      .toArray()

    const offlineItems: OfflineIncident[] = pendingOffline.map((entry) => {
      let participantIds: string[] = []
      try {
        participantIds = JSON.parse(entry.participantIds) as string[]
      } catch {
        participantIds = []
      }

      return {
        id: `offline-${entry.id ?? ''}`,
        eventProjectId: entry.eventProjectId,
        type: entry.type,
        severity: entry.severity,
        description: entry.description,
        actionsTaken: entry.actionsTaken ?? undefined,
        followUpNeeded: entry.followUpNeeded,
        followUpNotes: entry.followUpNotes ?? undefined,
        photoUrl: entry.photoUrl ?? undefined,
        participantIds,
        reporterName: 'You (offline)',
        createdAt: entry.reportedAt.toISOString(),
        isPendingSync: true,
      }
    })

    setPendingSync(offlineItems.length)

    // Merge: offline items at top, then server incidents
    setIncidents([...offlineItems, ...serverIncidents])
  }, [eventProjectId, isOnline])

  // ─── Initial load and polling ────────────────────────────────────────

  useEffect(() => {
    setIsLoading(true)
    fetchIncidents().finally(() => setIsLoading(false))

    // Poll every 30s when online
    pollIntervalRef.current = setInterval(() => {
      fetchIncidents()
    }, 30_000)

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [fetchIncidents])

  // ─── Create incident ─────────────────────────────────────────────────

  const createIncident = useCallback(
    async (data: CreateIncidentData): Promise<{ success: boolean; offline: boolean }> => {
      if (isOnline) {
        try {
          const res = await fetch(`/api/events/projects/${eventProjectId}/incidents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...data,
              participantIds: data.participantIds ?? [],
            }),
          })

          if (res.ok) {
            void fetchIncidents()
            return { success: true, offline: false }
          }
        } catch {
          // Fall through to offline path
        }
      }

      // Offline path: save to Dexie
      await eventDb.eventIncidentQueue.add({
        eventProjectId,
        type: data.type,
        severity: data.severity,
        description: data.description,
        actionsTaken: data.actionsTaken ?? null,
        followUpNeeded: data.followUpNeeded ?? false,
        followUpNotes: data.followUpNotes ?? null,
        photoUrl: data.photoUrl ?? null,
        participantIds: JSON.stringify(data.participantIds ?? []),
        reportedAt: new Date(),
        status: 'pending',
      })

      void fetchIncidents()
      return { success: true, offline: true }
    },
    [eventProjectId, isOnline, fetchIncidents]
  )

  const refreshIncidents = useCallback(async () => {
    await fetchIncidents()
  }, [fetchIncidents])

  return {
    incidents,
    pendingSync,
    isOnline,
    isLoading,
    createIncident,
    refreshIncidents,
  }
}
