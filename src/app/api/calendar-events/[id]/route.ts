import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import * as calendarService from '@/lib/services/calendarService'
import * as notificationService from '@/lib/services/notificationService'
import { sendEventUpdateEmails } from '@/lib/services/emailService'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  timezone: z.string().optional(),
  isAllDay: z.boolean().optional(),
  rrule: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  locationText: z.string().optional(),
  buildingId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  editMode: z.enum(['this', 'thisAndFollowing', 'all']).optional(),
  attendeeIds: z.array(z.string()).optional(),
  notify: z.boolean().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_READ)
    const { id } = await params

    return await runWithOrgContext(orgId, async () => {
      // Parse compound virtual instance IDs: "parentId_isoDatetime"
      let eventId = id
      const underscoreIdx = id.indexOf('_')
      if (underscoreIdx > 0) {
        const maybeDateStr = id.slice(underscoreIdx + 1)
        if (!isNaN(new Date(maybeDateStr).getTime())) {
          eventId = id.slice(0, underscoreIdx)
        }
      }

      const event = await calendarService.getEventById(eventId)
      if (!event) {
        return NextResponse.json(fail('NOT_FOUND', 'Event not found'), { status: 404 })
      }
      return NextResponse.json(ok(event))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { id } = await params
    const body = await req.json()
    const data = updateEventSchema.parse(body)

    const { editMode, startTime, endTime, attendeeIds, notify, ...rest } = data

    return await runWithOrgContext(orgId, async () => {
      // Virtual recurring instances have compound IDs: "parentId_isoDatetime".
      // Extract the real parent ID and the occurrence start time.
      let eventId = id
      let occurrenceStart: Date | undefined
      const underscoreIdx = id.indexOf('_')
      if (underscoreIdx > 0) {
        const maybeDateStr = id.slice(underscoreIdx + 1)
        const parsed = new Date(maybeDateStr)
        if (!isNaN(parsed.getTime())) {
          eventId = id.slice(0, underscoreIdx)
          occurrenceStart = parsed
        }
      }

      // Check if user can edit all or just own
      const event = await calendarService.getEventById(eventId)
      if (!event) {
        return NextResponse.json(fail('NOT_FOUND', 'Event not found'), { status: 404 })
      }

      if (event.createdById === ctx.userId) {
        await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_UPDATE_OWN)
      } else {
        await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_UPDATE_ALL)
      }

      const updated = await calendarService.updateEvent(
        eventId,
        {
          ...rest,
          startTime: startTime ? new Date(startTime) : undefined,
          endTime: endTime ? new Date(endTime) : undefined,
        },
        editMode || 'all',
        ctx.userId,
        occurrenceStart
      )

      // Sync attendees if provided
      if (attendeeIds !== undefined) {
        const existingAttendees = await calendarService.getEventAttendees(eventId)
        const existingUserIds = existingAttendees.map((a: { userId: string }) => a.userId)
        const toAdd = attendeeIds.filter((id: string) => !existingUserIds.includes(id))
        const toRemove = existingUserIds.filter((id: string) => !attendeeIds.includes(id))

        if (toAdd.length > 0) {
          await calendarService.addAttendees(eventId, toAdd)
        }
        for (const userId of toRemove) {
          await calendarService.removeAttendee(eventId, userId)
        }
      }

      // Fire-and-forget: send notifications to attendees if requested
      if (notify && (startTime || endTime)) {
        const attendees = await calendarService.getEventAttendees(eventId)
        const recipientIds = attendees
          .map((a: { userId: string }) => a.userId)
          .filter((uid: string) => uid !== ctx.userId)

        if (recipientIds.length > 0) {
          // In-app notifications
          notificationService.createBulkNotifications(
            recipientIds.map((uid: string) => ({
              userId: uid,
              type: 'event_updated' as const,
              title: `Event "${updated.title}" was rescheduled`,
              body: `The event time has been updated.`,
              linkUrl: `/calendar?eventId=${eventId}`,
            }))
          )

          // Email notifications (fire-and-forget)
          const [recipientUsers, updater, org] = await Promise.all([
            prisma.user.findMany({
              where: { id: { in: recipientIds }, status: 'ACTIVE' },
              select: { email: true },
            }),
            prisma.user.findUnique({
              where: { id: ctx.userId },
              select: { firstName: true, lastName: true },
            }),
            prisma.organization.findFirst({ select: { name: true } }),
          ])
          sendEventUpdateEmails({
            eventTitle: updated.title,
            eventStart: updated.startTime.toISOString(),
            eventEnd: updated.endTime.toISOString(),
            attendeeEmails: recipientUsers.map((u: { email: string }) => u.email),
            updatedByName: [updater?.firstName, updater?.lastName].filter(Boolean).join(' ') || 'A team member',
            orgName: org?.name || 'your school',
            eventLink: `/calendar?eventId=${eventId}`,
          }).catch(() => {})
        }
      }

      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

const deleteEventSchema = z.object({
  editMode: z.enum(['this', 'thisAndFollowing', 'all']).optional(),
}).optional()

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    const { id } = await params

    // Parse optional JSON body for editMode
    let editMode: 'this' | 'thisAndFollowing' | 'all' = 'all'
    try {
      const body = await req.json()
      const parsed = deleteEventSchema.parse(body)
      if (parsed?.editMode) editMode = parsed.editMode
    } catch {
      // No body or invalid JSON — default to 'all'
    }

    return await runWithOrgContext(orgId, async () => {
      // Parse compound virtual instance IDs (same as PUT handler)
      let eventId = id
      let occurrenceStart: Date | undefined
      const underscoreIdx = id.indexOf('_')
      if (underscoreIdx > 0) {
        const maybeDateStr = id.slice(underscoreIdx + 1)
        const parsed = new Date(maybeDateStr)
        if (!isNaN(parsed.getTime())) {
          eventId = id.slice(0, underscoreIdx)
          occurrenceStart = parsed
        }
      }

      const event = await calendarService.getEventById(eventId)
      if (!event) {
        return NextResponse.json(fail('NOT_FOUND', 'Event not found'), { status: 404 })
      }

      if (event.createdById === ctx.userId) {
        await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_DELETE_OWN)
      } else {
        await assertCan(ctx.userId, PERMISSIONS.CALENDAR_EVENTS_DELETE_ALL)
      }

      // Notify attendees before deletion (fire-and-forget)
      const attendees = await calendarService.getEventAttendees(eventId)
      const recipientIds = attendees
        .map((a: { userId: string }) => a.userId)
        .filter((uid: string) => uid !== ctx.userId)
      if (recipientIds.length > 0) {
        notificationService.createBulkNotifications(
          recipientIds.map((uid: string) => ({
            userId: uid,
            type: 'event_deleted' as const,
            title: `Event "${event.title}" was cancelled`,
            body: 'This event has been removed from the calendar.',
          }))
        )
      }

      await calendarService.deleteEvent(eventId, editMode, occurrenceStart)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('DELETE /api/calendar-events/[id] error:', error)
    const msg = error instanceof Error ? error.message : 'Something went wrong'
    return NextResponse.json(fail('INTERNAL_ERROR', msg), { status: 500 })
  }
}
