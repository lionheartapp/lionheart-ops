import { NextRequest, NextResponse } from 'next/server'
import { UserRole } from '@prisma/client'
import { prismaBase } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

const ROLE_MAP: Record<string, string> = {
  Teacher: 'TEACHER',
  Maintenance: 'MAINTENANCE',
  'IT Support': 'MAINTENANCE', // map to MAINTENANCE; IT could have separate role later
  Administrator: 'ADMIN',
}

/** Map DB role to Lionheart role format */
function toLionheartRole(dbRole: string | null): string {
  if (!dbRole) return 'viewer'
  const r = dbRole.toUpperCase()
  if (r === 'ADMIN') return 'admin'
  if (['TEACHER', 'MAINTENANCE', 'SITE_SECRETARY'].includes(r)) return 'creator'
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
      role?: string
    }

    const updates: { name?: string; role?: UserRole } = {}
    if (body.name != null && typeof body.name === 'string') {
      const trimmed = body.name.trim()
      if (trimmed) updates.name = trimmed
    }
    if (body.role != null && typeof body.role === 'string') {
      const mapped = ROLE_MAP[body.role] || body.role
      const validRoles: UserRole[] = ['TEACHER', 'MAINTENANCE', 'ADMIN', 'SITE_SECRETARY', 'VIEWER']
      if (validRoles.includes(mapped as UserRole)) {
        updates.role = mapped as UserRole
      }
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

    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
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
