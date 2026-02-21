import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { getModules } from '@/lib/modules'
import { corsHeaders } from '@/lib/cors'
import { verifyToken } from '@/lib/auth'
import { isSuperAdmin } from '@/lib/roles'

const DEFAULT_SYSTEM_FORM_IDS = { event: null as string | null, tech: null, facilities: null, it: null }

export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
      const org = await prismaBase.organization.findUnique({
        where: { id: orgId },
        select: { settings: true, name: true, logoUrl: true, website: true, address: true, city: true, state: true, zip: true, primaryColor: true, secondaryColor: true, plan: true, trialEndsAt: true, latitude: true, longitude: true, allowTeacherEventRequests: true },
      })
      const settings = org?.settings && typeof org.settings === 'object' ? org.settings as Record<string, unknown> : {}
      const branding = settings?.branding && typeof settings.branding === 'object' ? settings.branding as Record<string, unknown> : {}
      const systemFormIdsRaw = settings?.systemFormIds && typeof settings.systemFormIds === 'object' ? settings.systemFormIds as Record<string, unknown> : {}
      const systemFormIds = {
        event: typeof systemFormIdsRaw.event === 'string' ? systemFormIdsRaw.event : null,
        tech: typeof systemFormIdsRaw.tech === 'string' ? systemFormIdsRaw.tech : null,
        facilities: typeof systemFormIdsRaw.facilities === 'string' ? systemFormIdsRaw.facilities : null,
        it: typeof systemFormIdsRaw.it === 'string' ? systemFormIdsRaw.it : null,
      }
      const addr = org?.address?.trim() || (branding?.address as string)?.trim() || null
      const primaryColor = org?.primaryColor?.trim() || (branding?.colors as { primary?: string })?.primary || null
      const secondaryColor = org?.secondaryColor?.trim() || (branding?.colors as { secondary?: string })?.secondary || null
      let modules = getModules(org?.settings ?? null)
      let trialDaysLeft: number | null = null
      if (org?.plan === 'PRO_TRIAL' && org.trialEndsAt) {
        if (new Date() > org.trialEndsAt) {
          modules = { ...modules, waterManagement: false, visualCampus: { enabled: false, maxBuildings: null }, advancedInventory: false }
        } else {
          trialDaysLeft = Math.ceil((org.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        }
      }
      const addressParts = [addr, org?.city, org?.state, org?.zip].filter(Boolean)
      const address = addressParts.length > 0 ? addressParts.join(', ') : addr

      return NextResponse.json(
        {
          modules,
          name: org?.name ?? null,
          logoUrl: org?.logoUrl ?? null,
          website: org?.website ?? null,
          address,
          city: org?.city ?? null,
          state: org?.state ?? null,
          zip: org?.zip ?? null,
          primaryColor,
          secondaryColor,
          trialDaysLeft,
          latitude: org?.latitude ?? null,
          longitude: org?.longitude ?? null,
          allowTeacherEventRequests: org?.allowTeacherEventRequests ?? false,
          systemFormIds,
        },
        { headers: corsHeaders }
      )
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('Organization settings error:', err)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500, headers: corsHeaders })
  }
}

/** PATCH /api/organization/settings — Update org settings (e.g. systemFormIds). Super Admin only. */
export async function PATCH(req: NextRequest) {
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
      const user = await prismaBase.user.findUnique({
        where: { id: payload.userId },
        select: { role: true },
      })
      if (!isSuperAdmin(user?.role)) {
        return NextResponse.json(
          { error: 'Only Super Admins can update workspace form settings' },
          { status: 403, headers: corsHeaders }
        )
      }
      const body = (await req.json()) as { systemFormIds?: Record<string, string | null> }
      if (!body.systemFormIds || typeof body.systemFormIds !== 'object') {
        return NextResponse.json({ error: 'systemFormIds required' }, { status: 400, headers: corsHeaders })
      }
      const org = await prismaBase.organization.findUnique({
        where: { id: orgId },
        select: { settings: true },
      })
      const currentSettings = (org?.settings && typeof org.settings === 'object' ? org.settings : {}) as Record<string, unknown>
      const nextSystemFormIds = {
        ...DEFAULT_SYSTEM_FORM_IDS,
        event: typeof body.systemFormIds.event === 'string' ? body.systemFormIds.event : body.systemFormIds.event === null ? null : DEFAULT_SYSTEM_FORM_IDS.event,
        tech: typeof body.systemFormIds.tech === 'string' ? body.systemFormIds.tech : body.systemFormIds.tech === null ? null : DEFAULT_SYSTEM_FORM_IDS.tech,
        facilities: typeof body.systemFormIds.facilities === 'string' ? body.systemFormIds.facilities : body.systemFormIds.facilities === null ? null : DEFAULT_SYSTEM_FORM_IDS.facilities,
        it: typeof body.systemFormIds.it === 'string' ? body.systemFormIds.it : body.systemFormIds.it === null ? null : DEFAULT_SYSTEM_FORM_IDS.it,
      }
      await prismaBase.organization.update({
        where: { id: orgId },
        data: {
          settings: { ...currentSettings, systemFormIds: nextSystemFormIds },
        },
      })
      return NextResponse.json({ systemFormIds: nextSystemFormIds }, { headers: corsHeaders })
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('PATCH organization/settings error:', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500, headers: corsHeaders })
  }
}
