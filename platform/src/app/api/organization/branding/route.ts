import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'

function normalizeWebsite(raw: string | null | undefined): string | null {
  const s = raw?.trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}

/**
 * PATCH /api/organization/branding - Update org branding (name, logo, website, address).
 * Uses org from Bearer token.
 */
export async function PATCH(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const body = (await req.json()) as {
        logoUrl?: string | null
        name?: string
        website?: string | null
        address?: string | null
      }

      const org = await prismaBase.organization.findUnique({
        where: { id: orgId },
        select: { settings: true },
      })
      const currentSettings = (org?.settings && typeof org.settings === 'object' ? org.settings : {}) as Record<string, unknown>
      const branding = (currentSettings.branding && typeof currentSettings.branding === 'object' ? currentSettings.branding : {}) as Record<string, unknown>

      const updates: Record<string, unknown> = {}
      if (body.name !== undefined && body.name?.trim()) updates.name = body.name.trim()
      if (body.logoUrl !== undefined) updates.logoUrl = body.logoUrl && String(body.logoUrl).trim() ? body.logoUrl.trim() : null
      if (body.website !== undefined) updates.website = body.website && String(body.website).trim() ? normalizeWebsite(body.website) : null
      if (body.address !== undefined) {
        branding.address = body.address && String(body.address).trim() ? body.address.trim() : null
        updates.settings = { ...currentSettings, branding }
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ ok: true })
      }

      await prismaBase.organization.update({
        where: { id: orgId },
        data: updates,
      })
      return NextResponse.json({ ok: true })
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    console.error('organization/branding PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 })
  }
}
