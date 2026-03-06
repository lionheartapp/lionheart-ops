import Dexie, { type Table } from 'dexie'

export interface OfflineTicket {
  id?: number           // Dexie auto-increment PK
  ticketId: string      // Server-side ID (or temp ID for new tickets)
  organizationId: string
  assignedToId: string
  ticketNumber: string
  title: string
  status: string
  category: string
  priority: string
  buildingId?: string
  areaId?: string
  roomId?: string
  pmChecklistItems?: string[]
  pmChecklistDone?: boolean[]
  assetId?: string
  photos: string[]      // Cached photo URLs or local blob URLs
  cachedAt: Date
  isLocalOnly: boolean  // true for tickets created offline (not yet synced)
}

export interface MutationQueueEntry {
  id?: number           // Dexie auto-increment PK
  type: 'TICKET_CREATE' | 'STATUS_UPDATE' | 'LABOR_LOG' | 'COST_LOG' | 'CHECKLIST_TOGGLE' | 'COMMENT_ADD'
  ticketId: string      // Server ID or temp ID (temp IDs start with 'temp-')
  payload: Record<string, unknown>
  status: 'pending' | 'syncing' | 'failed'
  retryCount: number
  createdAt: Date
  error?: string
}

export interface CachedAsset {
  id?: number
  assetId: string
  organizationId: string
  assetNumber: string
  name: string
  category?: string
  buildingId?: string
  areaId?: string
  roomId?: string
  cachedAt: Date
}

class OfflineDatabase extends Dexie {
  offlineTickets!: Table<OfflineTicket>
  mutationQueue!: Table<MutationQueueEntry>
  cachedAssets!: Table<CachedAsset>

  constructor() {
    super('lionheart-offline-v1')
    this.version(1).stores({
      offlineTickets: '++id, ticketId, organizationId, assignedToId, status, cachedAt',
      mutationQueue: '++id, type, ticketId, status, createdAt',
      cachedAssets: '++id, assetId, organizationId, assetNumber',
    })
  }
}

export const db = new OfflineDatabase()
