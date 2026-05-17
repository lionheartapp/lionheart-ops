/**
 * GET /api/cron/release-seat-holds — Release expired seat holds
 *
 * Called by Vercel Cron every minute. Finds EventSeatStatus records with
 * status=HELD and heldUntil < now, resets them to AVAILABLE.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
// eslint-disable-next-line no-restricted-imports -- cron job, no org context
import { rawPrisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(fail('UNAUTHORIZED', 'Invalid cron secret'), { status: 401 })
  }

  const now = new Date()

  const result = await rawPrisma.eventSeatStatus.updateMany({
    where: {
      status: 'HELD',
      heldUntil: { lt: now },
    },
    data: {
      status: 'AVAILABLE',
      heldBy: null,
      heldUntil: null,
    },
  })

  return NextResponse.json(ok({ released: result.count }))
}
