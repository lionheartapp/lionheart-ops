import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
// eslint-disable-next-line no-restricted-imports -- DiffEventHandled has a compound user/event key; route verifies DiffEvent organizationId before removing handled rows.
import { rawPrisma } from '@/lib/db'
import { getUserTeams } from '@/lib/auth/permissions'
import { z } from 'zod'

const undismissSchema = z.object({
  diffEventIds: z.array(z.string()).min(1).max(100),
})

/**
 * @authOnly Restores only diff events targeted to the signed-in user or one of their teams.
 *
 * POST /api/dashboard/diff/undismiss
 *
 * Remove handled state for diff events (undo dismiss).
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const body = await req.json()
    const parsed = undismissSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const { diffEventIds } = parsed.data
      const userTeamIds = await getUserTeams(ctx.userId)
      const audienceFilter: Record<string, unknown>[] = [{ targetUserId: ctx.userId }]
      if (userTeamIds.length > 0) {
        audienceFilter.push({ teamId: { in: userTeamIds } })
      }

      // Only delete handled rows for events in this org and visible to this user.
      const validEvents = await rawPrisma.diffEvent.findMany({
        where: {
          id: { in: diffEventIds },
          organizationId: orgId,
          OR: audienceFilter,
        },
        select: { id: true },
      })
      const validIds = validEvents.map((e) => e.id)

      if (validIds.length === 0) {
        return NextResponse.json(ok({ undismissed: 0 }))
      }

      const result = await rawPrisma.diffEventHandled.deleteMany({
        where: {
          diffEventId: { in: validIds },
          userId: ctx.userId,
        },
      })

      return NextResponse.json(ok({ undismissed: result.count }))
    })
  } catch (error) {
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to undismiss'),
      { status: 500 }
    )
  }
}
