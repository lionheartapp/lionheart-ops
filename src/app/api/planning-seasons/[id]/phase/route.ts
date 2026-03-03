import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { transitionPhase } from '@/lib/services/planningSeasonService'

const PhaseSchema = z.object({
  phase: z.enum(['SETUP', 'COLLECTING', 'REVIEWING', 'WAR_ROOM', 'FINALIZING', 'APPROVING', 'CLOSED']),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.PLANNING_MANAGE)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      const { phase } = PhaseSchema.parse(body)
      const season = await transitionPhase(id, phase)
      return NextResponse.json(ok(season))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Invalid phase transition')) {
      return NextResponse.json(fail('VALIDATION_ERROR', error.message), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to transition phase'), { status: 500 })
  }
}
