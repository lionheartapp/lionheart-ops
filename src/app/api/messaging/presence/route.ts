import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { ok } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
// eslint-disable-next-line no-restricted-imports -- Presence heartbeat updates only the authenticated user's lastActiveAt with an orgId guard.
import { rawPrisma } from '@/lib/db'

// POST /api/messaging/presence — heartbeat to update lastActiveAt
export const POST = withAuth(async ({ ctx, orgId }) => {
  await rawPrisma.user.updateMany({
    where: {
      id: ctx.userId,
      organizationId: orgId,
      deletedAt: null,
    },
    data: { lastActiveAt: new Date() },
  })
  return NextResponse.json(ok({ ok: true }))
}, { permission: PERMISSIONS.MESSAGING_ACCESS })
