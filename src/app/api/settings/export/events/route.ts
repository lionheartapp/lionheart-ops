/**
 * GET /api/settings/export/events — export org events as CSV
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { toOrgDateString, getOrgTimezone, formatInTimezone } from '@/lib/utils/timezone'

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n')
}

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const statusFilter = searchParams.get('status') ?? undefined

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

  const csv = toCsv(headers, rows)
  const date = toOrgDateString(new Date(), orgTz)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="events-${date}.csv"`,
    },
  })
}, { permission: PERMISSIONS.EVENTS_READ })
