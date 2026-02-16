import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { getModules } from '@/lib/modules'

export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const org = await prismaBase.organization.findUnique({
        where: { id: orgId },
        select: { settings: true, name: true, logoUrl: true, website: true, plan: true, trialEndsAt: true },
      })
      const settings = org?.settings && typeof org.settings === 'object' ? org.settings as Record<string, unknown> : {}
      const branding = settings?.branding && typeof settings.branding === 'object' ? settings.branding as Record<string, unknown> : {}
      const address = (branding?.address as string)?.trim() || null
      let modules = getModules(org?.settings ?? null)
      let trialDaysLeft: number | null = null
      if (org?.plan === 'PRO_TRIAL' && org.trialEndsAt) {
        if (new Date() > org.trialEndsAt) {
          modules = { ...modules, waterManagement: false, visualCampus: { enabled: false, maxBuildings: null }, advancedInventory: false }
        } else {
          trialDaysLeft = Math.ceil((org.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        }
      }
      return NextResponse.json({
        modules,
        name: org?.name ?? null,
        logoUrl: org?.logoUrl ?? null,
        website: org?.website ?? null,
        address,
        trialDaysLeft,
      })
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    console.error('Organization settings error:', err)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}
