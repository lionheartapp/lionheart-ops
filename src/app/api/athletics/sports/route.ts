import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getSports, createSport } from '@/lib/services/athleticsService'

const CreateSportSchema = z.object({
  name: z.string().trim().min(1).max(100),
  abbreviation: z.string().trim().max(10).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  seasonType: z.enum(['FALL', 'WINTER', 'SPRING', 'YEAR_ROUND']).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_READ)

    return await runWithOrgContext(orgId, async () => {
      const sports = await getSports({ isActive: true })
      return NextResponse.json(ok(sports))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch sports'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const input = CreateSportSchema.parse(body)
      const sport = await createSport(input)
      return NextResponse.json(ok(sport), { status: 201 })
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
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create sport'), { status: 500 })
  }
}
