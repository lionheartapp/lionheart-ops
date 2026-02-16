import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { getModules } from '@/lib/modules'
import { corsHeaders } from '@/lib/cors'

export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
      const org = await prismaBase.organization.findUnique({
        where: { id: orgId },
        select: { settings: true, name: true, logoUrl: true, website: true, address: true, city: true, state: true, zip: true, primaryColor: true, secondaryColor: true, plan: true, trialEndsAt: true },
      })
      const settings = org?.settings && typeof org.settings === 'object' ? org.settings as Record<string, unknown> : {}
      const branding = settings?.branding && typeof settings.branding === 'object' ? settings.branding as Record<string, unknown> : {}
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
