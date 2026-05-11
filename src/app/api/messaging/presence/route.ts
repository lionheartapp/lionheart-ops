import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { ok } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'

// POST /api/messaging/presence — heartbeat to update lastActiveAt
export const POST = withAuth(async ({ ctx }) => {
  await rawPrisma.user.update({
    where: { id: ctx.userId },
    data: { lastActiveAt: new Date() },
  })
  return NextResponse.json(ok({ ok: true }))
})
