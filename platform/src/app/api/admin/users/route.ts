import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
import { isAdminOrSuperAdmin } from '@/lib/roles'
import { corsHeaders } from '@/lib/cors'

/** GET /api/admin/users - List org users. Admin or Super Admin only. */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })

      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
      }
      const payload = await verifyToken(authHeader.slice(7))
      if (!payload?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
      }
      const viewer = await prismaBase.user.findUnique({
        where: { id: payload.userId },
        select: { role: true, organizationId: true },
      })
      if (!viewer || viewer.organizationId !== orgId || !isAdminOrSuperAdmin(viewer.role)) {
        return NextResponse.json(
          { error: 'Only Admins and Super Admins can view the member list' },
          { status: 403, headers: corsHeaders }
        )
      }

      const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, canSubmitEvents: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      })
      return NextResponse.json(users, { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    return NextResponse.json([], { headers: corsHeaders })
  }
}
