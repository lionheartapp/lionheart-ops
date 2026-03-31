import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { setMatchWinner, clearMatchResult } from '@/lib/services/athleticsService'

const UpdateBracketSchema = z.union([
  z.object({ winnerId: z.string().min(1) }),
  z.object({ clear: z.literal(true) }),
])

export const PUT = withAuth(async ({ params, body }) => {
  if ('clear' in body) {
    const result = await clearMatchResult(params.bracketId)
    return NextResponse.json(ok(result))
  }

  const bracket = await setMatchWinner(params.bracketId, body.winnerId)
  return NextResponse.json(ok(bracket))
}, { permission: PERMISSIONS.ATHLETICS_TOURNAMENTS_MANAGE, schema: UpdateBracketSchema })
