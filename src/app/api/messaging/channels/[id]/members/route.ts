import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok } from '@/lib/api-response'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import {
  getChannelMembers,
  addMember,
  removeMember,
  AddMemberSchema,
  RemoveMemberSchema,
} from '@/lib/services/channelService'

const MuteSchema = z.object({
  muted: z.boolean(),
})

// GET /api/messaging/channels/[id]/members — list members
export const GET = withAuth<unknown, { id: string }>(async ({ orgId, params }) => {
  const blocked = await assertMessagingEnabled(orgId)
  if (blocked) return blocked
  const members = await getChannelMembers(params.id)
  return NextResponse.json(ok(members))
})

// POST /api/messaging/channels/[id]/members — add member
export const POST = withAuth<z.infer<typeof AddMemberSchema>, { id: string }>(
  async ({ ctx, orgId, params, body }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked
    const member = await addMember(params.id, body, ctx.userId)
    return NextResponse.json(ok(member), { status: 201 })
  },
  { schema: AddMemberSchema },
)

// PATCH /api/messaging/channels/[id]/members — toggle mute for current user
export const PATCH = withAuth<z.infer<typeof MuteSchema>, { id: string }>(
  async ({ ctx, orgId, params, body }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked
    const db = prisma as unknown as OrgPrismaClient
    const updated = await db.channelMember.update({
      where: { channelId_userId: { channelId: params.id, userId: ctx.userId } },
      data: { mutedAt: body.muted ? new Date() : null },
    })
    return NextResponse.json(ok({ muted: !!updated.mutedAt }))
  },
  { schema: MuteSchema },
)

// DELETE /api/messaging/channels/[id]/members — remove member
export const DELETE = withAuth<z.infer<typeof RemoveMemberSchema>, { id: string }>(
  async ({ ctx, orgId, params, body }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked
    await removeMember(params.id, body.userId, ctx.userId)
    return NextResponse.json(ok({ removed: true }))
  },
  { schema: RemoveMemberSchema },
)
