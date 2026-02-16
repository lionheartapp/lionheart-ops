import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

/** GET /api/admin/audit-log — Fetch audit history for org (for History tab) */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const { searchParams } = new URL(req.url)
      const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)
      const entityType = searchParams.get('entityType') || undefined

      const logs = await prisma.auditLog.findMany({
        where: entityType ? { entityType } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return NextResponse.json(logs, { headers: corsHeaders })
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('GET /api/admin/audit-log error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch audit log' },
      { status: 500, headers: corsHeaders }
    )
  }
}
