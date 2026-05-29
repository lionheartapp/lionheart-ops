import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getChannel,
  updateChannel,
  archiveChannel,
  UpdateChannelSchema,
} from '@/lib/services/channelService'

// GET /api/messaging/channels/[id] — get single channel with members
export const GET = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked
  const channel = await getChannel(params.id, ctx.userId)
  return NextResponse.json(ok(channel))
}, { permission: PERMISSIONS.MESSAGING_ACCESS })

// PATCH /api/messaging/channels/[id] — update name, description, topic
export const PATCH = withAuth<z.infer<typeof UpdateChannelSchema>, { id: string }>(
  async ({ ctx, orgId, params, body }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked
    const updated = await updateChannel(params.id, ctx.userId, body)
    return NextResponse.json(ok(updated))
  },
  { permission: PERMISSIONS.MESSAGING_ACCESS, schema: UpdateChannelSchema },
)

// DELETE /api/messaging/channels/[id] — archive (soft)
export const DELETE = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked
  await archiveChannel(params.id, ctx.userId)
  return NextResponse.json(ok({ archived: true }))
}, { permission: PERMISSIONS.MESSAGING_ACCESS })
