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
    const orgId = getOrgId()
    const room = await prisma.room.findFirst({
      where: orgId ? { id: roomId, building: { organizationId: orgId } } : { id: roomId },
      include: {
        building: true,
        tickets: { where: { category: 'MAINTENANCE', status: { not: 'RESOLVED' } } },
        teacherSchedules: { include: { user: true } },
      },
    })
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    const teacher = room.teacherSchedules?.[0]?.user
    return NextResponse.json({
      id: room.id,
      name: room.name,
      buildingName: room.building?.name ?? '',
      pinYaw: room.pinYaw,
      pinPitch: room.pinPitch,
      teacher: teacher ? { id: teacher.id, name: teacher.name } : null,
      tickets: room.tickets.map((t) => ({ id: t.id, title: t.title, status: t.status })),
    })
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    console.error('Room fetch error:', err)
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }
}
