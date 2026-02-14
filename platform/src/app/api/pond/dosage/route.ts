import { NextRequest, NextResponse } from 'next/server'
import {
  calcCopperSulfateOz,
  calcDyeOz,
  POND_DEFAULT_VOLUME_GALLONS,
  POND_SAFEZONE,
  validateWaterSafety,
  ALKALINITY_MIN,
} from '@/lib/pondConstants'
import { corsHeaders } from '@/lib/cors'

/** Calculate dosage (oz) for Copper Sulfate or Dye. Alkalinity required for Copper. */
export async function GET(req: NextRequest) {
  const u = req.nextUrl
  const volumeGal = parseFloat(u.searchParams.get('volume') || '') || POND_DEFAULT_VOLUME_GALLONS
  const treatment = (u.searchParams.get('treatment') || 'copper').toLowerCase()
  const alkalinity = parseFloat(u.searchParams.get('alkalinity') || '')
  const hasTurtles = u.searchParams.get('turtles') === 'true' || u.searchParams.get('turtles') === '1'

  const validation = validateWaterSafety({ alkalinity: isNaN(alkalinity) ? undefined : alkalinity, treatment })

  if (!validation.ok) {
    return NextResponse.json(
      {
        error: validation.error,
        severity: validation.severity,
        copperBlocked: true,
        volumeGallons: volumeGal,
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
    copperOz = Math.round(calcCopperSulfateOz(volumeGal, desiredPpm, alk, hasTurtles) * 10) / 10
    recommendation = `Apply ${copperOz} oz Copper Sulfate. Dissolve in water before adding.${hasTurtles ? ' (Turtle-safe: capped at 0.2 ppm)' : ''}${alk ? ` Alkalinity ${alk} ppm allows safe dose.` : ''}`
  } else if (treatment === 'dye') {
    dyeOz = Math.round(calcDyeOz(volumeGal) * 10) / 10
    recommendation = `Apply ${dyeOz} oz aquatic dye. Add gradually; effect builds over days.`
  } else {
    copperOz = 0
    dyeOz = Math.round(calcDyeOz(volumeGal) * 10) / 10
    recommendation = 'Select Copper (requires alkalinity) or Dye.'
  }

  return NextResponse.json(
    {
      volumeGallons: volumeGal,
      copperSulfateOz: copperOz,
      dyeOz,
      recommendation,
      safeZone: POND_SAFEZONE,
      alkalinityMin: ALKALINITY_MIN,
    },
    { headers: corsHeaders }
  )
}
