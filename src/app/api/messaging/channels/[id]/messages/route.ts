/**
 * GET  /api/messaging/channels/[id]/messages — paginated message history
 * POST /api/messaging/channels/[id]/messages — send a message
 *
 * Membership is verified in the service layer (T-24-07, T-24-23).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import {
  getMessages,
  sendMessage,
  SendMessageSchema,
} from '@/lib/services/messageService'

const MessagesQuerySchema = z.object({
  before: z.string().optional(),
  after: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  parentId: z.string().optional(),
})

// GET /api/messaging/channels/[id]/messages — paginated message history
export const GET = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params, searchParams }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked
  const query = MessagesQuerySchema.parse({
    before: searchParams.get('before') ?? undefined,
    after: searchParams.get('after') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    parentId: searchParams.get('parentId') ?? undefined,
  })
  const result = await getMessages(params.id, ctx.userId, query)
  return NextResponse.json(ok(result.messages, {
    hasMore: result.hasMore,
    cursor: result.cursor,
  }))
})

// POST /api/messaging/channels/[id]/messages — send a message
export const POST = withAuth<z.infer<typeof SendMessageSchema>, { id: string }>(
  async ({ ctx, orgId, params, body }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked
    const message = await sendMessage(params.id, ctx.userId, body)
    return NextResponse.json(ok(message), { status: 201 })
  },
  { schema: SendMessageSchema }
)
