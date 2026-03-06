/**
 * GET /api/maintenance/assets/[id]/label
 *
 * Returns asset data needed for client-side jsPDF label generation:
 * assetNumber, name, qrDataUrl (base64 PNG), and optional location string.
 *
 * Client uses this data with label-utils.ts generateSingleLabel().
 */

import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getAssetById } from '@/lib/services/maintenanceAssetService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ASSETS_READ)

    const asset = await runWithOrgContext(orgId, () => getAssetById(orgId, id))
    if (!asset) {
      return NextResponse.json(fail('NOT_FOUND', 'Asset not found'), { status: 404 })
    }

    // Build the asset URL
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`
    const assetUrl = `${appUrl}/maintenance/assets/${id}`

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

    // Build location string
    const locationParts: string[] = []
    if ((asset as any).building?.name) locationParts.push((asset as any).building.name)
    if ((asset as any).area?.name) locationParts.push((asset as any).area.name)
    if ((asset as any).room?.displayName || (asset as any).room?.roomNumber) {
      locationParts.push((asset as any).room.displayName || (asset as any).room.roomNumber)
    }

    return NextResponse.json(ok({
      assetId: id,
      assetNumber: asset.assetNumber,
      name: asset.name,
      qrDataUrl,
      location: locationParts.length > 0 ? locationParts.join(' > ') : undefined,
    }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/assets/[id]/label]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
