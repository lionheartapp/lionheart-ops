import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { ok, fail } from '@/lib/api-response'
import { checkBulkAvailability } from '@/lib/services/facilityBookingService'

const BodySchema = z.object({
  spaceId: z.string().min(1),
  slots: z
    .array(
      z.object({
        startTime: z.string().datetime(),
        endTime: z.string().datetime(),
      }),
    )
    .min(1)
    .max(200),
  setupMinutes: z.number().int().min(0).max(120).optional(),
  teardownMinutes: z.number().int().min(0).max(120).optional(),
  excludeEventId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FACILITIES_VIEW_SCHEDULE)

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten().fieldErrors),
        { status: 400 },
      )
    }

    const { spaceId, slots, setupMinutes, teardownMinutes, excludeEventId } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      const results = await checkBulkAvailability({
        spaceId,
        slots: slots.map((s) => ({
          startTime: new Date(s.startTime),
          endTime: new Date(s.endTime),
        })),
        setupMinutes,
        teardownMinutes,
        excludeEventId,
      })

      return NextResponse.json(ok({ results }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('Maximum 200 slots')) {
      return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
