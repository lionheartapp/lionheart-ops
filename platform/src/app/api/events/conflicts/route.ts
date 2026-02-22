import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'

function timeToMinutes(t: string): number {
  const [h, m] = (t || '00:00').split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string, bufferMinutes: number): boolean {
  const aS = timeToMinutes(aStart)
  const aE = timeToMinutes(aEnd || aStart)
  const bS = timeToMinutes(bStart)
  const bE = timeToMinutes(bEnd || bStart)
  return aS - bufferMinutes < bE && bS < aE + bufferMinutes
}

export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
    const body = (await req.json()) as {
      date?: string
      startTime?: string
      endTime?: string
      roomId?: string
      chairsRequested?: number
      tablesRequested?: number
      location?: string
    }

    const date = body.date
    const startTime = body.startTime || '00:00'
    const endTime = body.endTime || body.startTime || '23:59'
    const roomId = body.roomId
    const chairsRequested = body.chairsRequested ?? 0
    const tablesRequested = body.tablesRequested ?? 0
    const location = body.location || ''

    const warnings: string[] = []

    // 1a. Inventory check: chairs exceed stock for that location/time
    if (chairsRequested > 0) {
      const chairItem = await prisma.inventoryItem.findFirst({
        where: {
          OR: [
            { name: { contains: 'chair', mode: 'insensitive' } },
            { name: { contains: 'Chair', mode: 'insensitive' } },
          ],
        },
        include: { stock: true },
      })
      if (chairItem) {
        const totalStock = chairItem.stock.reduce((sum, s) => sum + s.quantity, 0)
        const locStock = location
          ? chairItem.stock
              .filter((s) => s.location.toLowerCase().includes(location.toLowerCase()))
              .reduce((sum, s) => sum + s.quantity, 0)
          : 0
        const available = locStock > 0 ? locStock : totalStock
        if (chairsRequested > available) {
          warnings.push(
            `Chairs requested (${chairsRequested}) exceeds available stock (${available}${location ? ` at ${location}` : ''}).`
          )
        }
      }
    }

    // 1b. Inventory check: tables exceed stock for that location/time
    if (tablesRequested > 0) {
      const tableItem = await prisma.inventoryItem.findFirst({
        where: { name: { contains: 'table', mode: 'insensitive' } },
        include: { stock: true },
      })
      if (tableItem) {
        const totalStock = tableItem.stock.reduce((sum, s) => sum + s.quantity, 0)
        const locStock = location
          ? tableItem.stock
              .filter((s) => s.location.toLowerCase().includes(location.toLowerCase()))
              .reduce((sum, s) => sum + s.quantity, 0)
          : 0
        const available = locStock > 0 ? locStock : totalStock
        if (tablesRequested > available) {
          warnings.push(
            `Tables requested (${tablesRequested}) exceeds available stock (${available}${location ? ` at ${location}` : ''}).`
          )
        }
      }
    }

    // 2. Proximal conflict: another event within 30 min in same or adjacent room
    if (date && roomId) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { building: true, events: { where: { date } } },
      })
      if (room) {
        const adjacentIds = new Set(room.adjacentRoomIds || [])
        adjacentIds.add(roomId) // include self
        const candidateRoomIds = Array.from(adjacentIds)

        const otherEvents = await prisma.event.findMany({
          where: {
            date,
            roomId: { in: candidateRoomIds },
            status: { not: 'REJECTED' },
          },
        })

        for (const ev of otherEvents) {
          if (ev.id && overlaps(startTime, endTime, ev.startTime, ev.endTime || ev.startTime, 30)) {
            warnings.push(
              `Proximal conflict: "${ev.name}" is scheduled ${ev.startTime}–${ev.endTime || '?'} in a nearby room.`
            )
          }
        }
      }
    } else if (date && location) {
      // Fallback: match by location name when roomId not resolved
      const rooms = await prisma.room.findMany({
        where: { name: { contains: location, mode: 'insensitive' } },
        include: { events: { where: { date } } },
      })
      for (const room of rooms) {
        for (const ev of room.events) {
          if (overlaps(startTime, endTime, ev.startTime, ev.endTime || ev.startTime, 30)) {
            warnings.push(
              `Proximal conflict: "${ev.name}" at ${room.name} ${ev.startTime}–${ev.endTime || '?'}.`
            )
          }
        }
      }
    }

    return NextResponse.json({
      hasConflict: warnings.length > 0,
      warnings,
    })
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message, hasConflict: false, warnings: [] }, { status: 401 })
    }
    console.error('Conflicts check error:', err)
    return NextResponse.json({ hasConflict: false, warnings: [] })
  }
}
