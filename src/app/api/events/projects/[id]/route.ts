import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getEventProject,
  updateEventProject,
} from '@/lib/services/eventProjectService'
import { UpdateEventProjectSchema } from '@/lib/types/event-project'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/[id]' })

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/events/projects/[id]
 *
 * Returns a single EventProject with schedule blocks, tasks, and activity log.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_READ)

    return await runWithOrgContext(orgId, async () => {
      log.info({ eventProjectId: id, orgId }, 'Fetching EventProject')
      const project = await getEventProject(id)

      if (!project) {
        log.warn({ eventProjectId: id, orgId }, 'EventProject not found — may be org mismatch or deleted')
        return NextResponse.json(fail('NOT_FOUND', `EventProject not found: ${id}`), { status: 404 })
      }

      return NextResponse.json(ok(project))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error, eventProjectId: (await params).id }, 'Failed to fetch EventProject')
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}

/**
 * PATCH /api/events/projects/[id]
 *
 * Updates fields on an EventProject.
 * Requires EVENT_PROJECT_UPDATE_ALL permission.
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    const body = await req.json()

    return await runWithOrgContext(orgId, async () => {
      const validated = UpdateEventProjectSchema.parse(body)
      const updated = await updateEventProject(id, validated, ctx.userId)
      return NextResponse.json(ok(updated))
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    log.error({ err: error }, 'Failed to update EventProject')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/events/projects/[id]
 *
 * Soft-deletes an EventProject (sets deletedAt via the prisma extension).
 * Requires EVENT_PROJECT_DELETE permission.
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_DELETE)

    return await runWithOrgContext(orgId, async () => {
      const db = prisma as any
      await db.eventProject.delete({ where: { id } })
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    log.error({ err: error }, 'Failed to delete EventProject')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
