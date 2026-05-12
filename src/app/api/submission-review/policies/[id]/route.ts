/**
 * GET    /api/submission-review/policies/:id — get a single policy
 * PATCH  /api/submission-review/policies/:id — update a policy
 * DELETE /api/submission-review/policies/:id — delete a policy
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getPolicyById,
  updatePolicy,
  deletePolicy,
  updatePolicySchema,
} from '@/lib/services/submissionReviewService'

export const GET = withAuth(async ({ params }) => {
  const policy = await getPolicyById(params.id)
  if (!policy) {
    return NextResponse.json(ok(null), { status: 404 })
  }
  return NextResponse.json(ok(policy))
}, { permission: PERMISSIONS.SR_ASSIGNMENT_READ })

export const PATCH = withAuth(async ({ ctx, params, body }) => {
  const policy = await updatePolicy(params.id, ctx.userId, body)
  return NextResponse.json(ok(policy))
}, { permission: PERMISSIONS.SR_POLICY_MANAGE, schema: updatePolicySchema })

export const DELETE = withAuth(async ({ params }) => {
  await deletePolicy(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.SR_POLICY_MANAGE })
