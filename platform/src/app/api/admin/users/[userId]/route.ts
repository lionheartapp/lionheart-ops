import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { verifyToken } from '@/lib/auth'
import {
  isAdminOrSuperAdmin,
  canAssignRole,
  ensureAtLeastOneSuperAdmin,
} from '@/lib/roles'
import { corsHeaders } from '@/lib/cors'

const VALID_ROLES: UserRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'TEACHER',
  'MAINTENANCE',
  'SITE_SECRETARY',
  'VIEWER',
]

/** PATCH /api/admin/users/[userId] - Update a user's role (and optionally name). Only Admin/Super Admin; enforces capability matrix and Singleton Rule. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      if (!orgId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
      }

      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
      }
      const payload = await verifyToken(authHeader.slice(7))
      if (!payload?.userId) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders })
      }

      const actor = await prismaBase.user.findUnique({
        where: { id: payload.userId },
        select: { role: true, organizationId: true },
      })
      if (!actor || actor.organizationId !== orgId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders })
      }
      if (!isAdminOrSuperAdmin(actor.role)) {
        return NextResponse.json(
          { error: 'Only Admins and Super Admins can change user roles' },
          { status: 403, headers: corsHeaders }
        )
      }

      const { userId } = await params
      const targetUser = await prisma.user.findFirst({
        where: { id: userId },
      })
      if (!targetUser || targetUser.organizationId !== orgId) {
        return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })
      }

      const body = (await req.json()) as { role?: string; name?: string; teamIds?: string[] }
      const updates: { role?: UserRole; name?: string; teamIds?: string[] } = {}

      if (body.name != null && typeof body.name === 'string') {
        const trimmed = body.name.trim()
        if (trimmed) updates.name = trimmed
      }

      if (body.role != null && typeof body.role === 'string') {
        const newRole = body.role.toUpperCase() as UserRole
        if (!VALID_ROLES.includes(newRole)) {
          return NextResponse.json(
            { error: 'Invalid role' },
            { status: 400, headers: corsHeaders }
          )
        }
        if (!canAssignRole(actor.role, newRole)) {
          return NextResponse.json(
            { error: 'You do not have permission to assign this role' },
            { status: 403, headers: corsHeaders }
          )
        }
        if (targetUser.role === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
          await ensureAtLeastOneSuperAdmin(prismaBase, orgId, targetUser.id)
        }
        updates.role = newRole
      }

      if (Array.isArray(body.teamIds)) {
        const valid = ['admin', 'teachers', 'students', 'it', 'facilities', 'av', 'web', 'athletics', 'security', 'admissions', 'health-office', 'transportation', 'after-school', 'pto']
        updates.teamIds = body.teamIds.filter((id) => typeof id === 'string' && valid.includes(id.trim().toLowerCase()))
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: 'No valid updates' },
          { status: 400, headers: corsHeaders }
        )
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: updates,
        select: { id: true, email: true, name: true, role: true, teamIds: true },
      })

      return NextResponse.json({
        user: {
          ...updated,
          teamIds: updated.teamIds ?? [],
        },
      }, { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('Cannot demote or remove the last Super Admin')) {
      return NextResponse.json(
        { error: err.message },
        { status: 400, headers: corsHeaders }
      )
    }
    console.error('PATCH admin users [userId] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
