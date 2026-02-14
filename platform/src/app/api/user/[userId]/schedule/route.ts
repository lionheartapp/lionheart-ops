import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  if (userId === 'demo') {
    return NextResponse.json({
      blocks: [
        { startTime: '08:00', endTime: '09:15', subject: 'Math', roomName: 'Room 101' },
        { startTime: '10:30', endTime: '11:45', subject: 'Science', roomName: 'Room 102' },
      ],
    })
  }
  try {
    return await withOrg(req, prismaBase, async () => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const schedules = await prisma.teacherSchedule.findMany({
      where: { userId },
      include: { room: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
    const todays = schedules.filter((s) => s.dayOfWeek === dayOfWeek)
    return NextResponse.json({
      blocks: todays.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
        subject: s.subject,
        roomName: s.room?.name,
      })),
    })
    })
  } catch {
    return NextResponse.json({ blocks: [] })
  }
}
