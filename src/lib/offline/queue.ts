import { db, type MutationQueueEntry } from './db'

export type { MutationQueueEntry }

/**
 * Enqueue an offline mutation. Sets status='pending' and retryCount=0 automatically.
 */
export async function enqueueOfflineMutation(
  entry: Omit<MutationQueueEntry, 'id' | 'status' | 'retryCount'>
): Promise<number> {
  return db.mutationQueue.add({
    ...entry,
    status: 'pending',
    retryCount: 0,
  })
}

/**
 * Returns all pending + syncing + failed mutations ordered by createdAt ascending.
 */
export async function getPendingMutations(): Promise<MutationQueueEntry[]> {
  return db.mutationQueue.orderBy('createdAt').toArray()
}

/**
 * Mark a mutation as currently being synced.
 */
export async function markMutationSyncing(id: number): Promise<void> {
  await db.mutationQueue.update(id, { status: 'syncing' })
}

/**
 * Mark a mutation as failed, increment retryCount, and store error message.
 */
export async function markMutationFailed(id: number, error: string): Promise<void> {
  const entry = await db.mutationQueue.get(id)
  if (!entry) return
  await db.mutationQueue.update(id, {
    status: 'failed',
    retryCount: (entry.retryCount ?? 0) + 1,
    error,
  })
}

/**
 * Remove a mutation from the queue after successful sync.
 */
export async function deleteMutation(id: number): Promise<void> {
  await db.mutationQueue.delete(id)
}

/**
 * Get total count of all queued mutations (pending + syncing + failed).
 */
export async function getQueueCount(): Promise<number> {
  return db.mutationQueue.count()
}

/**
 * Update all queue entries that reference a temp ticketId to use the real server ID.
 * Called after a TICKET_CREATE mutation syncs successfully.
 */
export async function updateTempIdReferences(tempId: string, realId: string): Promise<void> {
  const entries = await db.mutationQueue.where('ticketId').equals(tempId).toArray()
  for (const entry of entries) {
    if (entry.id !== undefined) {
      await db.mutationQueue.update(entry.id, { ticketId: realId })
    }
  }
  // Also update the cached offline ticket record
  const offlineTickets = await db.offlineTickets.where('ticketId').equals(tempId).toArray()
  for (const ticket of offlineTickets) {
    if (ticket.id !== undefined) {
      await db.offlineTickets.update(ticket.id, { ticketId: realId, isLocalOnly: false })
    }
  }
}
