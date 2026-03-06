/**
 * GET /api/maintenance/assets/[id]/qr — Generate QR code SVG for an asset
 *
 * Returns an SVG QR code encoding the asset's public URL.
 * Cached immutably since the URL never changes per asset.
 */

import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { fail } from '@/lib/api-response'
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

    // Verify asset exists
    const asset = await runWithOrgContext(orgId, () => getAssetById(orgId, id))
    if (!asset) {
      return NextResponse.json(fail('NOT_FOUND', 'Asset not found'), { status: 404 })
    }

    // Build the asset URL — use NEXT_PUBLIC_APP_URL or fallback to request origin
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`
    const assetUrl = `${appUrl}/maintenance/assets/${id}`

    // Generate SVG QR code
    const svg = await QRCode.toString(assetUrl, {
      type: 'svg',
      margin: 2,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/maintenance/assets/[id]/qr]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
