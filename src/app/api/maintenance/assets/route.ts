/**
 * GET /api/maintenance/assets — list assets with filters/sort/pagination
 * POST /api/maintenance/assets — create a new asset
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { createAsset, getAssets } from '@/lib/services/maintenanceAssetService'
import type { AssetFilters } from '@/lib/services/maintenanceAssetService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/maintenance/assets', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)
    await assertCan(ctx.userId, PERMISSIONS.ASSETS_READ)

    const url = new URL(req.url)
    const filters: AssetFilters = {
      category: url.searchParams.get('category') || undefined,
      buildingId: url.searchParams.get('buildingId') || undefined,
      areaId: url.searchParams.get('areaId') || undefined,
      roomId: url.searchParams.get('roomId') || undefined,
      status: url.searchParams.get('status') || undefined,
      warrantyStatus: (url.searchParams.get('warrantyStatus') || undefined) as AssetFilters['warrantyStatus'],
      search: url.searchParams.get('search') || undefined,
      sortField: (url.searchParams.get('sortField') || 'assetNumber') as AssetFilters['sortField'],
      sortDir: (url.searchParams.get('sortDir') || 'asc') as 'asc' | 'desc',
      page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!, 10) : 1,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50,
    }

    const result = await runWithOrgContext(orgId, () => getAssets(orgId, filters))
    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to list maintenance assets')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/maintenance/assets', method: 'POST' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)
    await assertCan(ctx.userId, PERMISSIONS.ASSETS_CREATE)

    const body = await req.json()

    const asset = await runWithOrgContext(orgId, () => createAsset(orgId, body))
    return NextResponse.json(ok(asset), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'Invalid request data', [error.message]),
          { status: 400 }
        )
      }
    }
    log.error({ err: error }, 'Failed to create maintenance asset')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
