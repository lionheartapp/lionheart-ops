import { NextRequest, NextResponse } from 'next/server'
import { EventStatus } from '@prisma/client'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
import { requireActivePlan, PlanRestrictedError } from '@/lib/planCheck'
import { isAdminOrSuperAdmin } from '@/lib/roles'

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

export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      if (!orgId) return NextResponse.json([], { status: 200 })
      const url = new URL(req.url)
      const includePending = url.searchParams.get('includePending') === 'true'
      const summary = url.searchParams.get('summary') === '1'
      const list = await prisma.event.findMany({
        where: {
          organizationId: orgId,
          ...(includePending ? {} : { status: 'APPROVED' }),
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        ...(summary ? { take: 120 } : {}),
        include: {
          room: { select: { name: true } },
          submittedBy: { select: { name: true } },
        },
      })
      const events = list.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        roomId: e.roomId,
        room: e.room ? { name: e.room.name } : null,
        submittedBy: e.submittedBy ? { name: e.submittedBy.name } : null,
        status: e.status,
      }))
      return NextResponse.json(events)
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json([], { status: 200 })
    }
    console.error('GET events error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      await requireActivePlan(prismaBase, orgId)

      const org = await prismaBase.organization.findUnique({
        where: { id: orgId },
        select: { allowTeacherEventRequests: true },
      })
      const allowTeacherEventRequests = org?.allowTeacherEventRequests ?? false

      let currentUserId: string | null = null
      let currentUserRole: string | null = null
      const authHeader = req.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const payload = await verifyToken(authHeader.slice(7))
        if (payload?.userId) {
          currentUserId = payload.userId
          const user = await prismaBase.user.findUnique({
            where: { id: payload.userId },
            select: { role: true },
          })
          currentUserRole = user?.role ?? null
        }
      }

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

      const isAdmin = isAdminOrSuperAdmin(currentUserRole)
      const eventStatus: EventStatus = isAdmin ? 'APPROVED' : 'PENDING_APPROVAL'

      if (!isAdmin && !allowTeacherEventRequests) {
        return NextResponse.json(
          { error: 'Event scheduling is managed by Site Administration. Please contact your Site Secretary to book a facility.' },
          { status: 403 }
        )
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
          submittedById: submittedById ?? currentUserId ?? body.submittedById,
          routedToIds,
          status: eventStatus,
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
