/**
 * GET /api/maintenance/assets/[id] — get asset detail with relations
 * PATCH /api/maintenance/assets/[id] — update asset
 * DELETE /api/maintenance/assets/[id] — soft-delete asset
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAssetWithDetails, updateAsset, deleteAsset } from '@/lib/services/maintenanceAssetService'

export const GET = withAuth(async ({ orgId, params }) => {
  const asset = await getAssetWithDetails(orgId, params.id)
  if (!asset) {
    return NextResponse.json(fail('NOT_FOUND', 'Asset not found'), { status: 404 })
  }
  return NextResponse.json(ok(asset))
}, { permission: PERMISSIONS.ASSETS_READ })

export const PATCH = withAuth(async ({ req, orgId, params }) => {
  const body = await req.json()
  const asset = await updateAsset(orgId, params.id, body)
  return NextResponse.json(ok(asset))
}, { permission: PERMISSIONS.ASSETS_UPDATE })

export const DELETE = withAuth(async ({ orgId, params }) => {
  await deleteAsset(orgId, params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.ASSETS_DELETE })
