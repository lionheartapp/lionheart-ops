/**
 * POST /api/maintenance/assets/labels
 *
 * Accepts { assetIds: string[] } and returns an array of label data
 * for client-side jsPDF Avery 5160 batch generation.
 *
 * Client uses label-utils.ts generateBatchLabels().
 */

import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'

const BatchLabelSchema = z.object({
  assetIds: z.array(z.string()).min(1).max(30),
})

export const POST = withAuth(async ({ req, orgId, body }) => {
  // Build the asset URL base
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`

  const assets = await prisma.maintenanceAsset.findMany({
    where: { id: { in: body.assetIds } },
    select: {
      id: true,
      assetNumber: true,
      name: true,
      building: { select: { name: true } },
      space: { select: { name: true } },
      room: { select: { displayName: true, roomNumber: true } },
    },
  })

  // Generate QR base64 PNGs in parallel
  const labelData = await Promise.all(
    assets.map(async (asset) => {
      const assetUrl = `${appUrl}/maintenance/assets/${asset.id}`
      const qrDataUrl = await QRCode.toDataURL(assetUrl, {
        type: 'image/png',
        margin: 2,
        width: 150,
      })

      const locationParts: string[] = []
      if (asset.building?.name) locationParts.push(asset.building.name)
      if (asset.space?.name) locationParts.push(asset.space.name)
      if (asset.room?.displayName || asset.room?.roomNumber) {
        locationParts.push(asset.room.displayName || asset.room.roomNumber)
      }

      return {
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        name: asset.name,
        qrDataUrl,
        location: locationParts.length > 0 ? locationParts.join(' > ') : undefined,
      }
    })
  )

  return NextResponse.json(ok(labelData))
}, { permission: PERMISSIONS.ASSETS_READ, schema: BatchLabelSchema })
