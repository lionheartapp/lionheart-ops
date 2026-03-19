import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { CreateScheduleSectionSchema } from '@/lib/types/event-project'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/[id]/schedule/sections' })

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/events/projects/[id]/schedule/sections
 *
 * Returns all schedule sections for an EventProject, ordered by sortOrder.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_READ)

    return await runWithOrgContext(orgId, async () => {
      const db = prisma as any
      const sections = await db.eventScheduleSection.findMany({
        where: { eventProjectId: id },
        orderBy: { sortOrder: 'asc' },
      })
      return NextResponse.json(ok(sections))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to list schedule sections')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}

/**
 * POST /api/events/projects/[id]/schedule/sections
 *
 * Creates a new schedule section within an EventProject.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const validated = CreateScheduleSectionSchema.parse(body)
      const db = prisma as any

      // Auto-assign sortOrder if not provided
      if (validated.sortOrder === 0) {
        const lastSection = await db.eventScheduleSection.findFirst({
          where: { eventProjectId: id },
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        })
        validated.sortOrder = lastSection ? lastSection.sortOrder + 1 : 0
      }

      const section = await db.eventScheduleSection.create({
        data: {
          eventProjectId: id,
          title: validated.title,
          sortOrder: validated.sortOrder,
        },
      })
      return NextResponse.json(ok(section), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to create schedule section')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
