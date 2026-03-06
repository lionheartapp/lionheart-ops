'use client'

import { useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/offline/db'
import { enqueueOfflineMutation } from '@/lib/offline/queue'
import { syncOfflineData, type SyncResult } from '@/lib/offline/sync'
import { useConnectivity } from './useConnectivity'
import type { MutationQueueEntry } from '@/lib/offline/db'

type MutationType = MutationQueueEntry['type']

function getAuthToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
}

/**
 * Offline-aware mutation hook for maintenance operations.
 *
 * When online: calls the provided apiFn directly.
 * When offline: enqueues the mutation in IndexedDB and returns a synthetic success.
 *
 * Usage:
 *   const { isOnline, queueCount, enqueue, isSyncing } = useOfflineQueue()
 *   await enqueue('STATUS_UPDATE', ticketId, { status: 'IN_PROGRESS' }, () => apiCall())
 */
export function useOfflineQueue() {
  const isOnline = useConnectivity()
  const queryClient = useQueryClient()
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)

  // Live reactive count of queued mutations — updates automatically
  const queueCount = useLiveQuery<number, number>(
    () => db.mutationQueue.count(),
    [],
    0
  )

  /**
   * Enqueue or directly apply a mutation.
   *
   * @param type - The mutation type (e.g. 'STATUS_UPDATE')
   * @param ticketId - The ticket's server ID or temp ID
   * @param payload - The mutation payload
   * @param apiFn - The async function that calls the API directly (used when online)
   * @returns The result of apiFn when online, or undefined when queued offline
   */
  const enqueue = useCallback(
    async <T>(
      type: MutationType,
      ticketId: string,
      payload: Record<string, unknown>,
      apiFn: () => Promise<T>
    ): Promise<T | undefined> => {
      if (isOnline) {
        // Online path: call the API directly
        return apiFn()
      }

      // Offline path: enqueue for later sync
      await enqueueOfflineMutation({
        type,
        ticketId,
        payload,
        createdAt: new Date(),
      })

      // Return undefined — callers should handle this as a queued success
      return undefined
    },
    [isOnline]
  )

  /**
   * Manually trigger a sync of all queued mutations.
   * Normally called automatically when the 'online' event fires in DashboardLayout.
   */
  const triggerSync = useCallback(async (): Promise<SyncResult | null> => {
    const token = getAuthToken()
    if (!token || !isOnline) return null

    setIsSyncing(true)
    try {
      const result = await syncOfflineData(queryClient, token)
      setLastSyncResult(result)
      return result
    } finally {
      setIsSyncing(false)
    }
  }, [isOnline, queryClient])

  return {
    isOnline,
    queueCount: queueCount ?? 0,
    enqueue,
    isSyncing,
    triggerSync,
    lastSyncResult,
  }
}
