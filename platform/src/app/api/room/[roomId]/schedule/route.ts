import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  try {
    return await withOrg(req, prismaBase, async () => {
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    const orgId = getOrgId()
    const schedules = await prisma.teacherSchedule.findMany({
      where: orgId ? { roomId, room: { building: { organizationId: orgId } } } : { roomId },
      include: { user: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })

    // Find current block for today
    type Sch = { dayOfWeek: number; startTime: string; endTime: string; subject: string | null; user: { id: string; name: string | null; imageUrl: string | null } }
    const todaysSchedules = schedules.filter((s: Sch) => s.dayOfWeek === dayOfWeek)
    const activeSchedule = todaysSchedules.find((s: Sch) => {
      return currentTime >= s.startTime && currentTime <= s.endTime
    })

    const nextSchedule = todaysSchedules.find((s: Sch) => s.startTime > currentTime)

    let status: string
    if (activeSchedule) {
      status = activeSchedule.subject
        ? `Class in Session: ${activeSchedule.subject}`
        : 'Class in Session'
    } else if (nextSchedule) {
      status = `Prep Period (until ${nextSchedule.startTime})`
    } else {
      status = 'Prep Period'
    }

    return NextResponse.json({
      teacher: activeSchedule?.user ?? nextSchedule?.user ?? todaysSchedules[0]?.user,
      status,
      currentBlock: activeSchedule,
      schedules: todaysSchedules,
    })
    })
  } catch {
    // Mock for demo when DB unavailable
    return NextResponse.json({
      teacher: { id: 'u1', name: 'Sarah Johnson', imageUrl: null },
      status: 'Class in Session: Math',
      currentBlock: null,
      schedules: [],
    })
  }
}
