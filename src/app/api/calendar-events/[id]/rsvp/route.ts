import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { runWithOrgContext } from '@/lib/org-context'
import { ok, fail } from '@/lib/api-response'
import { updateRsvpStatus, getEventById } from '@/lib/services/calendarService'
import { createNotification } from '@/lib/services/notificationService'

const rsvpSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED', 'TENTATIVE']),
  responseNote: z.string().max(500).optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { id: eventId } = await params

    const body = await req.json()
    const parsed = rsvpSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid RSVP data', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      // Update RSVP
      const attendee = await updateRsvpStatus(
        eventId,
        ctx.userId,
        parsed.data.status,
        parsed.data.responseNote
      )

      // Notify event creator (fire-and-forget)
      const event = await getEventById(eventId)
      if (event?.createdById && event.createdById !== ctx.userId) {
        const statusLabel = parsed.data.status === 'ACCEPTED' ? 'accepted'
          : parsed.data.status === 'DECLINED' ? 'declined'
          : 'tentatively accepted'

        createNotification({
          userId: event.createdById,
          type: 'event_rsvp',
          title: `${ctx.email} ${statusLabel} "${event.title}"`,
          body: parsed.data.responseNote || undefined,
          linkUrl: `/calendar?eventId=${eventId}`,
        }).catch(() => {}) // fire-and-forget
      }

      return NextResponse.json(ok(attendee))
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Record to update not found')) {
        return NextResponse.json(
          fail('NOT_FOUND', 'You are not an attendee of this event'),
          { status: 404 }
        )
      }
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
    }
    console.error('RSVP error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
