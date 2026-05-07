/**
 * PATCH  /api/messaging/messages/[id] — edit own message (D-09, T-24-19)
 * DELETE /api/messaging/messages/[id] — soft-delete message (D-08, T-24-20)
 *
 * Ownership is verified in the service layer. DELETE checks the
 * MESSAGING_MESSAGES_DELETE_ANY permission at the route level and passes
 * the result to the service for authorization.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import {
  editMessage,
  deleteMessage,
  EditMessageSchema,
} from '@/lib/services/messageService'

// PATCH /api/messaging/messages/[id] — edit own message
export const PATCH = withAuth<z.infer<typeof EditMessageSchema>, { id: string }>(
  async ({ ctx, orgId, params, body }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked
    const updated = await editMessage(params.id, ctx.userId, body)
    return NextResponse.json(ok(updated))
  },
  { schema: EditMessageSchema }
)

// DELETE /api/messaging/messages/[id] — soft-delete message
// Own messages: always allowed. Others' messages: requires MESSAGING_MESSAGES_DELETE_ANY
export const DELETE = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params, permissions }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked
  const canDeleteAny = await permissions.can(PERMISSIONS.MESSAGING_MESSAGES_DELETE_ANY)
  const result = await deleteMessage(params.id, ctx.userId, canDeleteAny)
  return NextResponse.json(ok(result))
})
