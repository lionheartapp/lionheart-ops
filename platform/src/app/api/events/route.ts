import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { requireActivePlan, PlanRestrictedError } from '@/lib/planCheck'

// Auto-route: Elementary room → Elementary Principal + Maintenance
async function getRoutedToIds(roomId: string | null | undefined): Promise<string[]> {
  if (!roomId || roomId === '') return []
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { building: true },
  })
  if (!room?.building) return []

  const division = room.building.division
  const ids: string[] = []

  // Maintenance always
  const maintenance = await prisma.user.findMany({
    where: { role: 'MAINTENANCE' },
    select: { id: true },
  })
  ids.push(...maintenance.map((u) => u.id))

  // Division-specific: notify Principal (we use ADMIN with division in name, or first ADMIN)
  if (division === 'ELEMENTARY') {
    const principals = await prisma.user.findMany({
      where: {
        OR: [
          { role: 'ADMIN', name: { contains: 'Elementary', mode: 'insensitive' } },
          { role: 'ADMIN', name: { contains: 'Principal', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })
    if (principals.length === 0) {
      const anyAdmin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true },
      })
      if (anyAdmin) ids.push(anyAdmin.id)
    } else {
      ids.push(...principals.map((u) => u.id))
    }
  }

  return [...new Set(ids)]
}

export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
    await requireActivePlan(prismaBase, getOrgId()!)
    const body = (await req.json()) as {
      name: string
      description?: string
      date: string
      startTime: string
      endTime?: string
      roomId?: string
      chairsRequested?: number
      tablesRequested?: number
      submittedById?: string
    }

    const { name, date, startTime, roomId, submittedById } = body
    if (!name || !date || !startTime) {
      return NextResponse.json({ error: 'Missing name, date, or startTime' }, { status: 400 })
    }

    const routedToIds = await getRoutedToIds(roomId ?? null)

    const event = await prisma.event.create({
      data: {
        name,
        description: body.description,
        date,
        startTime,
        endTime: body.endTime,
        roomId: body.roomId,
        chairsRequested: body.chairsRequested,
        tablesRequested: body.tablesRequested,
        submittedById: body.submittedById,
        routedToIds,
      },
    })

    return NextResponse.json(event)
    })
  } catch (err) {
    if (err instanceof PlanRestrictedError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402 })
    }
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    console.error('Create event error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Create failed' },
      { status: 500 }
    )
  }
}
