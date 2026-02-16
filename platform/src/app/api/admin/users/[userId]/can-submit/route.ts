import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
import { isAdminOrSuperAdmin } from '@/lib/roles'
import { corsHeaders } from '@/lib/cors'

/** PATCH /api/admin/users/[userId]/can-submit - Update canSubmitEvents. Admin or Super Admin only. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
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
      const actor = await prismaBase.user.findUnique({
        where: { id: payload.userId },
        select: { role: true, organizationId: true },
      })
      if (!actor || actor.organizationId !== orgId || !isAdminOrSuperAdmin(actor.role)) {
        return NextResponse.json(
          { error: 'Only Admins and Super Admins can update user permissions' },
          { status: 403, headers: corsHeaders }
        )
      }

      const body = (await req.json()) as { canSubmitEvents?: boolean }
      await prisma.user.update({
        where: { id: userId },
        data: { canSubmitEvents: body.canSubmitEvents ?? false },
      })
      return NextResponse.json({ ok: true }, { headers: corsHeaders })
    })
  } catch (err) {
    console.error('Update canSubmitEvents error:', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500, headers: corsHeaders })
  }
}
