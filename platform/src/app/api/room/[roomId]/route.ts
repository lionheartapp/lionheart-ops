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
  } catch {
    const mock: Record<string, { name: string; buildingName: string; teacher: { id: string; name: string } | null; tickets: Array<{ id: string; title: string; status: string }> }> = {
      r1: { name: 'Room 101', buildingName: 'Main Building', teacher: { id: 'u1', name: 'Sarah Johnson' }, tickets: [{ id: 't1', title: 'Leaking faucet', status: 'NEW' }] },
      r2: { name: 'Room 204', buildingName: 'Main Building', teacher: { id: 'u2', name: 'Mrs. Smith' }, tickets: [] },
    }
    const m = mock[roomId]
    return NextResponse.json({
      id: roomId,
      name: m?.name ?? 'Room',
      buildingName: m?.buildingName ?? '',
      teacher: m?.teacher ?? null,
      tickets: m?.tickets ?? [],
    })
  }
}
