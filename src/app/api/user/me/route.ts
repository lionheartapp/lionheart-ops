import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
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
  staff: 'SITE_SECRETARY',
  'office staff': 'SITE_SECRETARY',
  athletics: 'TEACHER',
  coach: 'TEACHER',
  // Display label variants
  Teacher: 'TEACHER',
  Maintenance: 'MAINTENANCE',
  'IT Support': 'MAINTENANCE',
  Administrator: 'ADMIN',
  Secretary: 'SITE_SECRETARY',
  'Office Staff': 'SITE_SECRETARY',
  Staff: 'SITE_SECRETARY',
  AV: 'MAINTENANCE',
  'A/V': 'MAINTENANCE',
  Media: 'MAINTENANCE',
  Security: 'MAINTENANCE',
  Coach: 'TEACHER',
  Athletics: 'TEACHER',
  Viewer: 'VIEWER',
}

/** When user sets role via onboarding, set default team so they see the right views. */
const ROLE_TO_DEFAULT_TEAM: Record<string, string> = {
  AV: 'av',
  'A/V': 'av',
  Media: 'av',
  Teacher: 'teachers',
  Maintenance: 'facilities',
  'IT Support': 'it',
  Secretary: 'admin',
  Administrator: 'admin',
  Security: 'security',
  Coach: 'athletics',
  Athletics: 'athletics',
  Staff: 'admin',
  'Office Staff': 'admin',
}

/** Division label -> team id for onboarding */
const DIVISION_TO_TEAM: Record<string, string> = {
  'High School': 'high-school',
  'Middle School': 'middle-school',
  'Elementary School': 'elementary-school',
  Global: 'global',
  Athletics: 'athletics',
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

    let user = await prismaBase.user.findUnique({
      where: { id: payload.userId },
      include: { organization: true },
    })
    // Fallback: token may have stale userId; find by email + org so session keeps working
    if (!user && payload.email && payload.orgId) {
      user = await prismaBase.user.findFirst({
        where: { email: payload.email.trim().toLowerCase(), organizationId: payload.orgId },
        include: { organization: true },
      })
    }
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
      division?: string
      grade?: string
      subject?: string
      sport?: string
    }

    // Resolve user early so we can avoid overwriting Super Admin/Admin when they set job function (e.g. A/V, global) in onboarding
    let existing = await prismaBase.user.findUnique({
      where: { id: payload.userId },
    })
    if (!existing && payload.email && payload.orgId) {
      const byEmail = await prismaBase.user.findFirst({
        where: { email: payload.email.trim().toLowerCase(), organizationId: payload.orgId },
      })
      if (byEmail) existing = byEmail
    }
    if (!existing) {
      return NextResponse.json(
        { error: 'User not found. Please sign in again.', code: 'SESSION_INVALID' },
        { status: 401, headers: corsHeaders }
      )
    }
    const isAdminOrSuperAdmin = existing.role === 'SUPER_ADMIN' || existing.role === 'ADMIN'

    const updates: {
      name?: string
      role?: UserRole
      teamIds?: string[]
      profileMetadata?: unknown
    } = {}
    if (body.name != null && typeof body.name === 'string') {
      const trimmed = body.name.trim()
      if (trimmed) updates.name = trimmed
    }

    // Onboarding: division (e.g. High School) + role (e.g. Teacher) -> teamIds; optional grade, subject, sport stored in profileMetadata
    const teamIdsSet = new Set<string>()
    if (body.division != null && typeof body.division === 'string') {
      const divTeam = DIVISION_TO_TEAM[body.division.trim()] || DIVISION_TO_TEAM[body.division]
      if (divTeam && VALID_TEAM_IDS.includes(divTeam)) teamIdsSet.add(divTeam)
    }
    if (body.role != null && typeof body.role === 'string') {
      const mapped = ROLE_MAP[body.role.toLowerCase()] || ROLE_MAP[body.role] || body.role.toUpperCase()
      const asRole = mapped as UserRole
      if (SELF_ASSIGNABLE_ROLES.includes(asRole)) {
        // Do not overwrite Super Admin or Admin — account creators stay Super Admin; only apply role for member-level users.
        if (!isAdminOrSuperAdmin) {
          updates.role = asRole
        }
      }
      // Always add default team for visibility (admin team for Administration, etc.)
      const roleTeam = ROLE_TO_DEFAULT_TEAM[body.role] || ROLE_TO_DEFAULT_TEAM[body.role.trim()] || ROLE_TO_DEFAULT_TEAM[body.role.toLowerCase()]
      if (roleTeam && VALID_TEAM_IDS.includes(roleTeam)) teamIdsSet.add(roleTeam)
    }
    if (teamIdsSet.size > 0) {
      updates.teamIds = Array.from(teamIdsSet)
    }
    // Explicit teamIds from client (e.g. settings) override or merge
    if (Array.isArray(body.teamIds) && body.teamIds.length > 0) {
      updates.teamIds = body.teamIds.filter((id) => typeof id === 'string' && VALID_TEAM_IDS.includes(id.trim().toLowerCase()))
    }

    if (body.grade != null || body.subject != null || body.sport != null) {
      const existing = await prismaBase.user.findUnique({ where: { id: payload.userId }, select: { profileMetadata: true } })
      const prev = (existing?.profileMetadata as Record<string, unknown>) || {}
      const meta = {
        ...prev,
        ...(body.grade != null && { grade: String(body.grade).trim() || undefined }),
        ...(body.subject != null && { subject: String(body.subject).trim() || undefined }),
        ...(body.sport != null && { sport: String(body.sport).trim() || undefined }),
      }
      updates.profileMetadata = meta as Prisma.InputJsonValue
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
        where: { id: existing.id },
        data: updates as Prisma.UserUpdateInput,
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
