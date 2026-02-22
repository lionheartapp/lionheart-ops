import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'

export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const buildings = await prisma.building.findMany({
        orderBy: { name: 'asc' },
      })
      return NextResponse.json(buildings)
    })
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const body = (await req.json()) as { name: string; division?: string }
      const name = body.name?.trim()
      if (!name) {
        return NextResponse.json({ error: 'Missing name' }, { status: 400 })
      }
      const building = await prisma.building.create({
        data: {
          name,
          division: body.division === 'ELEMENTARY' || body.division === 'MIDDLE' || body.division === 'HIGH'
            ? body.division
            : undefined,
        },
      })
      return NextResponse.json(building)
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    console.error('Create building error:', err)
    return NextResponse.json({ error: 'Failed to create building' }, { status: 500 })
  }
}
