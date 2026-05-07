import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import {
  findOrCreateDM,
  FindOrCreateDMSchema,
} from '@/lib/services/channelService'

// POST /api/messaging/dms — find or create a DM/group DM
// Returns 200 (not 201) because it may return an existing channel
export const POST = withAuth(async ({ ctx, orgId, body }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked
  const channel = await findOrCreateDM(ctx.userId, body.userIds)
  return NextResponse.json(ok(channel))
}, { permission: PERMISSIONS.MESSAGING_DMS_SEND, schema: FindOrCreateDMSchema })
