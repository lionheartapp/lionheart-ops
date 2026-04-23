/**
 * GET /api/public/forms/qr/[token]
 *
 * Public endpoint — resolves a QR code token to its scope (category, location).
 * Returns pre-fill data for the ticket submission form.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { resolveQrToken } from '@/lib/services/formQrService'
import { checkAiAvailability } from '@/lib/services/ai/ai-availability'
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

    // Fetch location names for display.
    // NEW ONTOLOGY (Phase 1b): `Area` → `Space`. The response still surfaces
    // `areaId` / `area` as aliases alongside `spaceId` / `space` so the public
    // intake form doesn't break during the rollout window.
    const [building, space, room] = await Promise.all([
      resolved.buildingId
        ? rawPrisma.building.findUnique({
            where: { id: resolved.buildingId },
            select: { id: true, name: true },
          })
        : null,
      resolved.spaceId
        ? rawPrisma.space.findUnique({
            where: { id: resolved.spaceId },
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

    // Check AI availability for this org
    const aiStatus = await checkAiAvailability(resolved.organizationId)

    return NextResponse.json(
      ok({
        organizationId: resolved.organizationId,
        organization: resolved.organization,
        categoryKey: resolved.categoryKey,
        aiAvailable: aiStatus.available,
        location: {
          buildingId: resolved.buildingId,
          spaceId: resolved.spaceId,
          /** @deprecated Phase 1b — use spaceId. Kept as an alias for legacy callers. */
          areaId: resolved.spaceId,
          roomId: resolved.roomId,
          building,
          space,
          /** @deprecated Phase 1b — use space. Kept as an alias for legacy callers. */
          area: space,
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
