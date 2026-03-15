/**
 * Activity Signups API for an EventProject.
 *
 * GET    /api/events/projects/[id]/activities/signups?activityId=X — list signups for an activity
 * POST   /api/events/projects/[id]/activities/signups              — sign up participant
 * DELETE /api/events/projects/[id]/activities/signups              — cancel signup
 *
 * Requires: events:groups:manage permission
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getActivitySignups,
  signupForActivity,
  cancelActivitySignup,
} from '@/lib/services/eventGroupService'

type RouteParams = { params: Promise<{ id: string }> }

const signupSchema = z.object({
  registrationId: z.string().min(1),
  activityId: z.string().min(1),
})

const cancelSignupSchema = z.object({
  registrationId: z.string().min(1),
  activityId: z.string().min(1),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: _eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    const url = new URL(req.url)
    const activityId = url.searchParams.get('activityId')
    if (!activityId) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'activityId query parameter is required'),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const signups = await getActivitySignups(activityId)
      return NextResponse.json(ok(signups))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[activity-signups GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: _eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    const body = await req.json()
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      try {
        const signup = await signupForActivity(
          parsed.data.registrationId,
          parsed.data.activityId,
        )
        return NextResponse.json(ok(signup), { status: 201 })
      } catch (err) {
        if (err instanceof Error && err.message === 'Activity is full') {
          return NextResponse.json(
            fail('CAPACITY_FULL', 'Activity is full'),
            { status: 409 },
          )
        }
        throw err
      }
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[activity-signups POST]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: _eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_GROUPS_MANAGE)

    const body = await req.json()
    const parsed = cancelSignupSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      await cancelActivitySignup(parsed.data.registrationId, parsed.data.activityId)
      return NextResponse.json(ok({ cancelled: true }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[activity-signups DELETE]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
