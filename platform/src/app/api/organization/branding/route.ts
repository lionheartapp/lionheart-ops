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
        city?: string | null
        state?: string | null
        zip?: string | null
        primaryColor?: string | null
        secondaryColor?: string | null
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
        updates.address = body.address && String(body.address).trim() ? body.address.trim() : null
        branding.address = updates.address
        updates.settings = { ...currentSettings, branding }
      }
      if (body.city !== undefined) updates.city = body.city && String(body.city).trim() ? body.city.trim() : null
      if (body.state !== undefined) updates.state = body.state && String(body.state).trim() ? body.state.trim() : null
      if (body.zip !== undefined) updates.zip = body.zip && String(body.zip).trim() ? body.zip.trim() : null
      if (body.primaryColor !== undefined) updates.primaryColor = body.primaryColor && String(body.primaryColor).trim() ? body.primaryColor.trim() : null
      if (body.secondaryColor !== undefined) updates.secondaryColor = body.secondaryColor && String(body.secondaryColor).trim() ? body.secondaryColor.trim() : null

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
