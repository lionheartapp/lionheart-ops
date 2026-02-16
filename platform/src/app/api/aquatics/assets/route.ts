import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId, requireModule } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

/** GET: List water assets. POST: Create asset. Requires waterManagement module. */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      await requireModule(prismaBase, getOrgId(), 'waterManagement')
      let assets = await prisma.waterAsset.findMany({
        orderBy: { name: 'asc' },
      })
      if (assets.length === 0) {
        const orgId = getOrgId()
        if (orgId) {
          await prisma.waterAsset.createMany({
            data: [
              { organizationId: orgId, name: 'Main Pool', type: 'POOL', volumeGallons: 25000 },
              { organizationId: orgId, name: 'North Pond', type: 'POND', volumeGallons: 5000 },
            ],
          })
          assets = await prisma.waterAsset.findMany({ orderBy: { name: 'asc' } })
        }
      }
      return NextResponse.json(assets, { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'MODULE_NOT_ACTIVE') {
      return NextResponse.json(
        { error: 'Water Management module is not active for your plan' },
        { status: 403, headers: corsHeaders }
      )
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      await requireModule(prismaBase, getOrgId(), 'waterManagement')
      const orgId = getOrgId()
      if (!orgId) {
        return NextResponse.json({ error: 'Organization ID is required' }, { status: 401, headers: corsHeaders })
      }
      const body = (await req.json()) as {
        name: string
        type: 'POND' | 'POOL' | 'FOUNTAIN' | 'OTHER'
        volumeGallons?: number
        thresholds?: Record<string, unknown>
      }
      const name = (body.name || '').trim()
      const type = body.type && ['POND', 'POOL', 'FOUNTAIN', 'OTHER'].includes(body.type)
        ? body.type
        : 'POND'
      const volumeGallons = typeof body.volumeGallons === 'number' ? body.volumeGallons : 5000

      const asset = await prisma.waterAsset.create({
        data: {
          organizationId: orgId,
          name: name || 'Untitled Asset',
          type,
          volumeGallons,
          thresholds: body.thresholds ?? undefined,
        },
      })
      return NextResponse.json(asset, { headers: corsHeaders })
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'MODULE_NOT_ACTIVE') {
      return NextResponse.json(
        { error: 'Water Management module is not active for your plan' },
        { status: 403, headers: corsHeaders }
      )
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
