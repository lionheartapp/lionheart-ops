'use client'

import type { ReactNode } from 'react'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import type { MutationQueueEntry } from '@/lib/offline/db'

type MutationType = MutationQueueEntry['type']

interface OfflineEnqueueFn {
  <T>(
    type: MutationType,
    ticketId: string,
    payload: Record<string, unknown>,
    apiFn: () => Promise<T>
  ): Promise<T | undefined>
}

interface TicketDetailOfflineWrapperProps {
  ticketId: string
  children: (props: { offlineEnqueue: OfflineEnqueueFn; isOnline: boolean }) => ReactNode
}

/**
 * Render-prop wrapper that provides offline-aware mutation capability to
 * ticket detail action components (status update, labor log, checklist toggle).
 *
 * When online: offlineEnqueue passes through to the provided apiFn directly.
 * When offline: offlineEnqueue stores the mutation in IndexedDB and returns undefined.
 *
 * Usage:
 *   <TicketDetailOfflineWrapper ticketId={ticketId}>
 *     {({ offlineEnqueue, isOnline }) => (
 *       <button onClick={() => offlineEnqueue('STATUS_UPDATE', ticketId, { status }, apiCall)}>
 *         Update Status{!isOnline && ' (will sync when online)'}
 *       </button>
 *     )}
 *   </TicketDetailOfflineWrapper>
 */
export default function TicketDetailOfflineWrapper({
  ticketId: _ticketId,
  children,
}: TicketDetailOfflineWrapperProps) {
  const { isOnline, enqueue } = useOfflineQueue()

  return <>{children({ offlineEnqueue: enqueue, isOnline })}</>
}
