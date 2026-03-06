import type { QueryClient } from '@tanstack/react-query'
import { db, type OfflineTicket, type CachedAsset, type MutationQueueEntry } from './db'
import {
  getPendingMutations,
  markMutationSyncing,
  markMutationFailed,
  deleteMutation,
  updateTempIdReferences,
} from './queue'

/**
 * Cache assigned tickets and assets to IndexedDB for offline access.
 * Should be called on login and on app load when online.
 */
export async function cacheAssignedTickets(
  authToken: string,
  organizationId: string,
  userId: string
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authToken}`,
  }

  try {
    // Fetch assigned tickets
    const ticketsRes = await fetch('/api/maintenance/tickets?assignedTo=me', { headers })
    if (ticketsRes.ok) {
      const ticketsData = await ticketsRes.json()
      if (ticketsData.ok && Array.isArray(ticketsData.data)) {
        const now = new Date()
        for (const ticket of ticketsData.data) {
          const offlineTicket: OfflineTicket = {
            ticketId: ticket.id,
            organizationId,
            assignedToId: userId,
            ticketNumber: ticket.ticketNumber ?? '',
            title: ticket.title ?? '',
            status: ticket.status ?? '',
            category: ticket.category ?? '',
            priority: ticket.priority ?? '',
            buildingId: ticket.buildingId ?? undefined,
            areaId: ticket.areaId ?? undefined,
            roomId: ticket.roomId ?? undefined,
            pmChecklistItems: ticket.pmChecklistItems ?? undefined,
            pmChecklistDone: ticket.pmChecklistDone ?? undefined,
            assetId: ticket.assetId ?? undefined,
            photos: ticket.photos ?? [],
            cachedAt: now,
            isLocalOnly: false,
          }

          // Upsert: update existing by ticketId, or insert new
          const existing = await db.offlineTickets
            .where('ticketId')
            .equals(ticket.id)
            .first()

          if (existing?.id !== undefined) {
            const { id: _id, ...updateFields } = offlineTicket as OfflineTicket & { id?: number }
            await db.offlineTickets.update(existing.id, updateFields)
          } else {
            await db.offlineTickets.add(offlineTicket)
          }
        }
      }
    }
  } catch {
    // Non-fatal — if caching fails, user just won't have offline access
    console.warn('[offline] Failed to cache tickets:', organizationId)
  }

  try {
    // Fetch and cache assets
    const assetsRes = await fetch('/api/maintenance/assets', { headers })
    if (assetsRes.ok) {
      const assetsData = await assetsRes.json()
      if (assetsData.ok && Array.isArray(assetsData.data)) {
        const now = new Date()
        for (const asset of assetsData.data) {
          const cachedAsset: CachedAsset = {
            assetId: asset.id,
            organizationId,
            assetNumber: asset.assetNumber ?? '',
            name: asset.name ?? '',
            category: asset.category ?? undefined,
            buildingId: asset.buildingId ?? undefined,
            areaId: asset.areaId ?? undefined,
            roomId: asset.roomId ?? undefined,
            cachedAt: now,
          }

          const existing = await db.cachedAssets
            .where('assetId')
            .equals(asset.id)
            .first()

          if (existing?.id !== undefined) {
            const { id: _id, ...updateFields } = cachedAsset as CachedAsset & { id?: number }
            await db.cachedAssets.update(existing.id, updateFields)
          } else {
            await db.cachedAssets.add(cachedAsset)
          }
        }
      }
    }
  } catch {
    // Non-fatal
    console.warn('[offline] Failed to cache assets:', organizationId)
  }
}

/**
 * Apply a single queued mutation against the live API.
 * Returns { newTicketId } if the mutation was a TICKET_CREATE.
 */
export async function applyMutation(
  mutation: MutationQueueEntry,
  authToken: string
): Promise<{ newTicketId?: string }> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  }

  const { type, ticketId, payload } = mutation

  switch (type) {
    case 'TICKET_CREATE': {
      const res = await fetch('/api/maintenance/tickets', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
      }
      const result = await res.json()
      return { newTicketId: result.data?.id }
    }

    case 'STATUS_UPDATE': {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      })
      // 409 = concurrent update; server wins — treat as success
      if (res.status === 409) return {}
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
      }
      return {}
    }

    case 'LABOR_LOG': {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}/labor`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
      }
      return {}
    }

    case 'COST_LOG': {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}/costs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
      }
      return {}
    }

    case 'CHECKLIST_TOGGLE': {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}/checklist`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
      }
      return {}
    }

    case 'COMMENT_ADD': {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}/activities`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type: 'COMMENT', ...payload }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
      }
      return {}
    }

    default:
      throw new Error(`Unknown mutation type: ${type}`)
  }
}

export interface SyncResult {
  succeeded: number
  failed: number
  errors: string[]
}

/**
 * Drain the mutation queue, replaying all pending mutations against the API.
 * Processes sequentially (order matters for status transitions).
 * Invalidates TanStack Query cache after all mutations are processed.
 */
export async function syncOfflineData(
  queryClient: QueryClient,
  authToken: string
): Promise<SyncResult> {
  const mutations = await getPendingMutations()

  let succeeded = 0
  let failed = 0
  const errors: string[] = []

  for (const mutation of mutations) {
    if (mutation.id === undefined) continue

    await markMutationSyncing(mutation.id)

    try {
      const result = await applyMutation(mutation, authToken)

      // If a TICKET_CREATE succeeded, update any subsequent mutations
      // that reference the temp ID so they use the real server ID
      if (mutation.type === 'TICKET_CREATE' && result.newTicketId) {
        await updateTempIdReferences(mutation.ticketId, result.newTicketId)
      }

      await deleteMutation(mutation.id)
      succeeded++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await markMutationFailed(mutation.id, message)
      errors.push(`${mutation.type}(${mutation.ticketId}): ${message}`)
      failed++
    }
  }

  // Invalidate TanStack Query caches to reflect server state
  queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] })
  queryClient.invalidateQueries({ queryKey: ['maintenance-my-tickets'] })
  queryClient.invalidateQueries({ queryKey: ['maintenance-assets'] })

  return { succeeded, failed, errors }
}
