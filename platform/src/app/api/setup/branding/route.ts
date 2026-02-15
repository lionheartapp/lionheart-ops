import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

/**
 * PATCH /api/setup/branding - Save org branding (address, logo, etc.) from setup wizard.
 * Requires Bearer token; user must belong to the org.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      orgId?: string
      address?: string
      logoUrl?: string | null
      name?: string
      website?: string
      colors?: { primary?: string; secondary?: string }
    }

    const orgId = body.orgId?.trim()
    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400, headers: corsHeaders })
    }

    // Require auth: Bearer token with user in this org
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401, headers: corsHeaders })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders })
    }

    // User must belong to this org (or be super-admin - we'd need to check role)
    const userOrgId = payload.orgId
    if (userOrgId !== orgId) {
      return NextResponse.json({ error: 'Not authorized to update this organization' }, { status: 403, headers: corsHeaders })
    }

    const org = await prismaBase.organization.findUnique({
      where: { id: orgId },
      select: { id: true, settings: true },
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404, headers: corsHeaders })
    }

    const updates: Record<string, unknown> = {}

    if (body.logoUrl !== undefined) {
      updates.logoUrl = body.logoUrl && String(body.logoUrl).trim() ? body.logoUrl.trim() : null
    }
    if (body.name !== undefined && body.name?.trim()) {
      updates.name = body.name.trim()
    }
    if (body.website !== undefined) {
      updates.website = body.website?.trim() || null
    }

    if (body.address !== undefined || body.colors !== undefined) {
      const currentSettings = (org.settings && typeof org.settings === 'object'
        ? org.settings as Record<string, unknown>
        : {}) as Record<string, unknown>
      const branding = (currentSettings.branding && typeof currentSettings.branding === 'object'
        ? { ...(currentSettings.branding as Record<string, unknown>) }
        : {}) as Record<string, unknown>
      if (body.address !== undefined) branding.address = body.address?.trim() ?? null
      if (body.colors) {
        const existing = branding.colors as { primary?: string; secondary?: string } | undefined
        branding.colors = {
          primary: body.colors.primary ?? existing?.primary ?? '#003366',
          secondary: body.colors.secondary ?? existing?.secondary ?? '#c4a006',
        }
      }
      updates.settings = { ...currentSettings, branding }
    }

    await prismaBase.organization.update({
      where: { id: orgId },
      data: updates,
    })

    return NextResponse.json({ ok: true }, { headers: corsHeaders })
  } catch (err) {
    console.error('setup/branding error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
