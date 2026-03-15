'use client'

/**
 * useCheckIn — hook for day-of check-in operations with online/offline support.
 *
 * When online: makes API calls directly.
 * When offline: writes to Dexie eventCheckInQueue and serves counter/list from cache.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { eventDb } from '@/lib/offline/event-db'
import { syncAll, cacheRoster, getCachedParticipant } from '@/lib/offline/event-sync'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckInCounterData {
  checkedIn: number
  total: number
}

export interface ParticipantStatusEntry {
  registrationId: string
  firstName: string
  lastName: string
  photoUrl: string | null
  grade: string | null
  isCheckedIn: boolean
  checkedInAt: Date | null
  checkedInByName: string | null
}

export interface CheckInResult {
  alreadyCheckedIn: boolean
  participant: {
    registrationId: string
    firstName: string
    lastName: string
    photoUrl: string | null
    grade: string | null
    groups: Array<{ id: string; name: string; type: string }>
    medical?: { allergies: string[]; medications: string[] } | null
    checkInStatus: { isCheckedIn: boolean; checkedInAt: string | null }
  } | null
  fromCache: boolean
}

export interface UseCheckInReturn {
  counter: CheckInCounterData
  checkInList: ParticipantStatusEntry[]
  isOnline: boolean
  pendingSync: number
  isLoading: boolean
  checkIn: (registrationId: string, method: 'QR_SCAN' | 'MANUAL') => Promise<CheckInResult>
  undoCheckIn: (registrationId: string) => Promise<void>
  syncNow: () => Promise<void>
  refreshList: () => Promise<void>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCheckIn(eventProjectId: string): UseCheckInReturn {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [counter, setCounter] = useState<CheckInCounterData>({ checkedIn: 0, total: 0 })
  const [checkInList, setCheckInList] = useState<ParticipantStatusEntry[]>([])
  const [pendingSync, setPendingSync] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const counterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const listIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Connectivity handlers ───────────────────────────────────────────

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Auto-sync when back online
      syncAll(eventProjectId).catch(() => {})
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [eventProjectId])

  // ─── Counter fetch ───────────────────────────────────────────────────

  const fetchCounter = useCallback(async () => {
    if (isOnline) {
      try {
        const res = await fetch(`/api/events/projects/${eventProjectId}/check-in`)
        if (res.ok) {
          const json = (await res.json()) as { ok: boolean; data: { checkedIn: number; total: number } }
          if (json.ok) setCounter(json.data)
        }
      } catch {
        // Fall through to offline mode
        await fetchOfflineCounter()
      }
    } else {
      await fetchOfflineCounter()
    }
  }, [eventProjectId, isOnline]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOfflineCounter = async () => {
    const [cachedTotal, pendingCheckIns] = await Promise.all([
      eventDb.cachedParticipants.where('eventProjectId').equals(eventProjectId).count(),
      eventDb.eventCheckInQueue
        .where('eventProjectId')
        .equals(eventProjectId)
        .filter((e) => e.status === 'pending')
        .count(),
    ])

    const cachedCheckedIn = await eventDb.cachedParticipants
      .where('eventProjectId')
      .equals(eventProjectId)
      .filter((p) => p.isCheckedIn)
      .count()

    setCounter({ checkedIn: cachedCheckedIn + pendingCheckIns, total: cachedTotal })
  }

  // ─── Full list fetch ─────────────────────────────────────────────────

  const fetchList = useCallback(async () => {
    if (isOnline) {
      try {
        const res = await fetch(`/api/events/projects/${eventProjectId}/check-in?full=true`)
        if (res.ok) {
          const json = (await res.json()) as {
            ok: boolean
            data: {
              items: Array<{
                registrationId: string
                firstName: string
                lastName: string
                photoUrl: string | null
                grade: string | null
                isCheckedIn: boolean
                checkedInAt: string | null
                checkedInByName: string | null
              }>
            }
          }
          if (json.ok && json.data?.items) {
            setCheckInList(
              json.data.items.map((item) => ({
                ...item,
                checkedInAt: item.checkedInAt ? new Date(item.checkedInAt) : null,
              }))
            )
          }
        }
      } catch {
        await fetchOfflineList()
      }
    } else {
      await fetchOfflineList()
    }
  }, [eventProjectId, isOnline]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOfflineList = async () => {
    const [cached, pending] = await Promise.all([
      eventDb.cachedParticipants.where('eventProjectId').equals(eventProjectId).toArray(),
      eventDb.eventCheckInQueue
        .where('eventProjectId')
        .equals(eventProjectId)
        .filter((e) => e.status === 'pending')
        .toArray(),
    ])

    // Build set of registrationIds in pending queue
    const pendingSet = new Set(pending.map((e) => e.registrationId))

    const list: ParticipantStatusEntry[] = cached.map((p) => ({
      registrationId: p.registrationId,
      firstName: p.firstName,
      lastName: p.lastName,
      photoUrl: p.photoUrl,
      grade: p.grade,
      isCheckedIn: p.isCheckedIn || pendingSet.has(p.registrationId),
      checkedInAt: p.isCheckedIn ? p.checkedInAt : null,
      checkedInByName: null,
    }))

    // Sort: checked-in first
    list.sort((a, b) => {
      if (a.isCheckedIn && !b.isCheckedIn) return -1
      if (!a.isCheckedIn && b.isCheckedIn) return 1
      return 0
    })

    setCheckInList(list)
  }

  // ─── Pending sync count ──────────────────────────────────────────────

  const refreshPendingCount = useCallback(async () => {
    const count = await eventDb.eventCheckInQueue
      .filter((e) => e.status === 'pending')
      .count()
    setPendingSync(count)
  }, [])

  // ─── Initial load and polling ────────────────────────────────────────

  useEffect(() => {
    setIsLoading(true)
    Promise.all([fetchCounter(), fetchList(), refreshPendingCount()]).finally(() =>
      setIsLoading(false)
    )

    // Poll counter every 5s when online
    counterIntervalRef.current = setInterval(() => {
      fetchCounter()
      refreshPendingCount()
    }, 5_000)

    // Poll list every 10s when online
    listIntervalRef.current = setInterval(() => {
      fetchList()
    }, 10_000)

    return () => {
      if (counterIntervalRef.current) clearInterval(counterIntervalRef.current)
      if (listIntervalRef.current) clearInterval(listIntervalRef.current)
    }
  }, [fetchCounter, fetchList, refreshPendingCount])

  // ─── Actions ─────────────────────────────────────────────────────────

  const checkIn = useCallback(
    async (registrationId: string, method: 'QR_SCAN' | 'MANUAL'): Promise<CheckInResult> => {
      if (isOnline) {
        try {
          const res = await fetch(`/api/events/projects/${eventProjectId}/check-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registrationId, method }),
          })

          if (res.ok) {
            const json = (await res.json()) as {
              ok: boolean
              data: {
                alreadyCheckedIn: boolean
                participant: {
                  registrationId: string
                  firstName: string
                  lastName: string
                  photoUrl: string | null
                  grade: string | null
                  groups: Array<{ id: string; name: string; type: string }>
                  medical?: { allergies: string[]; medications: string[] } | null
                  checkInStatus: { isCheckedIn: boolean; checkedInAt: string | null }
                }
              }
            }
            if (json.ok) {
              void fetchCounter()
              return { ...json.data, fromCache: false }
            }
          }
        } catch {
          // Fall through to offline path
        }
      }

      // Offline path: write to queue, look up from cache
      await eventDb.eventCheckInQueue.add({
        registrationId,
        eventProjectId,
        checkedInAt: new Date(),
        method,
        status: 'pending',
      })

      const cached = await getCachedParticipant(registrationId)

      let groups: Array<{ id: string; name: string; type: string }> = []
      if (cached) {
        try {
          groups = JSON.parse(cached.groups) as Array<{ id: string; name: string; type: string }>
        } catch {
          groups = []
        }
      }

      await refreshPendingCount()
      void fetchCounter()

      return {
        alreadyCheckedIn: cached?.isCheckedIn ?? false,
        fromCache: true,
        participant: cached
          ? {
              registrationId: cached.registrationId,
              firstName: cached.firstName,
              lastName: cached.lastName,
              photoUrl: cached.photoUrl,
              grade: cached.grade,
              groups,
              medical: null,
              checkInStatus: { isCheckedIn: true, checkedInAt: new Date().toISOString() },
            }
          : null,
      }
    },
    [eventProjectId, isOnline, fetchCounter, refreshPendingCount]
  )

  const undoCheckIn = useCallback(
    async (registrationId: string): Promise<void> => {
      if (isOnline) {
        await fetch(`/api/events/projects/${eventProjectId}/check-in/${registrationId}`, {
          method: 'DELETE',
        })
        void fetchCounter()
        void fetchList()
        return
      }

      // Offline undo: remove from pending queue if present
      await eventDb.eventCheckInQueue
        .where('registrationId')
        .equals(registrationId)
        .filter((e) => e.eventProjectId === eventProjectId && e.status === 'pending')
        .delete()

      await refreshPendingCount()
      void fetchCounter()
    },
    [eventProjectId, isOnline, fetchCounter, fetchList, refreshPendingCount]
  )

  const syncNow = useCallback(async () => {
    if (!isOnline) return
    await syncAll(eventProjectId)
    await Promise.all([fetchCounter(), fetchList(), refreshPendingCount()])
  }, [eventProjectId, isOnline, fetchCounter, fetchList, refreshPendingCount])

  const refreshList = useCallback(async () => {
    await fetchList()
  }, [fetchList])

  return {
    counter,
    checkInList,
    isOnline,
    pendingSync,
    isLoading,
    checkIn,
    undoCheckIn,
    syncNow,
    refreshList,
  }
}
