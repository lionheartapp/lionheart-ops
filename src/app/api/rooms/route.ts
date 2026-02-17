import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'

export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      const rooms = await prisma.room.findMany({
        where: orgId ? { building: { organizationId: orgId } } : undefined,
        include: { building: true },
        orderBy: [{ building: { name: 'asc' } }, { name: 'asc' }],
      })
      return NextResponse.json(rooms)
    })
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const body = (await req.json()) as { name: string; buildingId: string }
      const name = body.name?.trim()
      const buildingId = body.buildingId?.trim()
      if (!name || !buildingId) {
        return NextResponse.json({ error: 'Missing name or buildingId' }, { status: 400 })
      }
      const orgId = getOrgId()
      const building = await prismaBase.building.findFirst({
        where: orgId ? { id: buildingId, organizationId: orgId } : { id: buildingId },
      })
      if (!building) {
        return NextResponse.json({ error: 'Building not found' }, { status: 404 })
      }
      const room = await prisma.room.create({
        data: { name, buildingId },
      })
      return NextResponse.json(room)
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    console.error('Create room error:', err)
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 })
  }
}
