/**
 * GET /api/settings/export/events — export org events as CSV
 */

import { NextRequest, NextResponse } from 'next/server'
import { fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
}

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_READ)

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') ?? undefined

    const csv = await runWithOrgContext(orgId, async () => {
      const where: Record<string, unknown> = {}
      if (statusFilter) where.status = statusFilter

      const events = await prisma.event.findMany({
        where,
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          room: true,
          status: true,
          createdAt: true,
        },
        orderBy: { startsAt: 'desc' },
      })

      const headers = ['Title', 'Start Date', 'End Date', 'Location', 'Status', 'Created At']
      const rows = events.map((e) => [
        e.title,
        new Date(e.startsAt).toISOString(),
        new Date(e.endsAt).toISOString(),
        e.room ?? '',
        e.status,
        new Date(e.createdAt).toISOString(),
      ])

      return toCsv(headers, rows)
    })

    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="events-${date}.csv"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/settings/export/events]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
