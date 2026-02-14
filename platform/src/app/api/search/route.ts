import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { corsHeaders } from '@/lib/cors'

/** Unified search across rooms, teachers, and active maintenance tickets */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || ''
  if (!q) return NextResponse.json({ rooms: [], teachers: [], tickets: [] }, { headers: corsHeaders })

  const qLower = q.toLowerCase()
  const words = qLower.split(/\s+/).filter(Boolean)
  const match = (s: string) => s && (words.length === 0 || words.some((w) => (s ?? '').toLowerCase().includes(w)))

  try {
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
  } catch {
    return NextResponse.json(getMockSearchData(qLower), { headers: corsHeaders })
  }
}

function getMockSearchData(qLower: string) {
  const rooms: Array<{ id: string; name: string; buildingName: string; teacherName?: string | null; ticketCount: number }> = []
  const teachers: Array<{ id: string; name: string | null; roomId: string; roomName: string; buildingName: string }> = []
  const tickets: Array<{ id: string; title: string; roomId: string; roomName: string; status: string }> = []
  const mockTeachers = [
    { id: 'u1', name: 'Sarah Johnson', roomId: 'r1', roomName: 'Room 101', buildingName: 'Main Building' },
    { id: 'u2', name: 'Mrs. Smith', roomId: 'r2', roomName: 'Room 204', buildingName: 'Main Building' },
  ]
  const words = qLower.split(/\s+/).filter(Boolean)
  const match = (s: string) => s && words.some((w) => (s ?? '').toLowerCase().includes(w))
  for (const t of mockTeachers) {
    if (match(t.name ?? '') || match(t.roomName) || match(t.buildingName)) {
      teachers.push(t)
      rooms.push({ id: t.roomId, name: t.roomName, buildingName: t.buildingName, teacherName: t.name, ticketCount: t.roomId === 'r1' ? 1 : 0 })
      if (t.roomId === 'r1') tickets.push({ id: 't1', title: 'Leaking faucet', roomId: 'r1', roomName: 'Room 101', status: 'NEW' })
    }
  }
  if (qLower.includes('101') || qLower.includes('204') || qLower.includes('room')) {
    if (!rooms.some((r) => r.id === 'r1')) rooms.push({ id: 'r1', name: 'Room 101', buildingName: 'Main Building', teacherName: 'Sarah Johnson', ticketCount: 1 })
    if (!rooms.some((r) => r.id === 'r2')) rooms.push({ id: 'r2', name: 'Room 204', buildingName: 'Main Building', teacherName: 'Mrs. Smith', ticketCount: 0 })
    if (!tickets.length) tickets.push({ id: 't1', title: 'Leaking faucet', roomId: 'r1', roomName: 'Room 101', status: 'NEW' })
  }
  return { rooms, teachers, tickets }
}
