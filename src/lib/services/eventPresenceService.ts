/**
 * Event Presence Service
 *
 * DB-backed heartbeat for tracking which staff are currently viewing an event project.
 * Real-time push is handled by Supabase Realtime channels in the UI (Plan 07).
 * This service provides the persistence layer: upsert on heartbeat, query for active users.
 */

import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { EventPresenceSessionWithUser } from '@/lib/types/events-phase21'

const log = logger.child({ service: 'eventPresenceService' })

// Active threshold: sessions seen in the last 2 minutes are considered active
const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Upsert a presence session for a user on an event project.
 * Sets lastSeenAt to now and optionally records the active tab.
 * Uses the org-scoped Prisma client (called from authenticated routes).
 */
export async function updatePresence(
  eventProjectId: string,
  userId: string,
  activeTab?: string,
): Promise<void> {
  try {
    await prisma.eventPresenceSession.upsert({
      where: {
        eventProjectId_userId: { eventProjectId, userId },
      } as any,
      create: {
        eventProjectId,
        userId,
        activeTab: activeTab ?? null,
        lastSeenAt: new Date(),
      } as any,
      update: {
        activeTab: activeTab ?? null,
        lastSeenAt: new Date(),
      } as any,
    })
  } catch (err) {
    log.error({ err, eventProjectId, userId }, 'Failed to update presence session')
  }
}

/**
 * Return presence sessions for an event project where lastSeenAt is within
 * the active threshold (2 minutes). Includes user display info.
 */
export async function getActiveUsers(
  eventProjectId: string,
): Promise<EventPresenceSessionWithUser[]> {
  const threshold = new Date(Date.now() - ACTIVE_THRESHOLD_MS)

  const sessions = await prisma.eventPresenceSession.findMany({
    where: {
      eventProjectId,
      lastSeenAt: { gte: threshold },
    } as any,
    orderBy: { lastSeenAt: 'desc' },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  }) as any[]

  return sessions.map(shapeSession)
}

/**
 * Remove a presence session when the user navigates away or closes the tab.
 */
export async function removePresence(
  eventProjectId: string,
  userId: string,
): Promise<void> {
  try {
    await prisma.eventPresenceSession.delete({
      where: {
        eventProjectId_userId: { eventProjectId, userId },
      } as any,
    })
  } catch {
    // Session may not exist — silently ignore
  }
}

// ─── Internal Shaping ─────────────────────────────────────────────────────────

function shapeSession(row: any): EventPresenceSessionWithUser {
  return {
    id: row.id,
    eventProjectId: row.eventProjectId,
    userId: row.userId,
    userName: row.user
      ? `${row.user.firstName} ${row.user.lastName}`.trim()
      : 'Unknown',
    userAvatar: row.user?.avatar ?? null,
    activeTab: row.activeTab ?? null,
    lastSeenAt: row.lastSeenAt.toISOString(),
  }
}
