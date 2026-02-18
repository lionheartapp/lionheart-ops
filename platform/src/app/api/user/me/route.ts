import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prismaBase } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

/** Member-level roles only; users cannot self-assign ADMIN or SUPER_ADMIN */
const SELF_ASSIGNABLE_ROLES: UserRole[] = ['TEACHER', 'MAINTENANCE', 'SITE_SECRETARY', 'VIEWER']

/** Map frontend role to DB UserRole */
const ROLE_MAP: Record<string, string> = {
  admin: 'ADMIN',
  member: 'SITE_SECRETARY',
  requester: 'TEACHER',
  viewer: 'VIEWER',
  teacher: 'TEACHER',
  maintenance: 'MAINTENANCE',
  administrator: 'ADMIN',
  secretary: 'SITE_SECRETARY',
  av: 'MAINTENANCE',
  // Display label variants
  Teacher: 'TEACHER',
  Maintenance: 'MAINTENANCE',
  'IT Support': 'MAINTENANCE',
  Administrator: 'ADMIN',
  Secretary: 'SITE_SECRETARY',
  AV: 'MAINTENANCE',
  Media: 'MAINTENANCE',
  Security: 'MAINTENANCE',
  Coach: 'TEACHER',
  Viewer: 'VIEWER',
}

/** When user sets role via onboarding, set default team so they see the right views (e.g. A/V -> av, Teacher -> teachers). */
const ROLE_TO_DEFAULT_TEAM: Record<string, string> = {
  AV: 'av',
  Media: 'av',
  Teacher: 'teachers',
  Maintenance: 'facilities',
  'IT Support': 'it',
  Secretary: 'admin',
  Administrator: 'admin',
  Security: 'security',
  Coach: 'athletics',
}

/** Division/area and role team ids allowed for self-assignment (onboarding, settings). */
const VALID_TEAM_IDS = [
  'admin', 'teachers', 'students', 'it', 'facilities', 'av', 'web', 'athletics', 'security',
  'admissions', 'health-office', 'transportation', 'after-school', 'pto',
  'elementary-school', 'middle-school', 'high-school', 'global',
]

/** Map DB role to Lionheart role format */
function toLionheartRole(dbRole: string | null): string {
  if (!dbRole) return 'viewer'
  const r = dbRole.toUpperCase()
  if (r === 'ADMIN') return 'admin'
  if (r === 'SITE_SECRETARY' || r === 'MAINTENANCE') return 'member'
  if (r === 'TEACHER') return 'requester'
  if (r === 'VIEWER') return 'viewer'
  return 'viewer'
}

/** GET /api/user/me - Fetch current user (from Bearer token). */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
    }

    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders })
    }

    const user = await prismaBase.user.findUnique({
      where: { id: payload.userId },
      include: { organization: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: corsHeaders })
    }

    const isSuperAdmin = user.role === 'SUPER_ADMIN'

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email?.split('@')[0] ?? 'User',
          role: isSuperAdmin ? 'super-admin' : toLionheartRole(user.role),
          teamIds: user.teamIds ?? [],
        },
      },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('GET /api/user/me error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch user' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/** PATCH /api/user/me - Update current user (from Bearer token). */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
    }

    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders })
    }

    const body = (await req.json()) as {
      name?: string
      role?: string
      teamIds?: string[]
    }

    const updates: { name?: string; role?: UserRole; teamIds?: string[] } = {}
    if (body.name != null && typeof body.name === 'string') {
      const trimmed = body.name.trim()
      if (trimmed) updates.name = trimmed
    }
    // Onboarding / primary role: allow self-assignment of member-level roles only (job function: Teacher, A/V, etc.). Cannot self-assign Admin or Super Admin.
    // Account creators (Super Admin) and Admins must never be downgraded by onboarding — only teamIds/name are updated so they get the right dashboard view (e.g. A/V, global).
    const existing = await prismaBase.user.findUnique({
      where: { id: payload.userId },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'User not found. Please sign in again.', code: 'SESSION_INVALID' },
        { status: 401, headers: corsHeaders }
      )
    }
    const isAdminOrSuperAdmin = existing.role === 'SUPER_ADMIN' || existing.role === 'ADMIN'

    if (body.role != null && typeof body.role === 'string') {
      const mapped = ROLE_MAP[body.role.toLowerCase()] || ROLE_MAP[body.role] || body.role.toUpperCase()
      const asRole = mapped as UserRole
      if (SELF_ASSIGNABLE_ROLES.includes(asRole)) {
        // Do not overwrite Super Admin or Admin — they stay as-is; only apply role for member-level users.
        if (!isAdminOrSuperAdmin) {
          updates.role = asRole
        }
        // Set default team from onboarding choice so they see the right dashboard (e.g. A/V -> av, Teacher -> teachers). Apply for everyone including Super Admin.
        if (!Array.isArray(body.teamIds) || body.teamIds.length === 0) {
          const defaultTeam = ROLE_TO_DEFAULT_TEAM[body.role] || ROLE_TO_DEFAULT_TEAM[body.role.trim()]
          if (defaultTeam) updates.teamIds = [defaultTeam]
        }
      }
    }
    // Teams: self-assign team membership (e.g. onboarding or settings). Valid ids include divisions and roles.
    if (Array.isArray(body.teamIds)) {
      updates.teamIds = body.teamIds.filter((id) => typeof id === 'string' && VALID_TEAM_IDS.includes(id.trim().toLowerCase()))
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates' },
        { status: 400, headers: corsHeaders }
      )
    }

    let user
    try {
      user = await prismaBase.user.update({
        where: { id: payload.userId },
        data: updates,
        include: { organization: true },
      })
    } catch (updateErr: unknown) {
      const msg = updateErr instanceof Error ? updateErr.message : String(updateErr)
      const code = (updateErr as { code?: string })?.code
      if (code === 'P2025' || /record.*not found|to update not found/i.test(msg)) {
        return NextResponse.json(
          { error: 'User not found. Please sign in again.', code: 'SESSION_INVALID' },
          { status: 401, headers: corsHeaders }
        )
      }
      throw updateErr
    }

    const isSuperAdmin = user.role === 'SUPER_ADMIN'
    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, role: isSuperAdmin ? 'super-admin' : toLionheartRole(user.role), teamIds: user.teamIds ?? [] } },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('PATCH /api/user/me error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Update failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
