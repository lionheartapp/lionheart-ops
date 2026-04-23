/**
 * GET /api/maintenance/assets/[id]/label
 *
 * Returns asset data needed for client-side jsPDF label generation:
 * assetNumber, name, qrDataUrl (base64 PNG), and optional location string.
 *
 * Client uses this data with label-utils.ts generateSingleLabel().
 */

import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAssetById } from '@/lib/services/maintenanceAssetService'

export const GET = withAuth(async ({ req, orgId, params }) => {
  const asset = await getAssetById(orgId, params.id)
  if (!asset) {
    return NextResponse.json(fail('NOT_FOUND', 'Asset not found'), { status: 404 })
  }

  // Build the asset URL
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const assetUrl = `${appUrl}/maintenance/assets/${params.id}`

  // Generate base64 PNG for jsPDF (PNG works with jsPDF addImage)
  const qrDataUrl = await QRCode.toDataURL(assetUrl, {
    type: 'image/png',
    margin: 2,
    width: 200,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })

  // Build location string — asset includes building, space, room relations from getAssetById
  const assetWithRelations = asset as typeof asset & {
    building?: { name: string } | null
    space?: { name: string } | null
    room?: { roomNumber: string; displayName: string | null } | null
  }
  const locationParts: string[] = []
  if (assetWithRelations.building?.name) locationParts.push(assetWithRelations.building.name)
  if (assetWithRelations.space?.name) locationParts.push(assetWithRelations.space.name)
  if (assetWithRelations.room?.displayName || assetWithRelations.room?.roomNumber) {
    locationParts.push(assetWithRelations.room.displayName || assetWithRelations.room.roomNumber)
  }

  return NextResponse.json(ok({
    assetId: params.id,
    assetNumber: asset.assetNumber,
    name: asset.name,
    qrDataUrl,
    location: locationParts.length > 0 ? locationParts.join(' > ') : undefined,
  }))
}, { permission: PERMISSIONS.ASSETS_READ })
