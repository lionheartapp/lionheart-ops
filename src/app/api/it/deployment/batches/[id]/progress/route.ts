/**
 * GET /api/it/deployment/batches/[id]/progress — get batch processing progress
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getBatchProgress } from '@/lib/services/itDeploymentService'

export const GET = withAuth(async ({ params }) => {
  const progress = await getBatchProgress(params.id)
  return NextResponse.json(ok(progress))
}, { permission: PERMISSIONS.IT_DEPLOYMENT_PROCESS })
