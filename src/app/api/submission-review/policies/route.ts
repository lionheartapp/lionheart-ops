/**
 * GET  /api/submission-review/policies — list AI policies
 * POST /api/submission-review/policies — create a new AI policy
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getPolicies,
  createPolicy,
  createPolicySchema,
} from '@/lib/services/submissionReviewService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const policies = await getPolicies(orgId, {
    schoolId: searchParams.get('schoolId') || undefined,
    scope: searchParams.get('scope') || undefined,
  })
  return NextResponse.json(ok(policies))
}, { permission: PERMISSIONS.SR_ASSIGNMENT_READ })

export const POST = withAuth(async ({ orgId, ctx, body }) => {
  const policy = await createPolicy(orgId, ctx.userId, body)
  return NextResponse.json(ok(policy), { status: 201 })
}, { permission: PERMISSIONS.SR_POLICY_MANAGE, schema: createPolicySchema })
