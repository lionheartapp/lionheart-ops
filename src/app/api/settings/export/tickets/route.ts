/**
 * GET /api/settings/export/tickets — export org tickets as CSV
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
    await assertCan(ctx.userId, PERMISSIONS.TICKETS_READ_ALL)

    const { searchParams } = new URL(req.url)
    const statusFilter   = searchParams.get('status')   ?? undefined
    const categoryFilter = searchParams.get('category') ?? undefined

    const csv = await runWithOrgContext(orgId, async () => {
      const where: Record<string, unknown> = {}
      if (statusFilter)   where.status   = statusFilter
      if (categoryFilter) where.category = categoryFilter

      const tickets = await prisma.ticket.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          category: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          assignedTo: { select: { email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      const headers = ['ID', 'Title', 'Status', 'Category', 'Priority', 'Assigned To', 'Created At', 'Updated At']
      const rows = tickets.map((t) => {
        const assignee = t.assignedTo
          ? [t.assignedTo.firstName, t.assignedTo.lastName].filter(Boolean).join(' ') || t.assignedTo.email
          : ''
        return [
          t.id,
          t.title,
          t.status,
          t.category,
          t.priority,
          assignee,
          new Date(t.createdAt).toISOString(),
          new Date(t.updatedAt).toISOString(),
        ]
      })

      return toCsv(headers, rows)
    })

    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="tickets-${date}.csv"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/settings/export/tickets]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
