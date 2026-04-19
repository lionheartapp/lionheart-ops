/**
 * GET /api/public/forms/qr/[token]
 *
 * Public endpoint — resolves a QR code token to its scope (category, location).
 * Returns pre-fill data for the ticket submission form.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { resolveQrToken } from '@/lib/services/formQrService'
import { rawPrisma } from '@/lib/db'

type RouteParams = { params: Promise<{ token: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params

    const resolved = await resolveQrToken(token)

    if (!resolved) {
      return NextResponse.json(
        fail('NOT_FOUND', 'This QR code is no longer active.'),
        { status: 404 }
      )
    }

    // Fetch location names for display
    const [building, area, room] = await Promise.all([
      resolved.buildingId
        ? rawPrisma.building.findUnique({
            where: { id: resolved.buildingId },
            select: { id: true, name: true },
          })
        : null,
      resolved.areaId
        ? rawPrisma.area.findUnique({
            where: { id: resolved.areaId },
            select: { id: true, name: true },
          })
        : null,
      resolved.roomId
        ? rawPrisma.room.findUnique({
            where: { id: resolved.roomId },
            select: { id: true, roomNumber: true, displayName: true },
          })
        : null,
    ])

    return NextResponse.json(
      ok({
        organizationId: resolved.organizationId,
        organization: resolved.organization,
        categoryKey: resolved.categoryKey,
        location: {
          buildingId: resolved.buildingId,
          areaId: resolved.areaId,
          roomId: resolved.roomId,
          building,
          area,
          room,
        },
        label: resolved.label,
      })
    )
  } catch {
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Something went wrong'),
      { status: 500 }
    )
  }
}
