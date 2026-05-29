/**
 * GET /api/calendar/ical/[token].ics — iCalendar subscription feed
 *
 * Returns an iCal (.ics) feed for a team, space, or user schedule.
 * No auth header needed — the signed token authenticates the request.
 * Calendar apps (Google Calendar, Apple Calendar) poll this URL.
 */

import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line no-restricted-imports -- Public iCal feed token identifies the organization before the route enters runWithOrgContext.
import { rawPrisma } from '@/lib/db'
import { runWithOrgContext } from '@/lib/org-context'
import { prisma } from '@/lib/db'

// ─── iCal Formatting ────────────────────────────────────────────────────────

function escapeIcal(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatIcalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

interface CalEvent {
  id: string
  title: string
  description: string | null
  startTime: Date
  endTime: Date
  locationText: string | null
  rrule: string | null
  calendarStatus: string
  createdAt: Date
  updatedAt: Date
}

function eventToVEvent(event: CalEvent, prodId: string): string {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.id}@${prodId}`,
    `DTSTAMP:${formatIcalDate(event.updatedAt)}`,
    `DTSTART:${formatIcalDate(event.startTime)}`,
    `DTEND:${formatIcalDate(event.endTime)}`,
    `SUMMARY:${escapeIcal(event.title)}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcal(event.description)}`)
  }
  if (event.locationText) {
    lines.push(`LOCATION:${escapeIcal(event.locationText)}`)
  }
  if (event.rrule) {
    lines.push(`RRULE:${event.rrule}`)
  }
  if (event.calendarStatus === 'CANCELLED') {
    lines.push('STATUS:CANCELLED')
  } else {
    lines.push('STATUS:CONFIRMED')
  }

  lines.push(`LAST-MODIFIED:${formatIcalDate(event.updatedAt)}`)
  lines.push(`CREATED:${formatIcalDate(event.createdAt)}`)
  lines.push('END:VEVENT')

  return lines.join('\r\n')
}

function buildIcal(events: CalEvent[], calName: string, prodId: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${prodId}//Lionheart//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcal(calName)}`,
    '',
  ]

  for (const event of events) {
    lines.push(eventToVEvent(event, prodId))
    lines.push('')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

// ─── Route ──────────────────────────────────────────────────────────────────

// Simple in-memory cache for popular feeds (TTL 5 min)
const feedCache = new Map<string, { ics: string; expiry: number }>()

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  // Strip .ics extension if present
  const cleanToken = token.replace(/\.ics$/, '')

  // Look up the feed by token
  const feed = await rawPrisma.calendarFeed.findUnique({
    where: { token: cleanToken },
    include: {
      organization: { select: { id: true, name: true } },
    },
  })

  if (!feed) {
    return new NextResponse('Not Found', { status: 404 })
  }

  if (!feed.isActive) {
    return new NextResponse('Gone', { status: 410 })
  }

  // Check cache
  const cached = feedCache.get(cleanToken)
  if (cached && cached.expiry > Date.now()) {
    return new NextResponse(cached.ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    })
  }

  // Generate the feed
  const orgId = feed.organizationId
  const prodId = 'lionheartapp.com'

  const ics = await runWithOrgContext(orgId, async () => {
    let events: CalEvent[] = []
    let calName = feed.organization.name

    // 6-month window for events
    const start = new Date()
    start.setMonth(start.getMonth() - 1)
    const end = new Date()
    end.setMonth(end.getMonth() + 6)

    const baseWhere = {
      startTime: { gte: start, lte: end },
      calendarStatus: 'CONFIRMED' as const,
    }

    if (feed.feedType === 'team' || feed.feedType === 'team-public') {
      // Team feed — games + practices via sourceModule='athletics' and sourceId matching
      const teamId = feed.entityId
      if (!teamId) return ''

      const team = await prisma.athleticTeam.findUnique({
        where: { id: teamId },
        select: { name: true, sport: { select: { name: true } } },
      })
      calName = team ? `${team.sport.name}: ${team.name}` : calName

      // Find games and practices for this team
      const games = await prisma.game.findMany({
        where: { athleticTeamId: teamId, calendarEventId: { not: null } },
        select: { calendarEventId: true },
      })
      const practices = await prisma.practice.findMany({
        where: { athleticTeamId: teamId, calendarEventId: { not: null } },
        select: { calendarEventId: true },
      })
      const eventIds = [
        ...games.map((g) => g.calendarEventId!),
        ...practices.map((p) => p.calendarEventId!),
      ]

      if (eventIds.length > 0) {
        events = await prisma.calendarEvent.findMany({
          where: { id: { in: eventIds }, ...baseWhere },
          select: {
            id: true, title: true, description: true,
            startTime: true, endTime: true, locationText: true,
            rrule: true, calendarStatus: true, createdAt: true, updatedAt: true,
          },
        })
      }
    } else if (feed.feedType === 'space') {
      // Space feed — all bookings on a specific space
      const spaceId = feed.entityId
      if (!spaceId) return ''

      const space = await prisma.space.findUnique({
        where: { id: spaceId },
        select: { name: true },
      })
      calName = space ? `${space.name} Schedule` : calName

      events = await prisma.calendarEvent.findMany({
        where: { spaceId, ...baseWhere },
        select: {
          id: true, title: true, description: true,
          startTime: true, endTime: true, locationText: true,
          rrule: true, calendarStatus: true, createdAt: true, updatedAt: true,
        },
      })
    } else if (feed.feedType === 'user') {
      // User feed — all events the user created or is attending
      const userId = feed.userId
      if (!userId) return ''

      events = await prisma.calendarEvent.findMany({
        where: {
          ...baseWhere,
          OR: [
            { createdById: userId },
            { attendees: { some: { userId } } },
          ],
        },
        select: {
          id: true, title: true, description: true,
          startTime: true, endTime: true, locationText: true,
          rrule: true, calendarStatus: true, createdAt: true, updatedAt: true,
        },
      })
    }

    return buildIcal(events, calName, prodId)
  })

  // Cache for 5 minutes
  feedCache.set(cleanToken, { ics: ics as string, expiry: Date.now() + 300_000 })

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
