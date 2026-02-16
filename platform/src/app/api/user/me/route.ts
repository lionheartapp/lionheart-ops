import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

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
  Viewer: 'VIEWER',
}

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
    }

    // Role cannot be changed via self-update; only Admins/Super Admins can assign roles via /api/admin/users/[userId]
    const updates: { name?: string } = {}
    if (body.name != null && typeof body.name === 'string') {
      const trimmed = body.name.trim()
      if (trimmed) updates.name = trimmed
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates' },
        { status: 400, headers: corsHeaders }
      )
    }

    const user = await prismaBase.user.update({
      where: { id: payload.userId },
      data: updates,
      include: { organization: true },
    })

    const isSuperAdmin = user.role === 'SUPER_ADMIN'
    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, role: isSuperAdmin ? 'super-admin' : toLionheartRole(user.role) } },
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
