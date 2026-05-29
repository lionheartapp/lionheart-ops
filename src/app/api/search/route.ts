import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

/**
 * @authOnly Global search is signed-in only; ticket and event results are filtered by the caller's permissions.
 */
export const GET = withAuth(async ({ ctx, searchParams, permissions }) => {
  const q = searchParams.get('q')?.trim() || ''
  const limit = Math.min(Number(searchParams.get('limit')) || 5, 10)

  if (q.length < 2) {
    return NextResponse.json(ok({ users: [], events: [], tickets: [], locations: [] }))
  }

  const [canReadEvents, canReadAllTickets, canReadOwnTickets] = await Promise.all([
    permissions.can(PERMISSIONS.EVENTS_READ),
    permissions.can(PERMISSIONS.TICKETS_READ_ALL),
    permissions.can(PERMISSIONS.TICKETS_READ_OWN),
  ])

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
    canReadEvents
      ? prisma.calendarEvent.findMany({
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
        })
      : Promise.resolve([]),
    canReadAllTickets || canReadOwnTickets
      ? prisma.ticket.findMany({
          where: {
            AND: [
              {
                OR: [
                  { title: { contains: q, mode: 'insensitive' } },
                  { description: { contains: q, mode: 'insensitive' } },
                ],
              },
              canReadAllTickets
                ? {}
                : { OR: [{ createdById: ctx.userId }, { assignedToId: ctx.userId }] },
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
        })
      : Promise.resolve([]),
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
