import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { listTeamMembers, addTeamMember } from '@/lib/services/eventTeamService'
import { AddEventTeamMemberSchema } from '@/lib/types/event-project'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const log = logger.child({ route: '/api/events/projects/[id]/team' })

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/events/projects/[id]/team
 *
 * Returns all team members for an EventProject.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_READ)

    return await runWithOrgContext(orgId, async () => {
      const members = await listTeamMembers(id)
      return NextResponse.json(ok(members))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to list team members')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}

/**
 * POST /api/events/projects/[id]/team
 *
 * Adds a user to the event's team.
 * Returns 409 if user is already a team member.
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
      const validated = AddEventTeamMemberSchema.parse(body)
      const member = await addTeamMember(id, validated, ctx.userId)
      return NextResponse.json(ok(member), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    // Prisma unique constraint violation (P2002) — user already on team
    if (error instanceof Error && 'code' in error && (error as any).code === 'P2002') {
      return NextResponse.json(fail('CONFLICT', 'This user is already a team member'), { status: 409 })
    }
    log.error({ err: error }, 'Failed to add team member')
    Sentry.captureException(error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal server error'),
      { status: 500 },
    )
  }
}
