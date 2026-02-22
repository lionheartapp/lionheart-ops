import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

/** GET /api/admin/export — Export org data (tickets, events, members) for FERPA/GDPR */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      const [tickets, events, users, forms, formSubmissions, inventoryItems, inventoryStock, auditLogs] =
        await Promise.all([
          prisma.ticket.findMany({
            include: {
              submittedBy: { select: { name: true, email: true } },
              assignedTo: { select: { name: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.event.findMany({ orderBy: { date: 'desc' } }),
          prisma.user.findMany({
            select: { id: true, email: true, name: true, role: true, createdAt: true },
          }),
          prisma.form.findMany({ orderBy: { updatedAt: 'desc' } }),
          prisma.formSubmission.findMany({
            where: orgId ? { form: { organizationId: orgId } } : undefined,
            include: { form: { select: { title: true } } },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.inventoryItem.findMany(),
          prisma.inventoryStock.findMany({ include: { item: true } }),
          prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
        ])

      const exportData = {
        exportedAt: new Date().toISOString(),
        tickets,
        events,
        members: users,
        forms,
        formSubmissions: formSubmissions.map((s) => ({
          id: s.id,
          formId: s.formId,
          formTitle: s.form?.title,
          data: s.data,
          status: s.status,
          submittedBy: s.submittedBy,
          createdAt: s.createdAt,
        })),
        inventory: {
          items: inventoryItems,
          stock: inventoryStock,
        },
        auditLog: auditLogs,
      }

      const format = req.nextUrl.searchParams.get('format') || 'json'
      if (format === 'csv') {
        const csv = [
          ['Entity', 'Count'].join(','),
          ['tickets', tickets.length].join(','),
          ['events', events.length].join(','),
          ['members', users.length].join(','),
          ['forms', forms.length].join(','),
          ['formSubmissions', formSubmissions.length].join(','),
        ].join('\n')
        return new NextResponse(csv, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="org-export-${new Date().toISOString().slice(0, 10)}.csv"`,
          },
        })
      }

      return NextResponse.json(exportData, {
        headers: {
          ...corsHeaders,
          'Content-Disposition': `attachment; filename="org-export-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      })
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('GET /api/admin/export error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
