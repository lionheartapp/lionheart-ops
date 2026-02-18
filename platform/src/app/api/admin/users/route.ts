import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
import { isAdminOrSuperAdmin, canAssignRole } from '@/lib/roles'
import { corsHeaders } from '@/lib/cors'

function mapRoleToBackend(roleId: string): UserRole {
  const r = (roleId || '').toLowerCase()
  if (r === 'super-admin') return 'SUPER_ADMIN'
  if (r === 'admin') return 'ADMIN'
  if (r === 'member') return 'SITE_SECRETARY'
  if (r === 'requester') return 'TEACHER'
  return 'VIEWER'
}

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
        select: { id: true, name: true, email: true, role: true, canSubmitEvents: true, teamIds: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      })
      return NextResponse.json(
        users.map((u) => ({ ...u, teamIds: u.teamIds ?? [] })),
        { headers: corsHeaders }
      )
    })
  } catch (err) {
    if (err instanceof Error && (err.message === 'Organization ID is required' || err.message === 'Invalid organization')) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    return NextResponse.json([], { headers: corsHeaders })
  }
}

/** POST /api/admin/users - Create a new user in the org. Admin or Super Admin only. */
export async function POST(req: NextRequest) {
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
          { error: 'Only Admins and Super Admins can add members' },
          { status: 403, headers: corsHeaders }
        )
      }

      const body = (await req.json()) as { name?: string; email: string; role?: string; teamIds?: string[] }
      const email = (body.email || '').trim().toLowerCase()
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'Valid email is required' }, { status: 400, headers: corsHeaders })
      }

      const role = mapRoleToBackend(body.role || 'viewer')
      if (!canAssignRole(viewer.role, role)) {
        return NextResponse.json(
          { error: 'You do not have permission to assign this role' },
          { status: 403, headers: corsHeaders }
        )
      }

      const existing = await prismaBase.user.findUnique({ where: { email } })
      if (existing) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409, headers: corsHeaders }
        )
      }

      const teamIds = Array.isArray(body.teamIds) ? body.teamIds.filter((t) => typeof t === 'string' && t.trim()) : []
      const name = (body.name || '').trim() || email.split('@')[0] || 'User'

      const user = await prismaBase.user.create({
        data: {
          email,
          name: name || null,
          organizationId: orgId,
          role,
          teamIds,
          canSubmitEvents: role === 'TEACHER' || role === 'SITE_SECRETARY' || role === 'ADMIN' || role === 'SUPER_ADMIN',
        },
        select: { id: true, name: true, email: true, role: true, canSubmitEvents: true, teamIds: true },
      })
      return NextResponse.json(
        { ...user, teamIds: user.teamIds ?? [] },
        { status: 201, headers: corsHeaders }
      )
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('POST /api/admin/users error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create user' },
      { status: 500, headers: corsHeaders }
    )
  }
}
