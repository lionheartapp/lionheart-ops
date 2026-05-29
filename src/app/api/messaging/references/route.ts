/**
 * GET /api/messaging/references?type=it|maintenance|event&search=...
 *
 * Search tickets or events for the slash-command reference picker.
 * Admins see all tickets; others see only their own.
 * Events: admins see all, others see only their submissions.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { ok } from '@/lib/api-response'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { can, canAny } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

export const GET = withAuth(async ({ ctx, searchParams }) => {
  const type = searchParams.get('type') || ''
  const search = searchParams.get('search') || ''
  const limit = Math.min(Number(searchParams.get('limit')) || 10, 20)
  const db = prisma as unknown as OrgPrismaClient

  // --- Maintenance Tickets ---
  if (type === 'maintenance') {
    const canReadAll = await canAny(ctx.userId, [
      PERMISSIONS.MAINTENANCE_READ_ALL,
    ])

    const where: Record<string, unknown> = {
      status: { notIn: ['DONE', 'CANCELLED'] },
    }

    if (!canReadAll) {
      where.OR = [
        { submittedById: ctx.userId },
        { assignedToId: ctx.userId },
      ]
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { ticketNumber: { contains: search, mode: 'insensitive' } },
          ],
        },
      ]
    }

    const tickets = await db.maintenanceTicket.findMany({
      where,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const results = (tickets as Array<Record<string, unknown>>).map((t) => ({
      id: t.id as string,
      title: `${t.ticketNumber} — ${t.title}`,
      status: t.status as string,
      priority: t.priority as string,
      category: t.category as string,
      type: 'maintenance',
      createdAt: (t.createdAt as Date).toISOString(),
    }))

    return NextResponse.json(ok(results))
  }

  // --- IT Tickets ---
  if (type === 'it') {
    const canReadAll = await canAny(ctx.userId, [
      PERMISSIONS.IT_TICKET_READ_ALL,
    ])

    const where: Record<string, unknown> = {
      status: { notIn: ['DONE', 'CANCELLED'] },
    }

    if (!canReadAll) {
      where.OR = [
        { submittedById: ctx.userId },
        { assignedToId: ctx.userId },
      ]
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { ticketNumber: { contains: search, mode: 'insensitive' } },
          ],
        },
      ]
    }

    const tickets = await db.iTTicket.findMany({
      where,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        status: true,
        priority: true,
        issueType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const results = (tickets as Array<Record<string, unknown>>).map((t) => ({
      id: t.id as string,
      title: `${t.ticketNumber} — ${t.title}`,
      status: t.status as string,
      priority: t.priority as string,
      category: t.issueType as string,
      type: 'it',
      createdAt: (t.createdAt as Date).toISOString(),
    }))

    return NextResponse.json(ok(results))
  }

  // --- Events (uses EventProject — the model the events UI works with) ---
  if (type === 'event') {
    const canReadAllEvents = await can(ctx.userId, PERMISSIONS.EVENTS_READ)

    const where: Record<string, unknown> = {
      status: { notIn: ['CANCELLED'] },
    }

    if (!canReadAllEvents) {
      where.createdById = ctx.userId
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        },
      ]
    }

    const events = await db.eventProject.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        startsAt: true,
      },
      orderBy: { startsAt: 'desc' },
      take: limit,
    })

    const results = (events as Array<Record<string, unknown>>).map((e) => ({
      id: e.id as string,
      title: e.title as string,
      status: e.status as string,
      type: 'event',
      startsAt: (e.startsAt as Date).toISOString(),
    }))

    return NextResponse.json(ok(results))
  }

  // No type — return the categories themselves
  return NextResponse.json(ok([
    { id: 'it', label: 'IT Tickets', description: 'Reference an IT ticket' },
    { id: 'maintenance', label: 'Maintenance Tickets', description: 'Reference a maintenance ticket' },
    { id: 'event', label: 'Events', description: 'Reference an event' },
  ]))
}, { permission: PERMISSIONS.MESSAGING_ACCESS })
