/**
 * GET /api/maintenance/assets — list assets with filters/sort/pagination
 * POST /api/maintenance/assets — create a new asset
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { createAsset, getAssets } from '@/lib/services/maintenanceAssetService'
import type { AssetFilters } from '@/lib/services/maintenanceAssetService'

export const GET = withAuth(async ({ req, orgId, searchParams }) => {
  const filters: AssetFilters = {
    category: searchParams.get('category') || undefined,
    buildingId: searchParams.get('buildingId') || undefined,
    spaceId: searchParams.get('spaceId') || searchParams.get('areaId') || undefined,
    roomId: searchParams.get('roomId') || undefined,
    status: searchParams.get('status') || undefined,
    warrantyStatus: (searchParams.get('warrantyStatus') || undefined) as AssetFilters['warrantyStatus'],
    search: searchParams.get('search') || undefined,
    sortField: (searchParams.get('sortField') || 'assetNumber') as AssetFilters['sortField'],
    sortDir: (searchParams.get('sortDir') || 'asc') as 'asc' | 'desc',
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50,
  }

  const result = await getAssets(orgId, filters)
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.ASSETS_READ })

export const POST = withAuth(async ({ req, orgId }) => {
  const body = await req.json()
  const asset = await createAsset(orgId, body)
  return NextResponse.json(ok(asset), { status: 201 })
}, { permission: PERMISSIONS.ASSETS_CREATE })
