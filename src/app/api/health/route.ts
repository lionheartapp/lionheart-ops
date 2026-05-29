/**
 * GET /api/health — Lightweight health check endpoint
 *
 * Returns 200 if the app is up and the database is reachable.
 * Use this for uptime monitoring (e.g., Vercel cron, UptimeRobot, Betterstack).
 *
 * Public — no auth required.
 */

import { NextResponse } from 'next/server'
// eslint-disable-next-line no-restricted-imports -- Public health check only runs SELECT 1 to verify database connectivity.
import { rawPrisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  const start = Date.now()

  try {
    // Quick DB connectivity check — runs `SELECT 1`
    await rawPrisma.$queryRaw`SELECT 1`
    const dbMs = Date.now() - start

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: { connected: true, latencyMs: dbMs },
      uptime: process.uptime(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        db: { connected: false, error: err instanceof Error ? err.message : 'Unknown' },
      },
      { status: 503 }
    )
  }
}
