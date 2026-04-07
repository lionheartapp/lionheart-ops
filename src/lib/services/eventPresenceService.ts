/**
 * Event Presence Service
 *
 * DB-backed heartbeat for tracking which staff are currently viewing an event project.
 * Real-time push is handled by Supabase Realtime channels in the UI (Plan 07).
 * This service provides the persistence layer: upsert on heartbeat, query for active users.
 */

import { prisma, type OrgPrismaClient } from '@/lib/db'
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
    const db = prisma as unknown as OrgPrismaClient
    await db.eventPresenceSession.upsert({
      where: {
        eventProjectId_userId: { eventProjectId, userId },
      },
      create: {
        eventProjectId,
        userId,
        activeTab: activeTab ?? null,
        lastSeenAt: new Date(),
      },
      update: {
        activeTab: activeTab ?? null,
        lastSeenAt: new Date(),
      },
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

  const db = prisma as unknown as OrgPrismaClient
  const sessions = await db.eventPresenceSession.findMany({
    where: {
      eventProjectId,
      lastSeenAt: { gte: threshold },
    },
    orderBy: { lastSeenAt: 'desc' },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, avatar: true },
      },
    },
  }) as Array<Record<string, unknown>>

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
    const db = prisma as unknown as OrgPrismaClient
    await db.eventPresenceSession.delete({
      where: {
        eventProjectId_userId: { eventProjectId, userId },
      },
    })
  } catch {
    // Session may not exist — silently ignore
  }
}

// ─── Internal Shaping ─────────────────────────────────────────────────────────

function shapeSession(row: Record<string, unknown>): EventPresenceSessionWithUser {
  const user = row.user as { firstName?: string; lastName?: string; avatar?: string } | null
  return {
    id: row.id as string,
    eventProjectId: row.eventProjectId as string,
    userId: row.userId as string,
    userName: user
      ? `${user.firstName} ${user.lastName}`.trim()
      : 'Unknown',
    userAvatar: user?.avatar ?? null,
    activeTab: (row.activeTab as string | null) ?? null,
    lastSeenAt: (row.lastSeenAt as Date).toISOString(),
  }
}
