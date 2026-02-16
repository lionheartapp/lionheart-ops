import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId, requireModule } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

/**
 * AI-driven setup: suggest thresholds and volume based on address, asset name, and type.
 * Mocks a Gemini call - in production would use Gemini API.
 */

type AssetType = 'POND' | 'POOL' | 'FOUNTAIN' | 'OTHER'

type SuggestedProfile = {
  pH: { min: number; max: number }
  dissolvedOxygen?: { min: number; max: number }
  alkalinity?: { min: number; max: number }
  chlorine?: { min: number; max: number }
  volumeGallons: number
  notes?: string
}

const VOLUME_KEYWORDS: Record<string, number> = {
  competition: 250000,
  olympic: 660000,
  lap: 20000,
  training: 50000,
  kiddie: 1500,
  splash: 8000,
  entry: 500,
  fountain: 300,
  koi: 5000,
  pond: 5000,
  retention: 10000,
}

function estimateVolume(assetName: string, assetType: AssetType): number {
  const combined = `${assetName} ${assetType}`.toLowerCase()
  for (const [keyword, gallons] of Object.entries(VOLUME_KEYWORDS)) {
    if (combined.includes(keyword)) return gallons
  }
  switch (assetType) {
    case 'POOL':
      return 25000
    case 'POND':
      return 5000
    case 'FOUNTAIN':
      return 500
    default:
      return 5000
  }
}

function getRecommendedProfile(assetType: AssetType, assetName: string): SuggestedProfile {
  const volume = estimateVolume(assetName, assetType)

  switch (assetType) {
    case 'POOL':
      return {
        pH: { min: 7.2, max: 7.8 },
        chlorine: { min: 1.0, max: 3.0 },
        volumeGallons: volume,
        notes: 'Chlorine in ppm. Maintain alkalinity 80–120 ppm for stability.',
      }
    case 'POND':
      return {
        pH: { min: 7.0, max: 8.0 },
        dissolvedOxygen: { min: 6, max: 9 },
        alkalinity: { min: 90, max: 120 },
        volumeGallons: volume,
        notes: 'Aquaculture thresholds. Copper requires alkalinity ≥50 ppm.',
      }
    case 'FOUNTAIN':
      return {
        pH: { min: 7.0, max: 8.5 },
        alkalinity: { min: 60, max: 120 },
        volumeGallons: volume,
        notes: 'Decorative fountains: balance algae control and water clarity.',
      }
    default:
      return {
        pH: { min: 6.8, max: 8.5 },
        volumeGallons: volume,
        notes: 'Generic thresholds. Customize based on use.',
      }
  }
}

export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      await requireModule(prismaBase, getOrgId(), 'waterManagement')
      const body = (await req.json()) as {
        schoolAddress?: string
        assetName?: string
        assetType?: AssetType
      }
      const assetName = (body.assetName || 'Untitled Asset').trim()
      const assetType: AssetType =
        body.assetType && ['POND', 'POOL', 'FOUNTAIN', 'OTHER'].includes(body.assetType)
          ? body.assetType
          : 'POND'

      const profile = getRecommendedProfile(assetType, assetName)

      return NextResponse.json(
        {
          recommendedProfile: profile,
          assetType,
          assetName,
          schoolAddress: body.schoolAddress,
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
    console.error('Aquatics suggest error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
