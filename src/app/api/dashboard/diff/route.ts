import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
// eslint-disable-next-line no-restricted-imports -- DiffEvent is a custom append-only audience log; every query below filters by organizationId and user/team audience.
import { rawPrisma } from '@/lib/db'
import { getUserTeams } from '@/lib/auth/permissions'
import { logger } from '@/lib/logger'
import { computeAnchorTime } from '@/lib/diff/anchor'
import { aggregateDiffEvents } from '@/lib/diff/aggregate'

/**
 * @authOnly Returns only changes targeted to the signed-in user or one of their teams.
 *
 * GET /api/dashboard/diff
 *
 * Returns the "since yesterday" diff for the current user.
 * Uses rawPrisma because DiffEvent audience filtering is custom
 * (not a simple org-scope — we filter by targetUserId + teamId).
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    return await runWithOrgContext(orgId, async () => {
      // Get org timezone
      const org = await rawPrisma.organization.findUnique({
        where: { id: orgId },
        select: { timezone: true },
      })
      const timezone = org?.timezone ?? 'America/Los_Angeles'

      // Compute anchor
      const anchor = computeAnchorTime(timezone)
      const anchorIso = anchor.toISOString()

      // Get user's team memberships for audience filtering
      const userTeamIds = await getUserTeams(ctx.userId)

      // Build audience filter
      const orConditions: Record<string, unknown>[] = [
        { targetUserId: ctx.userId },
      ]
      if (userTeamIds.length > 0) {
        orConditions.push({ teamId: { in: userTeamIds } })
      }

      // Query: events since anchor, not by me, targeting me or my teams
      const events = await rawPrisma.diffEvent.findMany({
        where: {
          organizationId: orgId,
          occurredAt: { gte: anchor },
          NOT: { actorUserId: ctx.userId },
          OR: orConditions,
        },
        include: {
          handledBy: { where: { userId: ctx.userId } },
        },
        orderBy: { occurredAt: 'desc' },
      })

      // Aggregate
      const { items, totals } = aggregateDiffEvents(events, ctx.userId, anchorIso)

      return NextResponse.json(
        ok({
          anchorTime: anchorIso,
          orgTimezone: timezone,
          asOf: new Date().toISOString(),
          items,
          totals,
        })
      )
    })
  } catch (error) {
    logger.error({ error: String(error), stack: error instanceof Error ? error.stack : undefined }, 'GET /api/dashboard/diff failed')
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to load diff'),
      { status: 500 }
    )
  }
}
