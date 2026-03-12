/**
 * GET /api/settings/export/users — export org users as CSV
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
  const log = logger.child({ route: '/api/settings/export/users', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.SETTINGS_READ)

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') ?? undefined

    const csv = await runWithOrgContext(orgId, async () => {
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

      return toCsv(headers, rows)
    })

    const orgTz = await getOrgTimezone(orgId)
    const date = toOrgDateString(new Date(), orgTz)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="users-${date}.csv"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to export users CSV')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
