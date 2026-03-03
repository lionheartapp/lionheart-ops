import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    await getUserContext(req)

    const url = new URL(req.url)
    const q = url.searchParams.get('q')?.trim() || ''
    const limit = Math.min(Number(url.searchParams.get('limit')) || 5, 10)

    if (q.length < 2) {
      return NextResponse.json(ok({ users: [], events: [], tickets: [], locations: [] }))
    }

    return await runWithOrgContext(orgId, async () => {
      const [users, events, tickets, locations] = await Promise.all([
        prisma.user.findMany({
          where: {
            status: 'ACTIVE',
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            jobTitle: true,
          },
          take: limit,
        }),
        prisma.calendarEvent.findMany({
          where: {
            title: { contains: q, mode: 'insensitive' },
          },
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            isAllDay: true,
            calendar: { select: { name: true, color: true } },
          },
          orderBy: { startTime: 'desc' },
          take: limit,
        }),
        prisma.ticket.findMany({
          where: {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.building.findMany({
          where: {
            name: { contains: q, mode: 'insensitive' },
          },
          select: {
            id: true,
            name: true,
          },
          take: limit,
        }),
      ])

      return NextResponse.json(ok({ users, events, tickets, locations }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
