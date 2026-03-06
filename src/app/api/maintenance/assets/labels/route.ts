/**
 * POST /api/maintenance/assets/labels
 *
 * Accepts { assetIds: string[] } and returns an array of label data
 * for client-side jsPDF Avery 5160 batch generation.
 *
 * Client uses label-utils.ts generateBatchLabels().
 */

import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'

const BatchLabelSchema = z.object({
  assetIds: z.array(z.string()).min(1).max(30),
})

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.ASSETS_READ)

    const body = await req.json()
    const { assetIds } = BatchLabelSchema.parse(body)

    // Build the asset URL base
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`

    const assets = await runWithOrgContext(orgId, () =>
      prisma.maintenanceAsset.findMany({
        where: { id: { in: assetIds } },
        select: {
          id: true,
          assetNumber: true,
          name: true,
          building: { select: { name: true } },
          area: { select: { name: true } },
          room: { select: { displayName: true, roomNumber: true } },
        },
      })
    )

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
        if (asset.area?.name) locationParts.push(asset.area.name)
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
    console.error('[POST /api/maintenance/assets/labels]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
