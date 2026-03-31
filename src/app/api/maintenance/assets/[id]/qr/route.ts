/**
 * GET /api/maintenance/assets/[id]/qr — Generate QR code SVG for an asset
 *
 * Returns an SVG QR code encoding the asset's public URL.
 * Cached immutably since the URL never changes per asset.
 */

import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getAssetById } from '@/lib/services/maintenanceAssetService'

export const GET = withAuth(async ({ req, orgId, params }) => {
  // Verify asset exists
  const asset = await getAssetById(orgId, params.id)
  if (!asset) {
    return NextResponse.json(fail('NOT_FOUND', 'Asset not found'), { status: 404 })
  }

  // Build the asset URL — use NEXT_PUBLIC_APP_URL or fallback to request origin
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const assetUrl = `${appUrl}/maintenance/assets/${params.id}`

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
}, { permission: PERMISSIONS.ASSETS_READ })
