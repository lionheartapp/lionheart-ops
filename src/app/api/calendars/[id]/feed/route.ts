import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { fail } from '@/lib/api-response'

function escapeIcal(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatIcalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Feed token required'), { status: 401 })
    }

    // Look up calendar by feed token (bypasses org-scoping since this is a public feed)
    const calendar = await rawPrisma.calendar.findFirst({
      where: { id, feedToken: token, deletedAt: null },
      select: { id: true, name: true, organizationId: true },
    })

    if (!calendar) {
      return NextResponse.json(fail('NOT_FOUND', 'Calendar not found or invalid token'), { status: 404 })
    }

    // Fetch events for the last year and next year
    const now = new Date()
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const oneYearAhead = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())

    const events = await rawPrisma.calendarEvent.findMany({
      where: {
        calendarId: id,
        organizationId: calendar.organizationId,
        deletedAt: null,
        calendarStatus: { in: ['CONFIRMED', 'TENTATIVE'] },
        startTime: { gte: oneYearAgo },
        endTime: { lte: oneYearAhead },
      },
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        isAllDay: true,
        locationText: true,
        calendarStatus: true,
        createdAt: true,
        updatedAt: true,
        rrule: true,
      },
      orderBy: { startTime: 'asc' },
    })

    // Build iCalendar output
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lionheart//Calendar//EN',
      `X-WR-CALNAME:${escapeIcal(calendar.name)}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ]

    for (const event of events) {
      lines.push('BEGIN:VEVENT')
      lines.push(`UID:${event.id}@lionheartapp.com`)
      lines.push(`DTSTAMP:${formatIcalDate(event.updatedAt)}`)

      if (event.isAllDay) {
        const dateStr = event.startTime.toISOString().slice(0, 10).replace(/-/g, '')
        lines.push(`DTSTART;VALUE=DATE:${dateStr}`)
        const endDateStr = event.endTime.toISOString().slice(0, 10).replace(/-/g, '')
        lines.push(`DTEND;VALUE=DATE:${endDateStr}`)
      } else {
        lines.push(`DTSTART:${formatIcalDate(event.startTime)}`)
        lines.push(`DTEND:${formatIcalDate(event.endTime)}`)
      }

      lines.push(`SUMMARY:${escapeIcal(event.title)}`)

      if (event.description) {
        lines.push(`DESCRIPTION:${escapeIcal(event.description)}`)
      }
      if (event.locationText) {
        lines.push(`LOCATION:${escapeIcal(event.locationText)}`)
      }
      if (event.calendarStatus === 'TENTATIVE') {
        lines.push('STATUS:TENTATIVE')
      } else {
        lines.push('STATUS:CONFIRMED')
      }
      if (event.rrule) {
        lines.push(`RRULE:${event.rrule}`)
      }

      lines.push('END:VEVENT')
    }

    lines.push('END:VCALENDAR')

    return new NextResponse(lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${calendar.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`,
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (error) {
    console.error('iCal feed error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to generate feed'), { status: 500 })
  }
}
