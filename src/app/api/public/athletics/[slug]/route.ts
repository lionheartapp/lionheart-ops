import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getPublicScheduleData } from '@/lib/services/athleticsService'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const data = await getPublicScheduleData(slug)

    if (!data) {
      return NextResponse.json(fail('NOT_FOUND', 'Organization not found'), { status: 404 })
    }

    return NextResponse.json(ok(data))
  } catch {
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch public schedule'), { status: 500 })
  }
}
