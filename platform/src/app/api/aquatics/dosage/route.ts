import { NextRequest, NextResponse } from 'next/server'
import {
  calcCopperSulfateOz,
  calcDyeOz,
  calcChlorineOz,
  calcAcidOz,
  POND_DEFAULT_VOLUME_GALLONS,
  POND_SAFEZONE,
  validateWaterSafety,
  ALKALINITY_MIN,
} from '@/lib/pondConstants'
import { corsHeaders } from '@/lib/cors'
import { withOrg, getOrgId, requireModule } from '@/lib/orgContext'
import { prisma, prismaBase } from '@/lib/prisma'

/** Unified dosage: pond (Copper/Dye) or pool (Chlorine/Acid). Requires waterManagement module. */
export async function GET(req: NextRequest) {
  try {
    await withOrg(req, prismaBase, async () => {
      await requireModule(prismaBase, getOrgId(), 'waterManagement')
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'MODULE_NOT_ACTIVE') {
      return NextResponse.json(
        { error: 'Water Management module is not active for your plan' },
        { status: 403, headers: corsHeaders }
      )
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  const u = req.nextUrl
  const waterAssetId = u.searchParams.get('waterAssetId') || undefined
  const mode = (u.searchParams.get('mode') || 'pond').toLowerCase() // 'pond' | 'pool'
  const volumeGal =
    parseFloat(u.searchParams.get('volume') || '') ||
    (waterAssetId ? undefined : POND_DEFAULT_VOLUME_GALLONS)

  let volume = volumeGal ?? POND_DEFAULT_VOLUME_GALLONS
  if (waterAssetId) {
    try {
      const asset = await prisma.waterAsset.findFirst({
        where: { id: waterAssetId },
      })
      if (asset?.volumeGallons) volume = asset.volumeGallons
    } catch {
      /* use default */
    }
  }

  if (mode === 'pool') {
    const currentChlorine = parseFloat(u.searchParams.get('currentChlorine') || '0') || 0
    const targetChlorine = parseFloat(u.searchParams.get('targetChlorine') || '2') || 2
    const currentPH = parseFloat(u.searchParams.get('currentPH') || '')
    const targetPH = parseFloat(u.searchParams.get('targetPH') || '')
    const chlorineOz = Math.round(
      calcChlorineOz(volume, currentChlorine, targetChlorine) * 10
    ) / 10
    let acidOz = 0
    let recommendation = `Apply ${chlorineOz} oz liquid chlorine (12.5%) to raise from ${currentChlorine} to ${targetChlorine} ppm.`
    if (!isNaN(currentPH) && !isNaN(targetPH) && targetPH < currentPH) {
      acidOz = Math.round(calcAcidOz(volume, currentPH - targetPH) * 10) / 10
      recommendation += ` Add ${acidOz} oz muriatic acid to lower pH from ${currentPH} to ${targetPH}.`
    }
    return NextResponse.json(
      {
        mode: 'pool',
        volumeGallons: volume,
        chlorineOz,
        acidOz,
        recommendation,
      },
      { headers: corsHeaders }
    )
  }

  const treatment = (u.searchParams.get('treatment') || 'copper').toLowerCase()
  const alkalinity = parseFloat(u.searchParams.get('alkalinity') || '')
  const hasTurtles =
    u.searchParams.get('turtles') === 'true' || u.searchParams.get('turtles') === '1'

  const validation = validateWaterSafety({
    alkalinity: isNaN(alkalinity) ? undefined : alkalinity,
    treatment,
  })

  if (!validation.ok) {
    return NextResponse.json(
      {
        error: validation.error,
        severity: validation.severity,
        copperBlocked: true,
        volumeGallons: volume,
        copperSulfateOz: 0,
        dyeOz: 0,
        recommendation: validation.error,
        safeZone: POND_SAFEZONE,
      },
      { headers: corsHeaders }
    )
  }

  let copperOz = 0
  let dyeOz = 0
  let recommendation = ''

  if (treatment === 'copper' || treatment === 'copper_sulfate') {
    const alk = isNaN(alkalinity) ? undefined : alkalinity
    const desiredPpm = hasTurtles ? 0.2 : 0.3
    copperOz =
      Math.round(calcCopperSulfateOz(volume, desiredPpm, alk, hasTurtles) * 10) / 10
    recommendation = `Apply ${copperOz} oz Copper Sulfate. Dissolve in water before adding.${hasTurtles ? ' (Turtle-safe: capped at 0.2 ppm)' : ''}${alk ? ` Alkalinity ${alk} ppm allows safe dose.` : ''}`
  } else if (treatment === 'dye') {
    dyeOz = Math.round(calcDyeOz(volume) * 10) / 10
    recommendation = `Apply ${dyeOz} oz aquatic dye. Add gradually; effect builds over days.`
  } else {
    dyeOz = Math.round(calcDyeOz(volume) * 10) / 10
    recommendation = 'Select Copper (requires alkalinity) or Dye.'
  }

  return NextResponse.json(
    {
      mode: 'pond',
      volumeGallons: volume,
      copperSulfateOz: copperOz,
      dyeOz,
      recommendation,
      safeZone: POND_SAFEZONE,
      alkalinityMin: ALKALINITY_MIN,
    },
    { headers: corsHeaders }
  )
}
