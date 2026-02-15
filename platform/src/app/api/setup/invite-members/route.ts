import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

type PendingMember = { email: string; name?: string; role?: string; teamNames?: string[] }

/**
 * POST /api/setup/invite-members - Queue invites during onboarding.
 * Accepts emails[] or members[] (from CSV). Stores in org settings for future invite flow.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      orgId?: string
      emails?: string[]
      members?: Array<{ name?: string; email: string; role?: string; teamNames?: string[] }>
    }

    const orgId = body.orgId?.trim()
    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400, headers: corsHeaders })
    }

    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401, headers: corsHeaders })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders })
    }

    if (payload.orgId !== orgId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403, headers: corsHeaders })
    }

    let toAdd: PendingMember[] = []

    if (body.members?.length) {
      toAdd = body.members
        .map((m): PendingMember | null => {
          const email = String(m.email || '').trim().toLowerCase()
          if (!email || !email.includes('@')) return null
          return {
            email,
            name: m.name?.trim() || undefined,
            role: m.role?.trim() || undefined,
            teamNames: Array.isArray(m.teamNames) ? m.teamNames.map((t) => String(t).trim()).filter(Boolean) : undefined,
          }
        })
        .filter((m): m is PendingMember => m !== null)
    } else {
      const rawEmails = body.emails ?? []
      const emails = rawEmails
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => e.includes('@'))
      toAdd = emails.map((email) => ({ email }))
    }

    if (toAdd.length === 0) {
      return NextResponse.json({ ok: true, invited: 0 }, { headers: corsHeaders })
    }

    const org = await prismaBase.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404, headers: corsHeaders })
    }

    const current = (org.settings && typeof org.settings === 'object'
      ? org.settings as Record<string, unknown>
      : {}) as Record<string, unknown>
    const existing = (current.pendingInvites as PendingMember[]) ?? []
    const byEmail = new Map<string, PendingMember>()
    for (const m of existing) {
      const e = typeof m === 'string' ? m : (m as PendingMember).email
      if (e) byEmail.set(e.toLowerCase(), typeof m === 'string' ? { email: e } : (m as PendingMember))
    }
    for (const m of toAdd) {
      byEmail.set(m.email, m)
    }
    const combined = Array.from(byEmail.values())

    await prismaBase.organization.update({
      where: { id: orgId },
      data: { settings: { ...current, pendingInvites: combined } },
    })

    return NextResponse.json({ ok: true, invited: toAdd.length }, { headers: corsHeaders })
  } catch (err) {
    console.error('invite-members error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
