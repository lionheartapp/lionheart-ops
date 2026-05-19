import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { ok, fail } from '@/lib/api-response'
import { checkAvailability } from '@/lib/services/facilityBookingService'

const QuerySchema = z.object({
  spaceId: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  setupMinutes: z.coerce.number().int().min(0).max(120).optional(),
  teardownMinutes: z.coerce.number().int().min(0).max(120).optional(),
  excludeEventId: z.string().optional(),
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

    const { spaceId, startTime, endTime, setupMinutes, teardownMinutes, excludeEventId } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      const result = await checkAvailability({
        spaceId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        setupMinutes,
        teardownMinutes,
        excludeEventId,
        includeAlternatives: true,
      })

      return NextResponse.json(ok(result))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
