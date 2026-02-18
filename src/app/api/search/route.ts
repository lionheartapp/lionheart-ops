import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

/** Unified search across rooms, teachers, and active maintenance tickets */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || ''
  if (!q) return NextResponse.json({ rooms: [], teachers: [], tickets: [] }, { headers: corsHeaders })

  const qLower = q.toLowerCase()
  const words = qLower.split(/\s+/).filter(Boolean)
  const match = (s: string) => s && (words.length === 0 || words.some((w) => (s ?? '').toLowerCase().includes(w)))

  try {
    return await withOrg(req, prismaBase, async () => {
    const buildings = await prisma.building.findMany({
      include: {
        rooms: {
          include: {
            tickets: {
              where: { category: 'MAINTENANCE', status: { not: 'RESOLVED' } },
              include: { submittedBy: true },
            },
            teacherSchedules: { include: { user: true } },
          },
        },
      },
    })

    const rooms: Array<{
      id: string
      name: string
      buildingName: string
      teacherName?: string | null
      ticketCount: number
    }> = []
    const teachers = new Map<string, { id: string; name: string | null; roomId: string; roomName: string; buildingName: string }>()
    const tickets: Array<{
      id: string
      title: string
      roomId: string
      roomName: string
      status: string
    }> = []

    for (const b of buildings) {
      for (const r of b.rooms) {
        const teacher = r.teacherSchedules?.[0]?.user
        const teacherName = teacher?.name ?? null
        const ticketList = r.tickets ?? []
        const roomMatch = match(r.name) || match(b.name) || match(teacherName ?? '')

        if (roomMatch) {
          rooms.push({
            id: r.id,
            name: r.name,
            buildingName: b.name,
            teacherName,
            ticketCount: ticketList.length,
          })
        }

        if (teacherName && match(teacherName)) {
          teachers.set(teacher!.id, {
            id: teacher!.id,
            name: teacherName,
            roomId: r.id,
            roomName: r.name,
            buildingName: b.name,
          })
        }

        for (const t of ticketList) {
          if (match(t.title) || match(r.name) || match(teacherName ?? '')) {
            tickets.push({
              id: t.id,
              title: t.title,
              roomId: r.id,
              roomName: r.name,
              status: t.status,
            })
          }
        }
      }
    }

    return NextResponse.json(
      { rooms, teachers: Array.from(teachers.values()), tickets },
      { headers: corsHeaders }
    )
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json(
        { error: err.message, rooms: [], teachers: [], tickets: [] },
        { status: 401, headers: corsHeaders }
      )
    }
    console.error('Search error:', err)
    return NextResponse.json(
      { error: 'Search failed', rooms: [], teachers: [], tickets: [] },
      { status: 500, headers: corsHeaders }
    )
  }
}
