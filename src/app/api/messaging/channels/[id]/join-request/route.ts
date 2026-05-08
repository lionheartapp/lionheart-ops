/**
 * POST /api/messaging/channels/[id]/join-request — request to join a private channel.
 * Creates a PENDING request and posts a system message to the channel.
 *
 * PATCH /api/messaging/channels/[id]/join-request — approve or deny a pending request.
 * Body: { requestId, action: "approve" | "deny" }
 * Only current channel members can approve/deny.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import { postToChannel } from '@/lib/services/systemBotService'

// ── POST: Create a join request ─────────────────────────────────────────────

export const POST = withAuth<unknown, { id: string }>(async ({ ctx, orgId, params }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked

  const channelId = params.id

  const channel = await rawPrisma.channel.findUnique({
    where: { id: channelId, organizationId: orgId, deletedAt: null },
    select: { type: true, name: true },
  })

  if (!channel) {
    return NextResponse.json(fail('NOT_FOUND', 'Channel not found'), { status: 404 })
  }

  if (channel.type !== 'PRIVATE') {
    return NextResponse.json(fail('BAD_REQUEST', 'Join requests are only for private channels'), { status: 400 })
  }

  // Check if already a member
  const existing = await rawPrisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: ctx.userId } },
  })
  if (existing) {
    return NextResponse.json(fail('BAD_REQUEST', 'Already a member of this channel'), { status: 400 })
  }

  // Check for existing pending request
  const pendingRequest = await rawPrisma.channelJoinRequest.findFirst({
    where: { channelId, userId: ctx.userId, status: 'PENDING' },
  })
  if (pendingRequest) {
    return NextResponse.json(fail('BAD_REQUEST', 'You already have a pending request'), { status: 400 })
  }

  // Create the request
  const request = await rawPrisma.channelJoinRequest.create({
    data: {
      organizationId: orgId,
      channelId,
      userId: ctx.userId,
      status: 'PENDING',
    },
  })

  // Get requester name for the system message
  const requester = await rawPrisma.user.findUnique({
    where: { id: ctx.userId },
    select: { firstName: true, lastName: true, name: true },
  })
  const requesterName = requester?.name || [requester?.firstName, requester?.lastName].filter(Boolean).join(' ') || 'Someone'

  // Post system message to the channel so members see the request.
  // The [join-request:ID] marker is detected by MessageBubble to render Accept/Deny buttons.
  void postToChannel(
    channelId,
    orgId,
    `**${requesterName}** is requesting to join this channel. [join-request:${request.id}]`,
  )

  return NextResponse.json(ok({ requested: true, requestId: request.id }))
})

// ── PATCH: Approve or deny a request ────────────────────────────────────────

const ResolveSchema = z.object({
  requestId: z.string(),
  action: z.enum(['approve', 'deny']),
})

export const PATCH = withAuth<z.infer<typeof ResolveSchema>, { id: string }>(
  async ({ ctx, orgId, params, body }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked

    const channelId = params.id

    // Verify the acting user is a member of this channel
    const membership = await rawPrisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: ctx.userId } },
    })
    if (!membership) {
      return NextResponse.json(fail('FORBIDDEN', 'Only channel members can respond to join requests'), { status: 403 })
    }

    // Find the pending request
    const request = await rawPrisma.channelJoinRequest.findFirst({
      where: { id: body.requestId, channelId, status: 'PENDING' },
      include: {
        user: { select: { firstName: true, lastName: true, name: true } },
      },
    })
    if (!request) {
      return NextResponse.json(fail('NOT_FOUND', 'Join request not found or already resolved'), { status: 404 })
    }

    const requesterName = request.user.name || [request.user.firstName, request.user.lastName].filter(Boolean).join(' ') || 'User'

    // Get the acting user's name
    const actor = await rawPrisma.user.findUnique({
      where: { id: ctx.userId },
      select: { firstName: true, lastName: true, name: true },
    })
    const actorName = actor?.name || [actor?.firstName, actor?.lastName].filter(Boolean).join(' ') || 'Someone'

    if (body.action === 'approve') {
      // Add user as member
      await rawPrisma.channelMember.upsert({
        where: { channelId_userId: { channelId, userId: request.userId } },
        create: { channelId, userId: request.userId, organizationId: orgId, role: 'member' },
        update: {},
      })

      // Update request status
      await rawPrisma.channelJoinRequest.update({
        where: { id: request.id },
        data: { status: 'APPROVED', resolvedById: ctx.userId, resolvedAt: new Date() },
      })

      void postToChannel(channelId, orgId, `**${actorName}** approved **${requesterName}**'s request to join.`)

      return NextResponse.json(ok({ approved: true }))
    } else {
      // Deny
      await rawPrisma.channelJoinRequest.update({
        where: { id: request.id },
        data: { status: 'DENIED', resolvedById: ctx.userId, resolvedAt: new Date() },
      })

      void postToChannel(channelId, orgId, `**${actorName}** declined **${requesterName}**'s request to join.`)

      return NextResponse.json(ok({ denied: true }))
    }
  },
  { schema: ResolveSchema },
)
