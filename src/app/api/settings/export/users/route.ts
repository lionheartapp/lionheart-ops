/**
 * GET /api/settings/export/users — export org users as CSV
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

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      createdAt: true,
      userRole: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const orgTz = await getOrgTimezone(orgId)
  const dtFmt: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }
  const headers = ['Name', 'Email', 'Role', 'Status', 'Created At']
  const rows = users.map((u) => [
    [u.firstName, u.lastName].filter(Boolean).join(' ') || '',
    u.email,
    u.userRole?.name ?? '',
    u.status,
    formatInTimezone(new Date(u.createdAt), orgTz, dtFmt),
  ])

  const csv = toCsv(headers, rows)
  const date = toOrgDateString(new Date(), orgTz)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="users-${date}.csv"`,
    },
  })
}, { permission: PERMISSIONS.SETTINGS_READ })
