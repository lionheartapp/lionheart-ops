import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
// eslint-disable-next-line no-restricted-imports -- DiffEventHandled has a compound user/event key; route verifies DiffEvent organizationId before writing handled rows.
import { rawPrisma } from '@/lib/db'
import { getUserTeams } from '@/lib/auth/permissions'
import { z } from 'zod'

const dismissSchema = z.object({
  diffEventIds: z.array(z.string()).min(1).max(100),
})

/**
 * @authOnly Dismisses only diff events targeted to the signed-in user or one of their teams.
 *
 * POST /api/dashboard/diff/dismiss
 *
 * Mark diff events as handled for the current user.
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const body = await req.json()
    const parsed = dismissSchema.safeParse(body)
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

      // Verify these events belong to this org and are actually visible to this user.
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
        return NextResponse.json(ok({ dismissed: 0 }))
      }

      // Upsert handled rows (skipDuplicates handles idempotency)
      await rawPrisma.diffEventHandled.createMany({
        data: validIds.map((id) => ({
          diffEventId: id,
          userId: ctx.userId,
          method: 'dismissed',
        })),
        skipDuplicates: true,
      })

      return NextResponse.json(ok({ dismissed: validIds.length }))
    })
  } catch (error) {
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to dismiss'),
      { status: 500 }
    )
  }
}
