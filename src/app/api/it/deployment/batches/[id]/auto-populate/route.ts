/**
 * POST /api/it/deployment/batches/[id]/auto-populate — auto-populate a batch with devices
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { autoPopulateBatch } from '@/lib/services/itDeploymentService'

export const POST = withAuth(async ({ req, params }) => {
  const body = await req.json()

  const filters = {
    schoolId: body.schoolId || undefined,
    grade: body.grade || undefined,
    deviceType: body.deviceType || undefined,
  }

  const result = await autoPopulateBatch(params.id, filters)
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_DEPLOYMENT_MANAGE })
