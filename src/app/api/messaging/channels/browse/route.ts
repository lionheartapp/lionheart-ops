/**
 * GET /api/messaging/channels/browse — discover joinable channels.
 * Returns public and private channels the user is NOT already a member of.
 * Private channels include a `pendingRequest` flag.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import { browsePublicChannels } from '@/lib/services/channelService'

export const GET = withAuth(async ({ ctx, orgId, searchParams }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked
  const search = searchParams.get('search') || undefined
  const channels = await browsePublicChannels(ctx.userId, orgId, search)
  return NextResponse.json(ok(channels))
}, { permission: PERMISSIONS.MESSAGING_ACCESS })
