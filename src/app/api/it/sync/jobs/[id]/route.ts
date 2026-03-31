/**
 * GET /api/it/sync/jobs/[id] — sync job detail
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getJob } from '@/lib/services/itSyncJobService'

export const GET = withAuth(async ({ params }) => {
  const job = await getJob(params.id)

  if (!job) {
    throw new Error('Job not found')
  }

  return NextResponse.json(ok(job))
}, { permission: PERMISSIONS.IT_DEVICE_SYNC })
