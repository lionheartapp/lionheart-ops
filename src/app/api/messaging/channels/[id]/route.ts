import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/with-auth'
import { ok } from '@/lib/api-response'
import {
  getChannel,
  updateChannel,
  archiveChannel,
  UpdateChannelSchema,
} from '@/lib/services/channelService'

// GET /api/messaging/channels/[id] — get single channel with members
export const GET = withAuth<unknown, { id: string }>(async ({ ctx, params }) => {
  const channel = await getChannel(params.id, ctx.userId)
  return NextResponse.json(ok(channel))
})

// PATCH /api/messaging/channels/[id] — update name, description, topic
export const PATCH = withAuth<z.infer<typeof UpdateChannelSchema>, { id: string }>(
  async ({ ctx, params, body }) => {
    const updated = await updateChannel(params.id, ctx.userId, body)
    return NextResponse.json(ok(updated))
  },
  { schema: UpdateChannelSchema },
)

// DELETE /api/messaging/channels/[id] — archive (soft)
export const DELETE = withAuth<unknown, { id: string }>(async ({ ctx, params }) => {
  await archiveChannel(params.id, ctx.userId)
  return NextResponse.json(ok({ archived: true }))
})
