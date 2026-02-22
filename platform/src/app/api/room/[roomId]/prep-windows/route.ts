import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

/**
 * GET /api/room/[roomId]/prep-windows?date=YYYY-MM-DD
 * 
 * Finds gaps of 30+ minutes during school hours (8 AM - 4 PM) by analyzing teacher schedules.
 * Returns "Window of Silence" periods ideal for maintenance or event setup.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    return await withOrg(req, prisma, async () => {
      const { roomId } = params
      const url = new URL(req.url)
      const dateStr = url.searchParams.get('date') // YYYY-MM-DD

      if (!roomId) {
        return NextResponse.json(
          { error: 'roomId is required' },
          { status: 400, headers: corsHeaders }
        )
      }

      // Parse date to get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
      let dayOfWeek = new Date().getDay()
      if (dateStr) {
        const date = new Date(dateStr)
        if (!isNaN(date.getTime())) {
          dayOfWeek = date.getDay()
        }
      }

      // Weekend: no school, full day available
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return NextResponse.json(
          {
            windows: [
              {
                startTime: '08:00',
                endTime: '16:00',
                durationMinutes: 480,
                reason: 'Weekend - no classes scheduled',
                isBestWindow: true,
              },
            ],
            message: 'Weekend detected. Full school hours available.',
          },
          { headers: corsHeaders }
        )
      }

      // Fetch all teacher schedules for this room on this day
      const schedules = await prisma.teacherSchedule.findMany({
        where: {
          roomId,
          dayOfWeek,
        },
        include: {
          user: { select: { name: true, email: true } },
        },
        orderBy: { startTime: 'asc' },
      })

      // If no schedules, entire day is prep windows
      if (schedules.length === 0) {
        return NextResponse.json(
          {
            windows: [
              {
                startTime: '08:00',
                endTime: '16:00',
                durationMinutes: 480,
                reason: 'No classes scheduled this day',
                isBestWindow: true,
                blockingTeachers: [],
              },
            ],
            message: 'No classes scheduled. Full school hours available.',
          },
          { headers: corsHeaders }
        )
      }

      const schoolStart = 480 // 8:00 AM in minutes
      const schoolEnd = 960 // 4:00 PM in minutes
      const minGapDuration = 30 // minutes
      const windows: any[] = []

      // Check gap before first class
      const firstStartMinutes = timeToMinutes(schedules[0].startTime)
      if (firstStartMinutes - schoolStart >= minGapDuration) {
        windows.push({
          startTime: minutesToTime(schoolStart),
          endTime: schedules[0].startTime,
          durationMinutes: firstStartMinutes - schoolStart,
          reason: 'Before first class',
          blockingTeachers: [],
        })
      }

      // Check gaps between classes (prep periods, passing time, lunch)
      for (let i = 0; i < schedules.length - 1; i++) {
        const gapStartMinutes = timeToMinutes(schedules[i].endTime)
        const gapEndMinutes = timeToMinutes(schedules[i + 1].startTime)
        const gapDuration = gapEndMinutes - gapStartMinutes

        if (gapDuration >= minGapDuration) {
          windows.push({
            startTime: schedules[i].endTime,
            endTime: schedules[i + 1].startTime,
            durationMinutes: gapDuration,
            reason: `Between classes (${schedules[i].user?.name} ends ~ ${schedules[i + 1].user?.name} starts)`,
            blockingTeachers: [
              { name: schedules[i].user?.name, endTime: schedules[i].endTime },
              { name: schedules[i + 1].user?.name, startTime: schedules[i + 1].startTime },
            ],
          })
        }
      }

      // Check gap after last class
      const lastEndMinutes = timeToMinutes(schedules[schedules.length - 1].endTime)
      if (schoolEnd - lastEndMinutes >= minGapDuration) {
        windows.push({
          startTime: schedules[schedules.length - 1].endTime,
          endTime: minutesToTime(schoolEnd),
          durationMinutes: schoolEnd - lastEndMinutes,
          reason: 'After last class',
          blockingTeachers: [
            { name: schedules[schedules.length - 1].user?.name, endTime: schedules[schedules.length - 1].endTime },
          ],
        })
      }

      // Mark the longest window as "best"
      if (windows.length > 0) {
        const longest = windows.reduce((best, w) => (w.durationMinutes > best.durationMinutes ? w : best))
        longest.isBestWindow = true
      }

      return NextResponse.json(
        {
          windows,
          roomId,
          dayOfWeek,
          message: `Found ${windows.length} maintenance windows for this room on day ${dayOfWeek}`,
        },
        { headers: corsHeaders }
      )
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json(
        { error: err.message },
        { status: 401, headers: corsHeaders }
      )
    }
    console.error('GET /api/room/[roomId]/prep-windows error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch prep windows' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * Helper: Convert HH:MM to minutes since midnight.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Helper: Convert minutes since midnight to HH:MM format.
 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
