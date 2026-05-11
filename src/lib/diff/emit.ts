/**
 * DiffEvent emission helper.
 *
 * Fire-and-forget: a failed emission never blocks the underlying
 * business operation. Errors are logged, not thrown.
 */

import { rawPrisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { logger } from '@/lib/logger'

interface EmitDiffEventInput {
  organizationId: string
  resourceType: string
  resourceId: string
  changeType: string
  severity: 'critical' | 'high' | 'normal' | 'good'
  summary: string
  actorUserId?: string | null
  targetUserId?: string | null
  teamId?: string | null
  schoolId?: string | null
  buildingId?: string | null
  meta?: Record<string, unknown>
}

/**
 * Emit a single DiffEvent. Uses rawPrisma (unscoped) because the
 * organizationId is passed explicitly and we don't want this to
 * depend on AsyncLocalStorage context.
 */
export async function emitDiffEvent(input: EmitDiffEventInput): Promise<void> {
  // Don't emit when actor === target (my own action shown to me)
  if (
    input.actorUserId &&
    input.targetUserId &&
    input.actorUserId === input.targetUserId
  ) {
    return
  }

  try {
    await rawPrisma.diffEvent.create({
      data: {
        organizationId: input.organizationId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        changeType: input.changeType,
        severity: input.severity,
        summary: input.summary,
        actorUserId: input.actorUserId ?? null,
        targetUserId: input.targetUserId ?? null,
        teamId: input.teamId ?? null,
        schoolId: input.schoolId ?? null,
        buildingId: input.buildingId ?? null,
        meta: input.meta ? (input.meta as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    })
  } catch (err) {
    logger.error({ error: String(err), input }, 'Failed to emit DiffEvent')
  }
}

// ─── Severity mapping helpers ───────────────────────────────────────────────

const TICKET_PRIORITY_TO_SEVERITY: Record<string, 'critical' | 'high' | 'normal' | 'good'> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'normal',
}

export function ticketPriorityToSeverity(priority: string): 'critical' | 'high' | 'normal' | 'good' {
  return TICKET_PRIORITY_TO_SEVERITY[priority] ?? 'normal'
}
