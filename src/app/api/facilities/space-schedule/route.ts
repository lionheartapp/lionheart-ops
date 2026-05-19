import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { ok, fail } from '@/lib/api-response'
import { getSpaceSchedule } from '@/lib/services/facilityBookingService'

const QuerySchema = z.object({
  spaceId: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FACILITIES_VIEW_SCHEDULE)

    const params = Object.fromEntries(req.nextUrl.searchParams)
    const parsed = QuerySchema.safeParse(params)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid parameters', parsed.error.flatten().fieldErrors),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const result = await getSpaceSchedule({
        spaceId: parsed.data.spaceId,
        start: new Date(parsed.data.start),
        end: new Date(parsed.data.end),
      })

      return NextResponse.json(ok(result))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Space not found')) {
      return NextResponse.json(fail('NOT_FOUND', 'Space not found'), { status: 404 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
