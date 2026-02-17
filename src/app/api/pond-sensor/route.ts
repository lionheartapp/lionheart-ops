import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId, requireModule } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'
import { getProactiveAlerts } from '@/lib/weatherOps'

/** POST: Receive IoT probe data or manual entry. GET: Latest readings. Requires waterManagement module. */
export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      await requireModule(prismaBase, getOrgId(), 'waterManagement')
      const body = (await req.json()) as {
        pH?: number
        turbidity?: number
        temperature?: number
        dissolvedOxygen?: number
        alkalinity?: number
        chlorine?: number
        waterAssetId?: string
        source?: 'sensor' | 'manual'
        notes?: string
      }
      const pH = typeof body.pH === 'number' ? body.pH : parseFloat(String(body.pH))
      const turbidity =
        typeof body.turbidity === 'number' ? body.turbidity : parseFloat(String(body.turbidity))
      const temperature =
        typeof body.temperature === 'number'
          ? body.temperature
          : parseFloat(String(body.temperature))
      const dissolvedOxygen =
        body.dissolvedOxygen != null ? parseFloat(String(body.dissolvedOxygen)) : undefined
      const alkalinity = body.alkalinity != null ? parseFloat(String(body.alkalinity)) : undefined
      const chlorine = body.chlorine != null ? parseFloat(String(body.chlorine)) : undefined

      if (isNaN(pH) || isNaN(turbidity) || isNaN(temperature)) {
        return NextResponse.json(
          { error: 'pH, turbidity, and temperature required (numbers)' },
          { status: 400, headers: corsHeaders }
        )
      }

      let assetType: 'POND' | 'POOL' | 'FOUNTAIN' | 'OTHER' = 'POND'
      if (body.waterAssetId) {
        const asset = await prisma.waterAsset.findFirst({
          where: { id: body.waterAssetId },
        })
        if (asset) assetType = asset.type
      }

      const org = await prismaBase.organization.findUnique({
        where: { id: getOrgId() },
        select: { latitude: true, longitude: true },
      })
      const proactiveWarnings: string[] = []
      if (org?.latitude != null && org?.longitude != null) {
        const alerts = await getProactiveAlerts(org.latitude, org.longitude, assetType)
        for (const a of alerts) {
          proactiveWarnings.push(a.message)
        }
      }

      const log = await prisma.waterLog.create({
        data: {
          pH,
          turbidity,
          temperature,
          dissolvedOxygen:
            dissolvedOxygen != null && !isNaN(dissolvedOxygen) ? dissolvedOxygen : undefined,
          alkalinity: alkalinity != null && !isNaN(alkalinity) ? alkalinity : undefined,
          chlorine: chlorine != null && !isNaN(chlorine) ? chlorine : undefined,
          waterAssetId: body.waterAssetId || undefined,
          source: body.source || 'manual',
          notes: body.notes,
        },
      })

      const response: Record<string, unknown> = { ...log }
      if (proactiveWarnings.length > 0) {
        response.proactiveWarnings = proactiveWarnings
      }
      return NextResponse.json(response, { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'MODULE_NOT_ACTIVE') {
      return NextResponse.json(
        { error: 'Water Management module is not active for your plan' },
        { status: 403, headers: corsHeaders }
      )
    }
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('Pond sensor error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      await requireModule(prismaBase, getOrgId(), 'waterManagement')
      const u = new URL(req.url)
      const waterAssetId = u.searchParams.get('waterAssetId') || undefined

      const logs = await prisma.waterLog.findMany({
        where: waterAssetId ? { waterAssetId } : undefined,
        take: 1,
        orderBy: { createdAt: 'desc' },
      })
      const latest = logs[0]
      return NextResponse.json(
        latest ?? {
          pH: null,
          turbidity: null,
          temperature: null,
          dissolvedOxygen: null,
          alkalinity: null,
          chlorine: null,
          createdAt: null,
        },
        { headers: corsHeaders }
      )
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'MODULE_NOT_ACTIVE') {
      return NextResponse.json(
        { error: 'Water Management module is not active for your plan' },
        { status: 403, headers: corsHeaders }
      )
    }
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load readings' },
      { status: 500, headers: corsHeaders }
    )
  }
}
