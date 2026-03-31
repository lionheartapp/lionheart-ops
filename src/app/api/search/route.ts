import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'

export const GET = withAuth(async ({ searchParams }) => {
  const q = searchParams.get('q')?.trim() || ''
  const limit = Math.min(Number(searchParams.get('limit')) || 5, 10)

  if (q.length < 2) {
    return NextResponse.json(ok({ users: [], events: [], tickets: [], locations: [] }))
  }

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
