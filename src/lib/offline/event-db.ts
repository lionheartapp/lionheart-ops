/**
 * Event Day-Of Offline Database (Dexie)
 *
 * Separate from the maintenance offline db (lionheart-offline-v1) to
 * avoid version conflicts. Stores check-in queue, cached participants,
 * and incident queue for day-of operations.
 */

import Dexie, { type Table } from 'dexie'

// ─── Table Interfaces ─────────────────────────────────────────────────────────

export interface EventCheckInQueueEntry {
  id?: number                                    // Dexie auto-increment PK
  registrationId: string                         // server-side registration ID
  eventProjectId: string
  checkedInAt: Date                              // when the check-in happened offline
  method: 'QR_SCAN' | 'MANUAL'
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  syncError?: string
}

export interface CachedParticipant {
  id?: number                                    // Dexie auto-increment PK
  registrationId: string                         // server-side registration ID (unique index)
  eventProjectId: string
  firstName: string
  lastName: string
  photoUrl: string | null
  grade: string | null
  groups: string                                 // JSON: Array<{ id, name, type }>
  medicalFlags: string                           // JSON: { allergies: string[], medications: string[] } | null
  isCheckedIn: boolean
  checkedInAt: Date | null
  cachedAt: Date
}

export interface EventIncidentQueueEntry {
  id?: number                                    // Dexie auto-increment PK
  eventProjectId: string
  type: 'MEDICAL' | 'BEHAVIORAL' | 'SAFETY' | 'OTHER'
  severity: 'MINOR' | 'MODERATE' | 'SERIOUS'
  description: string
  actionsTaken: string | null
  followUpNeeded: boolean
  followUpNotes: string | null
  photoUrl: string | null
  participantIds: string                         // JSON: string[]
  reportedAt: Date
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  syncError?: string
}

// ─── Database Class ───────────────────────────────────────────────────────────

class EventDatabase extends Dexie {
  eventCheckInQueue!: Table<EventCheckInQueueEntry>
  cachedParticipants!: Table<CachedParticipant>
  eventIncidentQueue!: Table<EventIncidentQueueEntry>

  constructor() {
    super('lionheart-events-v1')
    this.version(1).stores({
      eventCheckInQueue: '++id, registrationId, eventProjectId, status, checkedInAt',
      cachedParticipants: '++id, &registrationId, eventProjectId, cachedAt',
      eventIncidentQueue: '++id, eventProjectId, status, reportedAt',
    })
  }
}

export const eventDb = new EventDatabase()
