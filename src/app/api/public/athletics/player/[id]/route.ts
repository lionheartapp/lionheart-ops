import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getPublicPlayerProfile } from '@/lib/services/athleticsService'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const player = await getPublicPlayerProfile(id)

    if (!player) {
      return NextResponse.json(fail('NOT_FOUND', 'Player not found'), { status: 404 })
    }

    return NextResponse.json(ok(player))
  } catch {
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch player profile'), { status: 500 })
  }
}
