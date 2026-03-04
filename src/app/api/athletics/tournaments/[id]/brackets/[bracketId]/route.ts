import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { setMatchWinner, clearMatchResult } from '@/lib/services/athleticsService'

const UpdateBracketSchema = z.union([
  z.object({ winnerId: z.string().min(1) }),
  z.object({ clear: z.literal(true) }),
])

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; bracketId: string }> },
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const body = await req.json()
    await assertCan(ctx.userId, PERMISSIONS.ATHLETICS_TOURNAMENTS_MANAGE)
    const { bracketId } = await params

    return await runWithOrgContext(orgId, async () => {
      const input = UpdateBracketSchema.parse(body)

      if ('clear' in input) {
        const result = await clearMatchResult(bracketId)
        return NextResponse.json(ok(result))
      }

      const bracket = await setMatchWinner(bracketId, input.winnerId)
      return NextResponse.json(ok(bracket))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update match result'), { status: 500 })
  }
}
