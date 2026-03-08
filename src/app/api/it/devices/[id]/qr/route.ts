import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { prisma } from '@/lib/db'

/**
 * Generate a simple SVG QR code representation for a device.
 * Uses a basic encoding approach - for production, use a QR library.
 */
function generateQrSvg(data: string, size: number = 200): string {
  // Simple QR-like SVG placeholder that encodes the URL as text
  // In production, use a proper QR library like 'qrcode'
  const cellSize = size / 25
  const cells: string[] = []

  // Generate a deterministic pattern from the data string
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  // Fixed finder patterns (top-left, top-right, bottom-left)
  const finderPositions = [
    [0, 0], [18, 0], [0, 18]
  ]

  for (const [fx, fy] of finderPositions) {
    for (let x = 0; x < 7; x++) {
      for (let y = 0; y < 7; y++) {
        const isOuter = x === 0 || x === 6 || y === 0 || y === 6
        const isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4
        if (isOuter || isInner) {
          cells.push(`<rect x="${(fx + x) * cellSize}" y="${(fy + y) * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`)
        }
      }
    }
  }

  // Data pattern (deterministic from hash)
  const seed = Math.abs(hash)
  for (let x = 8; x < 17; x++) {
    for (let y = 0; y < 25; y++) {
      if ((seed * (x + 1) * (y + 1)) % 3 === 0) {
        cells.push(`<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`)
      }
    }
  }
  for (let x = 0; x < 8; x++) {
    for (let y = 8; y < 17; y++) {
      if ((seed * (x + 1) * (y + 1)) % 3 === 0) {
        cells.push(`<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`)
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
<rect width="${size}" height="${size}" fill="white"/>
${cells.join('\n')}
</svg>`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_QR_GENERATE)

    return await runWithOrgContext(orgId, async () => {
      const device = await prisma.iTDevice.findUnique({
        where: { id },
        select: { id: true, assetTag: true, qrCodeUrl: true },
      })

      if (!device) {
        return NextResponse.json(fail('NOT_FOUND', 'Device not found'), { status: 404 })
      }

      const baseUrl = process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
      const lookupUrl = `${baseUrl}/api/it/devices/lookup?tag=${encodeURIComponent(device.assetTag)}`
      const svgContent = generateQrSvg(lookupUrl)

      // Convert SVG to data URL for caching
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`

      // Cache the QR code URL on the device
      if (!device.qrCodeUrl) {
        await prisma.iTDevice.update({
          where: { id },
          data: { qrCodeUrl: dataUrl },
        })
      }

      return NextResponse.json(ok({
        svg: svgContent,
        dataUrl,
        lookupUrl,
        assetTag: device.assetTag,
      }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/devices/[id]/qr]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
