/**
 * GET /api/it/sync/jobs — sync job history
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { listJobs } from '@/lib/services/itSyncJobService'
import type { SyncJobStatus } from '@prisma/client'

export const GET = withAuth(async ({ searchParams }) => {
  const filters = {
    provider: searchParams.get('provider') || undefined,
    jobType: searchParams.get('jobType') || undefined,
    status: (searchParams.get('status') || undefined) as SyncJobStatus | undefined,
    configId: searchParams.get('configId') || undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
  }

  const result = await listJobs(filters)

  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_DEVICE_SYNC })
