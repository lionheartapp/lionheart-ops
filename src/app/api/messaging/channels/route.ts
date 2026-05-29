import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled, isMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getChannels,
  createChannel,
  CreateChannelSchema,
} from '@/lib/services/channelService'

// GET /api/messaging/channels — list channels visible to the user
export const GET = withAuth(async ({ ctx, orgId }) => {
  try {
    if (!(await isMessagingEnabled(orgId))) {
      return NextResponse.json(ok([]))
    }
    const channels = await getChannels(ctx.userId, orgId)
    return NextResponse.json(ok(channels))
  } catch (err) {
    console.error('[GET /api/messaging/channels] ERROR:', err)
    throw err
  }
}, { permission: PERMISSIONS.MESSAGING_ACCESS })

// POST /api/messaging/channels — create a new channel
export const POST = withAuth(async ({ ctx, orgId, body }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked
  const channel = await createChannel(body, ctx.userId)
  return NextResponse.json(ok(channel), { status: 201 })
}, { permission: PERMISSIONS.MESSAGING_CHANNELS_CREATE, schema: CreateChannelSchema })
