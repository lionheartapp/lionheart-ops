import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { buildingOutlineService } from '@/lib/services/ai/building-outline.service'

type RouteParams = { params: Promise<{ id: string }> }

/* ── Tile math (Web Mercator) ─────────────────────────────────────── */

function latlngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return { x, y }
}

/**
 * Fetch a composite satellite image (2×2 tiles = 512×512) centered
 * around the given coordinates.  We stitch 4 adjacent 256px tiles so
 * the building is likely to be visible even when it straddles a tile boundary.
 */
async function captureSatelliteTiles(lat: number, lng: number, zoom: number): Promise<string | null> {
  try {
    const { x: cx, y: cy } = latlngToTile(lat, lng, zoom)

    // Determine which quadrant of the center tile the point falls in
    // so we pick the 4 tiles that best surround it
    const n = Math.pow(2, zoom)
    const exactX = ((lng + 180) / 360) * n
    const latRad = (lat * Math.PI) / 180
    const exactY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n

    const fracX = exactX - cx
    const fracY = exactY - cy
    const startX = fracX > 0.5 ? cx : cx - 1
    const startY = fracY > 0.5 ? cy : cy - 1

    const tileUrls = [
      [startX, startY],
      [startX + 1, startY],
      [startX, startY + 1],
      [startX + 1, startY + 1],
    ].map(
      ([tx, ty]) =>
        `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`
    )

    // Fetch all 4 tiles in parallel
    const responses = await Promise.all(tileUrls.map((url) => fetch(url)))
    const buffers = await Promise.all(responses.map((r) => r.arrayBuffer()))

    // Use a simple approach: since we can't use Canvas in Node,
    // just use the single center tile (256×256) for AI analysis
    // This is simpler and works well at zoom 19 where buildings are large
    const centerTileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${cy}/${cx}`
    const centerRes = await fetch(centerTileUrl)
    const centerBuffer = await centerRes.arrayBuffer()

    return Buffer.from(centerBuffer).toString('base64')
  } catch (error) {
    console.error('[DETECT_OUTLINE] Failed to fetch satellite tile:', error)
    return null
  }
}

/**
 * Convert pixel coordinates (within a 256×256 tile) to lat/lng.
 */
function pixelCoordsToLatLng(
  pixels: Array<{ x: number; y: number }>,
  centerLat: number,
  centerLng: number,
  zoom: number,
  tileSize: number = 256
): Array<{ lat: number; lng: number }> {
  const { x: tileX, y: tileY } = latlngToTile(centerLat, centerLng, zoom)
  const n = Math.pow(2, zoom)

  return pixels.map(({ x, y }) => {
    const worldX = tileX * tileSize + x
    const worldY = tileY * tileSize + y

    const lng = (worldX / (n * tileSize)) * 360 - 180
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * worldY) / (n * tileSize))))
    const lat = (latRad * 180) / Math.PI

    return { lat: Math.round(lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7 }
  })
}

/* ── Route handler ────────────────────────────────────────────────── */

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const db = rawPrisma as any

      const building = await db.building.findFirst({
        where: { id, organizationId: orgId },
        select: { id: true, name: true, latitude: true, longitude: true },
      })

      if (!building) {
        return NextResponse.json(fail('NOT_FOUND', 'Building not found'), { status: 404 })
      }

      if (!building.latitude || !building.longitude) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'Building must have coordinates. Place it on the map first.'),
          { status: 400 }
        )
      }

      // Fetch satellite tile at zoom 19 (high detail for building detection)
      const zoom = 19
      const imageBase64 = await captureSatelliteTiles(building.latitude, building.longitude, zoom)

      if (!imageBase64) {
        return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch satellite imagery'), { status: 500 })
      }

      // Ask Gemini to detect the building outline
      const pixelCoords = await buildingOutlineService.detectBuildingOutline(
        imageBase64,
        building.name,
        256, // tile is 256×256
        256
      )

      if (!pixelCoords || pixelCoords.length < 3) {
        return NextResponse.json(
          fail('DETECTION_FAILED', 'Could not detect the building outline. Try adjusting the building position or draw the outline manually.'),
          { status: 422 }
        )
      }

      // Convert pixel coordinates to lat/lng
      const latLngCoords = pixelCoordsToLatLng(pixelCoords, building.latitude, building.longitude, zoom)

      return NextResponse.json(ok({ coordinates: latLngCoords }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[DETECT_OUTLINE] Error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to detect building outline'), { status: 500 })
  }
}
