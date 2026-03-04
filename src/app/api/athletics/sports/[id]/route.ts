import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { updateSport } from '@/lib/services/athleticsService'

const UpdateSportSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  abbreviation: z.string().trim().max(10).nullable().optional(),
  color: z.string().optional(),
  seasonType: z.enum(['FALL', 'WINTER', 'SPRING', 'YEAR_ROUND']).optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_MANAGE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = UpdateSportSchema.parse(body)
      const sport = await updateSport(id, input)
      return NextResponse.json(ok(sport))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error && typeof error === 'object' && 'code' in error && (error as any).code === 'P2002') {
      return NextResponse.json(fail('VALIDATION_ERROR', 'A sport with that name already exists'), { status: 409 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update sport'), { status: 500 })
  }
}
