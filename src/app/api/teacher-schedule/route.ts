import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

/**
 * GET /api/teacher-schedule?roomId=&dayOfWeek=
 * Fetch teacher schedules for a room or specific day.
 */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prisma, async () => {
      const url = new URL(req.url)
      const roomId = url.searchParams.get('roomId')
      const dayOfWeek = url.searchParams.get('dayOfWeek') ? Number(url.searchParams.get('dayOfWeek')) : undefined

      const where: any = {}
      if (roomId) where.roomId = roomId
      if (dayOfWeek !== undefined && dayOfWeek >= 0 && dayOfWeek <= 6) where.dayOfWeek = dayOfWeek

      const schedules = await prisma.teacherSchedule.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          room: { select: { id: true, name: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      })

      return NextResponse.json(schedules, { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('GET /api/teacher-schedule error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch teacher schedules' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * POST /api/teacher-schedule
 * Create or update a teacher's schedule entry for a room on a specific day.
 */
export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prisma, async () => {
      const authHeader = req.headers.get('authorization')
      let userId: string | undefined

      if (authHeader?.startsWith('Bearer ')) {
        const payload = await verifyToken(authHeader.slice(7))
        if (payload?.userId) userId = payload.userId
      }

      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
      }

      const body = (await req.json()) as {
        roomId: string
        dayOfWeek: number
        startTime: string
        endTime: string
        subject?: string
        notes?: string
      }

      const { roomId, dayOfWeek, startTime, endTime, subject, notes } = body

      if (!roomId || dayOfWeek === undefined || !startTime || !endTime) {
        return NextResponse.json(
          { error: 'Missing required fields: roomId, dayOfWeek, startTime, endTime' },
          { status: 400, headers: corsHeaders }
        )
      }

      if (dayOfWeek < 0 || dayOfWeek > 6) {
        return NextResponse.json(
          { error: 'dayOfWeek must be 0-6 (Sunday-Saturday)' },
          { status: 400, headers: corsHeaders }
        )
      }

      // Check if schedule already exists for this user/room/day (upsert)
      const existing = await prisma.teacherSchedule.findFirst({
        where: {
          userId,
          roomId,
          dayOfWeek,
        },
      })

      let schedule
      if (existing) {
        schedule = await prisma.teacherSchedule.update({
          where: { id: existing.id },
          data: {
            startTime,
            endTime,
            subject: subject || null,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            room: { select: { id: true, name: true } },
          },
        })
      } else {
        schedule = await prisma.teacherSchedule.create({
          data: {
            userId,
            roomId,
            dayOfWeek,
            startTime,
            endTime,
            subject: subject || null,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            room: { select: { id: true, name: true } },
          },
        })
      }

      return NextResponse.json(schedule, { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('POST /api/teacher-schedule error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create teacher schedule' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * DELETE /api/teacher-schedule/[id]
 * Remove a teacher schedule entry.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    return await withOrg(req, prisma, async () => {
      const { id } = params

      const schedule = await prisma.teacherSchedule.findUnique({
        where: { id },
      })

      if (!schedule) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404, headers: corsHeaders })
      }

      await prisma.teacherSchedule.delete({
        where: { id },
      })

      return NextResponse.json({ success: true }, { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('DELETE /api/teacher-schedule error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete teacher schedule' },
      { status: 500, headers: corsHeaders }
    )
  }
}
