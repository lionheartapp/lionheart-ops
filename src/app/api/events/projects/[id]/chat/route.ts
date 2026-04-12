import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getMessages, createMessage } from '@/lib/services/eventChatService'

const SendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
})

/**
 * GET — Return recent chat messages for the event project (newest last).
 */
export const GET = withAuth(async ({ params }) => {
  const messages = await getMessages(params.id)
  return NextResponse.json(ok(messages))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })

/**
 * POST — Send a new chat message.
 */
export const POST = withAuth(async ({ ctx, params, body }) => {
  const message = await createMessage(params.id, ctx.userId, body.content)
  return NextResponse.json(ok(message))
}, {
  permission: PERMISSIONS.EVENT_PROJECT_READ,
  schema: SendMessageSchema,
})
