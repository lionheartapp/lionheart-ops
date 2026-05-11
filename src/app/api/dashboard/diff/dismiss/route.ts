import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { rawPrisma } from '@/lib/db'
import { z } from 'zod'

const dismissSchema = z.object({
  diffEventIds: z.array(z.string()).min(1).max(100),
})

/**
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

      // Verify these events belong to this org (security check)
      const validEvents = await rawPrisma.diffEvent.findMany({
        where: {
          id: { in: diffEventIds },
          organizationId: orgId,
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
