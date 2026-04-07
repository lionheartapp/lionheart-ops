import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { CreateScheduleSectionSchema } from '@/lib/types/event-project'

/**
 * GET /api/events/projects/[id]/schedule/sections?date=2026-04-09
 *
 * Returns schedule sections for an EventProject, filtered by date if provided.
 * Ordered by sortOrder ascending.
 */
export const GET = withAuth(async ({ params, searchParams }) => {
  const db = prisma as unknown as OrgPrismaClient
  const where: Record<string, unknown> = { eventProjectId: params.id }

  // Filter by date if provided (expects ISO date string like "2026-04-09")
  const dateParam = searchParams.get('date')
  if (dateParam) {
    where.date = new Date(dateParam + 'T00:00:00.000Z')
  }

  const sections = await db.eventScheduleSection.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
  })
  return NextResponse.json(ok(sections))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })

/**
 * POST /api/events/projects/[id]/schedule/sections
 *
 * Creates a new schedule section within an EventProject for a specific date.
 */
export const POST = withAuth(async ({ params, body }) => {
  const db = prisma as unknown as OrgPrismaClient
  const sectionDate = new Date(body.date + 'T00:00:00.000Z')

  // Auto-assign sortOrder — find the last section for this specific date
  const sortOrder = body.sortOrder === 0
    ? await db.eventScheduleSection.findFirst({
        where: { eventProjectId: params.id, date: sectionDate },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      }).then((last: { sortOrder: number } | null) => last ? last.sortOrder + 1 : 0)
    : body.sortOrder

  const section = await db.eventScheduleSection.create({
    data: {
      eventProjectId: params.id,
      date: sectionDate,
      title: body.title,
      startTime: body.startTime,
      layout: body.layout,
      sortOrder,
    },
  })
  return NextResponse.json(ok(section), { status: 201 })
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL, schema: CreateScheduleSectionSchema })
