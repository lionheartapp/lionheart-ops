import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import {
  listEventProjects,
  createEventProject,
} from '@/lib/services/eventProjectService'
import { CreateEventProjectSchema } from '@/lib/types/event-project'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects' })

/**
 * GET /api/events/projects
 *
 * Returns a paginated list of EventProjects for the current org.
 * Optional filters: status, campusId, schoolId, createdById
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_READ)

    return await runWithOrgContext(orgId, async () => {
      const { searchParams } = new URL(req.url)
      const { page, limit, skip } = parsePagination(searchParams)

      const status = searchParams.get('status') ?? undefined
      const campusId = searchParams.get('campusId') ?? undefined
      const schoolId = searchParams.get('schoolId') ?? undefined
      const createdById = searchParams.get('createdById') ?? undefined

      const filters = { status, campusId, schoolId, createdById }

      const projects = await listEventProjects(filters)

      // listEventProjects returns all matching records; slice for pagination
      const total = projects.length
      const paged = projects.slice(skip, skip + limit)

      return NextResponse.json(ok(paged, paginationMeta(total, { page, limit, skip })))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to list EventProjects')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}

/**
 * POST /api/events/projects
 *
 * Creates a new EventProject via the DIRECT_REQUEST path.
 * Status will be PENDING_APPROVAL — an admin must approve it before
 * a CalendarEvent bridge is created.
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_CREATE)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const validated = CreateEventProjectSchema.parse(body)
      const project = await createEventProject(validated, ctx.userId, 'DIRECT_REQUEST')
      return NextResponse.json(ok(project), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to create EventProject')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
