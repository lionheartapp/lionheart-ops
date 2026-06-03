import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import {
  assertCanUseAV,
  createAssignment,
  CreateAssignmentSchema,
} from '@/lib/services/avRfService'
import { PERMISSIONS } from '@/lib/permissions'

export const POST = withAuth<z.input<typeof CreateAssignmentSchema>, { id: string }>(async ({ orgId, ctx, params, body }) => {
  await assertCanUseAV(ctx.userId, PERMISSIONS.AV_COORDINATE)
  return NextResponse.json(ok(await createAssignment(orgId, params.id, body)), { status: 201 })
}, { schema: CreateAssignmentSchema })
