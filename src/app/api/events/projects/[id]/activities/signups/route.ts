/**
 * Activity Signups API for an EventProject.
 *
 * GET    /api/events/projects/[id]/activities/signups?activityId=X — list signups for an activity
 * POST   /api/events/projects/[id]/activities/signups              — sign up participant
 * DELETE /api/events/projects/[id]/activities/signups              — cancel signup
 *
 * Requires: events:groups:manage permission
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getActivitySignups,
  signupForActivity,
  cancelActivitySignup,
} from '@/lib/services/eventGroupService'

const signupSchema = z.object({
  registrationId: z.string().min(1),
  activityId: z.string().min(1),
})

const cancelSignupSchema = z.object({
  registrationId: z.string().min(1),
  activityId: z.string().min(1),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET = withAuth(async ({ searchParams }) => {
  const activityId = searchParams.get('activityId')
  if (!activityId) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'activityId query parameter is required'),
      { status: 400 },
    )
  }

  const signups = await getActivitySignups(activityId)
  return NextResponse.json(ok(signups))
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE })

// ─── POST ─────────────────────────────────────────────────────────────────────

export const POST = withAuth(async ({ body }) => {
  try {
    const signup = await signupForActivity(
      body.registrationId,
      body.activityId,
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
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE, schema: signupSchema })

// ─── DELETE ───────────────────────────────────────────────────────────────────

export const DELETE = withAuth(async ({ body }) => {
  await cancelActivitySignup(body.registrationId, body.activityId)
  return NextResponse.json(ok({ cancelled: true }))
}, { permission: PERMISSIONS.EVENTS_GROUPS_MANAGE, schema: cancelSignupSchema })
