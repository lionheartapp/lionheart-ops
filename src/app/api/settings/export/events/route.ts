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
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'
import { toOrgDateString, getOrgTimezone, formatInTimezone } from '@/lib/utils/timezone'

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
}

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/settings/export/events', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
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

      const orgTz = await getOrgTimezone(orgId)
      const dtFmt: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
      const headers = ['Title', 'Start Date', 'End Date', 'Location', 'Status', 'Created At']
      const rows = events.map((e) => [
        e.title,
        formatInTimezone(new Date(e.startsAt), orgTz, dtFmt),
        formatInTimezone(new Date(e.endsAt), orgTz, dtFmt),
        e.room ?? '',
        e.status,
        formatInTimezone(new Date(e.createdAt), orgTz, dtFmt),
      ])

      return toCsv(headers, rows)
    })

    const orgTz = await getOrgTimezone(orgId)
    const date = toOrgDateString(new Date(), orgTz)

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
    log.error({ err: error }, 'Failed to export events CSV')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
