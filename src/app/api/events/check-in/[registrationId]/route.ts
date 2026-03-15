/**
 * Participant Self-Service Info Endpoint (PUBLIC — QR-03)
 *
 * GET /api/events/check-in/[registrationId]
 *
 * Public endpoint accessed when a participant scans their own QR code.
 * No auth required — the registration ID in the QR code serves as the access token
 * (same pattern as portal magic links: registrationId is a non-guessable cuid()).
 *
 * Returns:
 * - Participant name and photo
 * - Event info: title, dates, location
 * - Schedule blocks for the event
 * - Group assignments (name, type)
 * - Relevant announcements (ALL audience or group-targeted for participant's groups)
 * - Check-in status
 *
 * SECURITY: Never returns medical data (FERPA — no medical via public endpoint ever).
 * FERPA: Does NOT expose allergies, medications, or emergency contact info.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { AnnouncementAudience } from '@prisma/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  try {
    const { registrationId } = await params

    // Fetch registration with basic info (rawPrisma — no org context on public path)
    const registration = await rawPrisma.eventRegistration.findUnique({
      where: { id: registrationId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
        grade: true,
        status: true,
        eventProjectId: true,
        eventProject: {
          select: {
            id: true,
            title: true,
            description: true,
            coverImageUrl: true,
            startsAt: true,
            endsAt: true,
            locationText: true,
          },
        },
        groupAssignments: {
          select: {
            group: { select: { id: true, name: true, type: true } },
          },
        },
        checkIns: {
          select: { checkedInAt: true },
          take: 1,
        },
      },
    })

    if (!registration) {
      return NextResponse.json(fail('NOT_FOUND', 'Registration not found'), { status: 404 })
    }

    // Fetch schedule blocks for this event
    const scheduleBlocks = await rawPrisma.eventScheduleBlock.findMany({
      where: { eventProjectId: registration.eventProjectId },
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        endsAt: true,
        locationText: true,
        description: true,
      },
      orderBy: { startsAt: 'asc' },
    })

    // Fetch relevant announcements: ALL + GROUP-targeted for participant's groups
    const groupIds = registration.groupAssignments.map((ga) => ga.group.id)
    const announcements = await rawPrisma.eventAnnouncement.findMany({
      where: {
        eventProjectId: registration.eventProjectId,
        OR: [
          { audience: AnnouncementAudience.ALL },
          ...(groupIds.length > 0
            ? [{ audience: AnnouncementAudience.GROUP, targetGroupId: { in: groupIds } }]
            : []),
        ],
      },
      select: {
        id: true,
        title: true,
        body: true,
        audience: true,
        sentAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const checkIn = registration.checkIns[0] ?? null

    return NextResponse.json(
      ok({
        participant: {
          registrationId: registration.id,
          firstName: registration.firstName,
          lastName: registration.lastName,
          photoUrl: registration.photoUrl,
          grade: registration.grade,
          status: registration.status,
          // FERPA: Never return medical/emergency data on public endpoint
        },
        event: registration.eventProject,
        schedule: scheduleBlocks,
        groups: registration.groupAssignments.map((ga) => ({
          id: ga.group.id,
          name: ga.group.name,
          type: ga.group.type,
        })),
        announcements,
        checkInStatus: {
          isCheckedIn: !!checkIn,
          checkedInAt: checkIn?.checkedInAt ?? null,
        },
      }),
    )
  } catch (error) {
    console.error('[events/check-in/:registrationId GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
