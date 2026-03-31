import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createAnnouncement,
  listAnnouncements,
  deleteAnnouncement,
} from '@/lib/services/eventAnnouncementService'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  audience: z.enum(['ALL', 'GROUP', 'INCOMPLETE_DOCS', 'PAID_ONLY', 'TEAM']),
  targetGroupId: z.string().cuid().optional().nullable(),
})

const DeleteAnnouncementSchema = z.object({
  announcementId: z.string().cuid(),
})

// ─── Route Handlers ──────────────────────────────────────────────────────────

export const GET = withAuth(async ({ params }) => {
  const announcements = await listAnnouncements(params.id)
  return NextResponse.json(ok(announcements))
}, { permission: PERMISSIONS.EVENTS_ANNOUNCEMENTS_MANAGE })

export const POST = withAuth(async ({ ctx, params, body }) => {
  const announcement = await createAnnouncement({
    eventProjectId: params.id,
    title: body.title,
    body: body.body,
    audience: body.audience,
    targetGroupId: body.targetGroupId ?? null,
    createdById: ctx.userId,
  })
  return NextResponse.json(ok(announcement), { status: 201 })
}, { permission: PERMISSIONS.EVENTS_ANNOUNCEMENTS_MANAGE, schema: CreateAnnouncementSchema })

export const DELETE = withAuth(async ({ req }) => {
  const body = await req.json()
  const parsed = DeleteAnnouncementSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'announcementId is required', parsed.error.issues),
      { status: 400 },
    )
  }

  await deleteAnnouncement(parsed.data.announcementId)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENTS_ANNOUNCEMENTS_MANAGE })
