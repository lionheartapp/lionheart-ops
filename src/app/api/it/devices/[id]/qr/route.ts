/**
 * GET /api/it/devices/[id]/qr — generate QR code for device
 */

import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'

export const GET = withAuth(async ({ params }) => {
  const device = await prisma.iTDevice.findUnique({
    where: { id: params.id },
    select: { id: true, assetTag: true, qrCodeUrl: true },
  })

  if (!device) {
    return NextResponse.json(fail('NOT_FOUND', 'Device not found'), { status: 404 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
  const lookupUrl = `${baseUrl}/api/it/devices/lookup?tag=${encodeURIComponent(device.assetTag)}`

  // Generate a real, scannable SVG QR code
  const svgContent = await QRCode.toString(lookupUrl, {
    type: 'svg',
    margin: 2,
    width: 300,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  })

  // Convert SVG to data URL for caching
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`

  // Cache the QR code URL on the device
  if (!device.qrCodeUrl) {
    await prisma.iTDevice.update({
      where: { id: params.id },
      data: { qrCodeUrl: dataUrl },
    })
  }

  return NextResponse.json(ok({
    svg: svgContent,
    dataUrl,
    lookupUrl,
    assetTag: device.assetTag,
  }))
}, { permission: PERMISSIONS.IT_QR_GENERATE })
